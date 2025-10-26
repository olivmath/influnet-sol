import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Influnest } from "../target/types/influnest";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";

describe("influnest", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.influnest as Program<Influnest>;

  let usdcMint: PublicKey;
  let oracle: Keypair;
  let influencer: Keypair;
  let brand: Keypair;
  let oracleConfigPDA: PublicKey;
  let campaignPDA: PublicKey;
  let createdAt: number;

  before(async () => {
    // Generate keypairs
    oracle = Keypair.generate();
    influencer = Keypair.generate();
    brand = Keypair.generate();

    // Airdrop SOL for gas
    await provider.connection.requestAirdrop(
      oracle.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      influencer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      brand.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    // Wait for airdrops to confirm
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create mock USDC mint
    usdcMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      6 // USDC has 6 decimals
    );

    console.log("USDC Mint:", usdcMint.toString());
  });

  it("Initializes oracle config", async () => {
    [oracleConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle-config")],
      program.programId
    );

    await program.methods
      .initializeOracle(oracle.publicKey)
      .accounts({
        oracleConfig: oracleConfigPDA,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const oracleConfig = await program.account.oracleConfig.fetch(oracleConfigPDA);
    assert.equal(
      oracleConfig.oracle.toString(),
      oracle.publicKey.toString()
    );
    console.log("✅ Oracle initialized");
  });

  it("Creates a campaign", async () => {
    createdAt = Math.floor(Date.now() / 1000);
    const deadline = createdAt + 7 * 24 * 60 * 60; // 7 days from now

    [campaignPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("campaign"),
        influencer.publicKey.toBuffer(),
        Buffer.from(new BigInt64Array([BigInt(createdAt)]).buffer),
      ],
      program.programId
    );

    await program.methods
      .createCampaign(
        "Summer Product Launch",
        "Promote our new summer collection with engaging Instagram posts",
        new anchor.BN(1000 * 1e6), // 1000 USDC
        new anchor.BN(5000), // 5k likes
        new anchor.BN(500), // 500 comments
        new anchor.BN(50000), // 50k views
        new anchor.BN(1000), // 1k shares
        new anchor.BN(deadline),
        "@influencer_test"
      )
      .accounts({
        campaign: campaignPDA,
        influencer: influencer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([influencer])
      .rpc();

    const campaign = await program.account.campaign.fetch(campaignPDA);
    assert.equal(campaign.name, "Summer Product Launch");
    assert.equal(campaign.influencer.toString(), influencer.publicKey.toString());
    assert.ok(campaign.status.pending !== undefined);
    console.log("✅ Campaign created");
  });

  it("Brand funds the campaign", async () => {
    // Create token account for brand and mint USDC
    const brandTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      brand,
      usdcMint,
      brand.publicKey
    );

    // Mint USDC to brand
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      brandTokenAccount.address,
      provider.wallet.publicKey,
      1000 * 1e6 // 1000 USDC
    );

    const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
      [
        campaignPDA.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        usdcMint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await program.methods
      .fundCampaign()
      .accounts({
        campaign: campaignPDA,
        brand: brand.publicKey,
        brandTokenAccount: brandTokenAccount.address,
        vaultTokenAccount,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([brand])
      .rpc();

    const updatedCampaign = await program.account.campaign.fetch(campaignPDA);
    assert.ok(updatedCampaign.status.active !== undefined);
    assert.equal(updatedCampaign.brand.toString(), brand.publicKey.toString());
    console.log("✅ Campaign funded");
  });

  it("Influencer adds a post", async () => {
    await program.methods
      .addPost(
        "https://instagram.com/p/test123",
        "test123"
      )
      .accounts({
        campaign: campaignPDA,
        influencer: influencer.publicKey,
      })
      .signers([influencer])
      .rpc();

    const campaign = await program.account.campaign.fetch(campaignPDA);
    assert.equal(campaign.posts.length, 1);
    assert.equal(campaign.posts[0].postId, "test123");
    console.log("✅ Post added");
  });

  it("Oracle updates campaign metrics and triggers payment", async () => {
    const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
      [
        campaignPDA.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        usdcMint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const [influencerTokenAccount] = PublicKey.findProgramAddressSync(
      [
        influencer.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        usdcMint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Update metrics to 50% completion
    await program.methods
      .updateCampaignMetrics(
        new anchor.BN(2500), // 50% of 5000 likes
        new anchor.BN(250),  // 50% of 500 comments
        new anchor.BN(25000), // 50% of 50000 views
        new anchor.BN(500),   // 50% of 1000 shares
      )
      .accounts({
        campaign: campaignPDA,
        oracleConfig: oracleConfigPDA,
        oracle: oracle.publicKey,
        vaultTokenAccount,
        influencerTokenAccount,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([oracle])
      .rpc();

    const updatedCampaign = await program.account.campaign.fetch(campaignPDA);

    // 50% progress = 5 milestones = 500 USDC (50% of 1000)
    assert.equal(updatedCampaign.amountPaid.toNumber(), 500 * 1e6);
    assert.equal(updatedCampaign.currentLikes.toNumber(), 2500);
    console.log("✅ Metrics updated and payment executed");
  });

  it("Oracle updates to 100% completion", async () => {
    const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
      [
        campaignPDA.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        usdcMint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const [influencerTokenAccount] = PublicKey.findProgramAddressSync(
      [
        influencer.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        usdcMint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Update metrics to 100% completion
    await program.methods
      .updateCampaignMetrics(
        new anchor.BN(5000),  // 100% of likes
        new anchor.BN(500),   // 100% of comments
        new anchor.BN(50000), // 100% of views
        new anchor.BN(1000),  // 100% of shares
      )
      .accounts({
        campaign: campaignPDA,
        oracleConfig: oracleConfigPDA,
        oracle: oracle.publicKey,
        vaultTokenAccount,
        influencerTokenAccount,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([oracle])
      .rpc();

    const updatedCampaign = await program.account.campaign.fetch(campaignPDA);

    // 100% progress = 10 milestones = 1000 USDC
    assert.equal(updatedCampaign.amountPaid.toNumber(), 1000 * 1e6);
    assert.ok(updatedCampaign.status.completed !== undefined);
    console.log("✅ Campaign completed with full payment");
  });
});
