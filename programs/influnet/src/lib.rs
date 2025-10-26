use anchor_lang::prelude::*;

declare_id!("8yyV2rKoiBMBsiXhnJ4d64gDASdeMtQL8GFh8mH9e2Vk");

#[program]
pub mod influnet {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
