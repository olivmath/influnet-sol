use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("DS6344gi387M4e6XvS99QQXGiDmY6qQi4xYxqGUjFbB3");

#[program]
pub mod influnest {
    use super::*;

    pub fn initialize_oracle(ctx: Context<InitializeOracle>, oracle: Pubkey) -> Result<()> {
        let oracle_config = &mut ctx.accounts.oracle_config;
        oracle_config.authority = ctx.accounts.authority.key();
        oracle_config.oracle = oracle;
        oracle_config.bump = ctx.bumps.oracle_config;
        msg!("Oracle initialized: {:?}", oracle);
        Ok(())
    }

    pub fn update_oracle(ctx: Context<UpdateOracle>, new_oracle: Pubkey) -> Result<()> {
        let oracle_config = &mut ctx.accounts.oracle_config;
        oracle_config.oracle = new_oracle;
        msg!("Oracle updated to: {:?}", new_oracle);
        Ok(())
    }

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        name: String,
        description: String,
        amount_usdc: u64,
        target_likes: u64,
        target_comments: u64,
        target_views: u64,
        target_shares: u64,
        deadline_ts: i64,
        instagram_username: String,
        created_at: i64,
    ) -> Result<()> {
        require!(name.len() <= 100, InflunestError::NameTooLong);
        require!(description.len() <= 500, InflunestError::DescriptionTooLong);
        require!(instagram_username.len() <= 50, InflunestError::UsernameTooLong);
        require!(amount_usdc > 0, InflunestError::InvalidAmount);
        require!(deadline_ts > Clock::get()?.unix_timestamp, InflunestError::InvalidDeadline);

        let campaign = &mut ctx.accounts.campaign;
        campaign.influencer = ctx.accounts.influencer.key();
        campaign.name = name;
        campaign.description = description;
        campaign.amount_usdc = amount_usdc;
        campaign.amount_paid = 0;
        campaign.target_likes = target_likes;
        campaign.target_comments = target_comments;
        campaign.target_views = target_views;
        campaign.target_shares = target_shares;
        campaign.current_likes = 0;
        campaign.current_comments = 0;
        campaign.current_views = 0;
        campaign.current_shares = 0;
        campaign.deadline_ts = deadline_ts;
        campaign.instagram_username = instagram_username;
        campaign.status = CampaignStatus::Pending;
        campaign.brand = Pubkey::default();
        campaign.created_at = created_at;
        campaign.posts = Vec::new();
        campaign.bump = ctx.bumps.campaign;

        msg!("Campaign created: {}", campaign.name);
        Ok(())
    }

    pub fn fund_campaign(ctx: Context<FundCampaign>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;

        require!(campaign.status == CampaignStatus::Pending, InflunestError::CampaignNotPending);
        require!(Clock::get()?.unix_timestamp < campaign.deadline_ts, InflunestError::CampaignExpired);

        // Transfer USDC from brand to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.brand_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.brand.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, campaign.amount_usdc)?;

        campaign.brand = ctx.accounts.brand.key();
        campaign.status = CampaignStatus::Active;

        msg!("Campaign funded by: {:?}", campaign.brand);
        Ok(())
    }

    pub fn add_post(ctx: Context<AddPost>, post_url: String, post_id: String) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;

        require!(campaign.status == CampaignStatus::Active, InflunestError::CampaignNotActive);
        require!(post_url.len() <= 200, InflunestError::PostUrlTooLong);
        require!(post_id.len() <= 100, InflunestError::PostIdTooLong);
        require!(campaign.posts.len() < 50, InflunestError::TooManyPosts);

        campaign.posts.push(Post {
            post_id,
            post_url,
            added_at: Clock::get()?.unix_timestamp,
        });

        msg!("Post added to campaign");
        Ok(())
    }

    pub fn update_campaign_metrics(
        ctx: Context<UpdateCampaignMetrics>,
        new_likes: u64,
        new_comments: u64,
        new_views: u64,
        new_shares: u64,
    ) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;

        require!(campaign.status == CampaignStatus::Active, InflunestError::CampaignNotActive);

        // Update metrics
        campaign.current_likes = new_likes;
        campaign.current_comments = new_comments;
        campaign.current_views = new_views;
        campaign.current_shares = new_shares;

        // Calculate progress percentage (0-100)
        let progress = calculate_progress(
            campaign.current_likes,
            campaign.current_comments,
            campaign.current_views,
            campaign.current_shares,
            campaign.target_likes,
            campaign.target_comments,
            campaign.target_views,
            campaign.target_shares,
        )?;

        // Calculate milestones achieved (0-10)
        let milestones_achieved = progress / 10;

        // Calculate total amount that should have been paid
        let total_should_be_paid = (campaign.amount_usdc as u128)
            .checked_mul(milestones_achieved as u128)
            .unwrap()
            .checked_div(10)
            .unwrap() as u64;

        // Calculate amount to transfer now
        let amount_to_transfer = total_should_be_paid.saturating_sub(campaign.amount_paid);

        if amount_to_transfer > 0 {
            // Transfer USDC from vault to influencer
            let seeds = &[
                b"campaign".as_ref(),
                campaign.influencer.as_ref(),
                &campaign.created_at.to_le_bytes(),
                &[campaign.bump],
            ];
            let signer = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.influencer_token_account.to_account_info(),
                authority: campaign.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, amount_to_transfer)?;

            campaign.amount_paid = campaign.amount_paid.checked_add(amount_to_transfer).unwrap();

            msg!("Paid {} USDC to influencer. Total paid: {}", amount_to_transfer, campaign.amount_paid);
        }

        // Check if campaign is completed
        if progress >= 100 {
            campaign.status = CampaignStatus::Completed;
            msg!("Campaign completed!");
        }

        Ok(())
    }

    pub fn withdraw_expired_stake(ctx: Context<WithdrawExpiredStake>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;

        require!(campaign.status == CampaignStatus::Active, InflunestError::CampaignNotActive);
        require!(Clock::get()?.unix_timestamp >= campaign.deadline_ts, InflunestError::CampaignNotExpired);

        let remaining_amount = campaign.amount_usdc.saturating_sub(campaign.amount_paid);

        if remaining_amount > 0 {
            // Transfer remaining USDC from vault to brand
            let seeds = &[
                b"campaign".as_ref(),
                campaign.influencer.as_ref(),
                &campaign.created_at.to_le_bytes(),
                &[campaign.bump],
            ];
            let signer = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.brand_token_account.to_account_info(),
                authority: campaign.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, remaining_amount)?;

            msg!("Returned {} USDC to brand", remaining_amount);
        }

        campaign.status = CampaignStatus::Expired;
        Ok(())
    }

    pub fn cancel_campaign(ctx: Context<CancelCampaign>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;

        require!(campaign.status == CampaignStatus::Pending, InflunestError::CannotCancelCampaign);

        campaign.status = CampaignStatus::Cancelled;
        msg!("Campaign cancelled");
        Ok(())
    }
}

