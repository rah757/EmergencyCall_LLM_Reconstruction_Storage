const { Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const multisig = require('@sqds/multisig');
const fs = require('fs');
const bs58 = require('bs58').default;
const path = require('path');

// Load the correct multisig address from multisig-info.json
const multisigInfo = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../testing/wallets/multisig-info.json'), 'utf8'));
const MULTISIG_ADDRESS = multisigInfo.address; // <-- This is your actual multisig PDA

// Approver wallet path (can be a Solana secret key array or an object with base58 privateKey)
// Change this if you want to use a different approver wallet
const APPROVER_WALLET_PATH = 'testing/wallets/authority-wallet.json'; // <-- Set this to your approver wallet file

// Usage: node approve-proposal.js <transactionIndex>
const [,, transactionIndex] = process.argv;
if (!transactionIndex) {
    console.error('Usage: node approve-proposal.js <transactionIndex>');
    console.error('MULTISIG_ADDRESS and APPROVER_WALLET_PATH are set in the script.');
    process.exit(1);
}

// Use Devnet as default if SOLANA_RPC_URL is not set
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

function loadKeypair(walletPath) {
    const data = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    // If it's an array, use it directly
    if (Array.isArray(data)) {
        return Keypair.fromSecretKey(Uint8Array.from(data));
    }
    // If it's an object with a base58 privateKey, decode it
    if (typeof data === 'object' && data.privateKey) {
        return Keypair.fromSecretKey(bs58.decode(data.privateKey));
    }
    throw new Error('Invalid wallet file format: must be a secret key array or object with base58 privateKey');
}

async function approveProposal() {
    try {
        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        const multisigPda = new PublicKey(MULTISIG_ADDRESS);
        const approverKeypair = loadKeypair(APPROVER_WALLET_PATH);
        console.log('Using Multisig Address:', MULTISIG_ADDRESS);
        console.log('Approving Member Wallet:', approverKeypair.publicKey.toString());

        // Create the approval instruction
        const approveIx = await multisig.instructions.proposalApprove({
            multisigPda,
            transactionIndex: BigInt(transactionIndex),
            member: approverKeypair.publicKey,
        });

        // Build and send the transaction
        const transaction = new Transaction().add(approveIx);
        transaction.feePayer = approverKeypair.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        console.log('Sending approval transaction...');
        const signature = await connection.sendTransaction(transaction, [approverKeypair], { skipPreflight: false });
        await connection.confirmTransaction(signature, 'confirmed');

        console.log('Proposal approved successfully!');
        console.log('Transaction Signature:', signature);
    } catch (error) {
        console.error('Error approving proposal:', error.message);
    }
}

approveProposal(); 