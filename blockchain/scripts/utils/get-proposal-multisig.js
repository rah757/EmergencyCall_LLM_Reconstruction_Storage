const { Connection, PublicKey } = require('@solana/web3.js');
const multisig = require('@sqds/multisig');
const fs = require('fs');
const path = require('path');

async function getProposalMultisig(transactionIndex) {
    const multisigInfo = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../testing/wallets/multisig-info.json'), 'utf8'));
    const multisigPda = new PublicKey(multisigInfo.address);
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: BigInt(transactionIndex)
    });
    const proposalAccount = await multisig.accounts.Proposal.fromAccountAddress(connection, proposalPda);
    console.log('Proposal PDA:', proposalPda.toBase58());
    console.log('Multisig (from local):', multisigPda.toBase58());
    console.log('Multisig (from proposal account):', proposalAccount.multisig.toBase58());
}

const transactionIndex = process.argv[2];
if (!transactionIndex) {
    console.error('Usage: node get-proposal-multisig.js <transaction_index>');
    process.exit(1);
}
getProposalMultisig(transactionIndex);