// Helper function to calculate progress
fn calculate_progress(
    current_likes: u64,
    current_comments: u64,
    current_views: u64,
    current_shares: u64,
    target_likes: u64,
    target_comments: u64,
    target_views: u64,
    target_shares: u64,
) -> Result<u64> {
    let mut progress_sum: u64 = 0;
    let mut metrics_count: u64 = 0;

    if target_likes > 0 {
        let likes_progress = (current_likes.min(target_likes) as u128)
            .checked_mul(100)
            .unwrap()
            .checked_div(target_likes as u128)
            .unwrap() as u64;
        progress_sum = progress_sum.checked_add(likes_progress).unwrap();
        metrics_count += 1;
    }

    if target_comments > 0 {
        let comments_progress = (current_comments.min(target_comments) as u128)
            .checked_mul(100)
            .unwrap()
            .checked_div(target_comments as u128)
            .unwrap() as u64;
        progress_sum = progress_sum.checked_add(comments_progress).unwrap();
        metrics_count += 1;
    }

    if target_views > 0 {
        let views_progress = (current_views.min(target_views) as u128)
            .checked_mul(100)
            .unwrap()
            .checked_div(target_views as u128)
            .unwrap() as u64;
        progress_sum = progress_sum.checked_add(views_progress).unwrap();
        metrics_count += 1;
    }

    if target_shares > 0 {
        let shares_progress = (current_shares.min(target_shares) as u128)
            .checked_mul(100)
            .unwrap()
            .checked_div(target_shares as u128)
            .unwrap() as u64;
        progress_sum = progress_sum.checked_add(shares_progress).unwrap();
        metrics_count += 1;
    }

    require!(metrics_count > 0, InflunestError::NoTargetMetrics);

    Ok(progress_sum / metrics_count)
}

// Context structs
#[derive(Accounts)]
pub struct InitializeOracle<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + OracleConfig::INIT_SPACE,
        seeds = [b"oracle-config"],
        bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateOracle<'info> {
    #[account(
        mut,
        seeds = [b"oracle-config"],
        bump = oracle_config.bump,
        has_one = authority
    )]
    pub oracle_config: Account<'info, OracleConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(created_at: i64)]
