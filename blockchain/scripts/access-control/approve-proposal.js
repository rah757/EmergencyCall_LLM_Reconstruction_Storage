const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const multisig = require('@sqds/multisig');
const bs58 = require('bs58').default;
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function approveProposal(transactionIndex, walletFile) {
    try {
        console.log(`Approving proposal for transaction index: ${transactionIndex}`);

        // 1. Load member wallet
        const walletPath = path.resolve(walletFile);
        const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        const secretKey = bs58.decode(walletData.privateKey);
        const memberWallet = Keypair.fromSecretKey(secretKey);
        console.log('Approving Member Wallet:', memberWallet.publicKey.toString());

        // 2. Load multisig info
        const multisigInfoPath = path.resolve(__dirname, '../../testing/wallets/multisig-info.json');
        const multisigInfo = JSON.parse(fs.readFileSync(multisigInfoPath, 'utf8'));
        const multisigPda = new PublicKey(multisigInfo.address);

        // 3. Connect to Solana
        const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

        // 4. Create the approval instruction
        const approveIx = await multisig.instructions.proposalApprove({
            multisigPda,
            transactionIndex: BigInt(transactionIndex),
            member: memberWallet.publicKey,
        });

        // 5. Build and send the transaction
        const transaction = new Transaction().add(approveIx);
        transaction.feePayer = memberWallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        console.log('Sending approval transaction...');
        const signature = await connection.sendTransaction(transaction, [memberWallet], { skipPreflight: false });
        await connection.confirmTransaction(signature, 'confirmed');

        console.log('Proposal approved successfully!');
        console.log('Transaction Signature:', signature);

    } catch (error) {
        console.error('Error approving proposal:', error.message);
    }
}

// Command-line execution logic
if (require.main === module) {
    const transactionIndex = process.argv[2];
    const walletFile = process.argv[3];
    if (!transactionIndex || !walletFile) {
        console.error('Usage: node scripts/access-control/approve-proposal.js <transaction_index> <path_to_wallet_file>');
        process.exit(1);
    }
    approveProposal(transactionIndex, walletFile);
}