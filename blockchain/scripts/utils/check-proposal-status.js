const { Connection, PublicKey } = require('@solana/web3.js');
const multisig = require('@sqds/multisig');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function checkStatus(transactionIndex) {
    try {
        const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
        const multisigInfoPath = path.resolve(__dirname, '../../testing/wallets/multisig-info.json');
        const multisigInfo = JSON.parse(fs.readFileSync(multisigInfoPath, 'utf8'));
        const multisigPda = new PublicKey(multisigInfo.address);

        const [proposalPda] = multisig.getProposalPda({
            multisigPda,
            transactionIndex: BigInt(transactionIndex),
        });

        console.log(`Fetching status for proposal index: ${transactionIndex}`);
        console.log(`Proposal PDA: ${proposalPda.toBase58()}`);

        const proposalAccount = await multisig.accounts.Proposal.fromAccountAddress(connection, proposalPda);

        console.log("\n--- Proposal Status ---");
        console.log("Status:", proposalAccount.status);
        console.log("Approvers:", proposalAccount.approvedBy);
        console.log("Executed at:", proposalAccount.executedAt ? new Date(proposalAccount.executedAt.toNumber() * 1000) : 'N/A');

    } catch (error) {
        console.error("Failed to check proposal status:", error.message);
    }
}

const transactionIndex = process.argv[2];
if (!transactionIndex) {
    console.error("Usage: node scripts/utils/check-proposal-status.js <transaction_index>");
    process.exit(1);
}
checkStatus(transactionIndex);