pub struct CreateCampaign<'info> {
    #[account(
        init,
        payer = influencer,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [b"campaign", influencer.key().as_ref(), &created_at.to_le_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub influencer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundCampaign<'info> {
    #[account(
        mut,
        seeds = [b"campaign", campaign.influencer.as_ref(), &campaign.created_at.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub brand: Signer<'info>,
    #[account(
        mut,
        constraint = brand_token_account.owner == brand.key(),
        constraint = brand_token_account.mint == usdc_mint.key()
    )]
    pub brand_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = brand,
        associated_token::mint = usdc_mint,
        associated_token::authority = campaign
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddPost<'info> {
    #[account(
        mut,
        seeds = [b"campaign", campaign.influencer.as_ref(), &campaign.created_at.to_le_bytes()],
        bump = campaign.bump,
        has_one = influencer
    )]
    pub campaign: Account<'info, Campaign>,
    pub influencer: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateCampaignMetrics<'info> {
    #[account(
        mut,
        seeds = [b"campaign", campaign.influencer.as_ref(), &campaign.created_at.to_le_bytes()],
        bump = campaign.bump,
        has_one = influencer
    )]
    pub campaign: Account<'info, Campaign>,
    /// CHECK: Only the influencer's pubkey is used for ATA seeds and has_one validation.
    /// No account data is read or written; constraints ensure correctness.
    pub influencer: UncheckedAccount<'info>,
    #[account(
        seeds = [b"oracle-config"],
        bump = oracle_config.bump,
        constraint = oracle_config.oracle == oracle.key() @ InflunestError::UnauthorizedOracle
    )]
    pub oracle_config: Account<'info, OracleConfig>,
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = campaign
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = oracle,
        associated_token::mint = usdc_mint,
        associated_token::authority = influencer
    )]
    pub influencer_token_account: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawExpiredStake<'info> {
    #[account(
        mut,
        seeds = [b"campaign", campaign.influencer.as_ref(), &campaign.created_at.to_le_bytes()],
        bump = campaign.bump,
        has_one = brand
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub brand: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = campaign
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = brand,
        associated_token::mint = usdc_mint,
        associated_token::authority = brand
    )]
    pub brand_token_account: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelCampaign<'info> {
    #[account(
        mut,
        seeds = [b"campaign", campaign.influencer.as_ref(), &campaign.created_at.to_le_bytes()],
        bump = campaign.bump,
        has_one = influencer
    )]
    pub campaign: Account<'info, Campaign>,
    pub influencer: Signer<'info>,
}

// Account structs
#[account]
#[derive(InitSpace)]
pub struct OracleConfig {
    pub authority: Pubkey,
    pub oracle: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub influencer: Pubkey,
    pub brand: Pubkey,
    #[max_len(100)]
    pub name: String,
    #[max_len(500)]
    pub description: String,
    pub amount_usdc: u64,
    pub amount_paid: u64,
    pub target_likes: u64,
    pub target_comments: u64,
    pub target_views: u64,
    pub target_shares: u64,
    pub current_likes: u64,
    pub current_comments: u64,
    pub current_views: u64,
    pub current_shares: u64,
    pub deadline_ts: i64,
    #[max_len(50)]
    pub instagram_username: String,
    pub status: CampaignStatus,
    pub created_at: i64,
    #[max_len(50)]
    pub posts: Vec<Post>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Post {
    #[max_len(100)]
    pub post_id: String,
    #[max_len(200)]
    pub post_url: String,
    pub added_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum CampaignStatus {
    Pending,
    Active,
    Completed,
    Cancelled,
    Expired,
}

// Error codes
#[error_code]
pub enum InflunestError {
    #[msg("Campaign name is too long (max 100 characters)")]
    NameTooLong,
    #[msg("Campaign description is too long (max 500 characters)")]
    DescriptionTooLong,
    #[msg("Instagram username is too long (max 50 characters)")]
    UsernameTooLong,
    #[msg("Invalid campaign amount")]
    InvalidAmount,
    #[msg("Invalid deadline (must be in the future)")]
    InvalidDeadline,
    #[msg("Campaign is not in pending status")]
    CampaignNotPending,
    #[msg("Campaign has expired")]
    CampaignExpired,
    #[msg("Campaign is not active")]
    CampaignNotActive,
    #[msg("Post URL is too long (max 200 characters)")]
    PostUrlTooLong,
    #[msg("Post ID is too long (max 100 characters)")]
    PostIdTooLong,
    #[msg("Too many posts (max 50)")]
    TooManyPosts,
    #[msg("Campaign has not expired yet")]
    CampaignNotExpired,
    #[msg("Cannot cancel campaign (only pending campaigns can be cancelled)")]
    CannotCancelCampaign,
    #[msg("Unauthorized oracle")]
    UnauthorizedOracle,
    #[msg("No target metrics defined")]
    NoTargetMetrics,
}
