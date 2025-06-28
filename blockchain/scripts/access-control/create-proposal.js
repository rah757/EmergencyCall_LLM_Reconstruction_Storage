const { Connection, PublicKey, Transaction, Keypair, TransactionMessage, SystemProgram } = require('@solana/web3.js');
const multisig = require('@sqds/multisig');
const bs58 = require('bs58').default;
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { createMemoInstruction } = require('../utils/memo-instruction.js');

// Path to your wallet file (relative to project root)
const WALLET_PATH = 'testing/wallets/member-wallet-1.json'; // <-- Set this to your wallet file path

// Load multisig address from JSON file
const multisigInfo = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../testing/wallets/multisig-info.json'), 'utf8'));
const MULTISIG_ADDRESS = multisigInfo.address;

async function createProposal(walletFile, arweaveId) {
    try {
        console.log('Starting Proposal Creation...');

        // 1. Load creator's wallet
        const walletPath = path.resolve(walletFile);
        const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        const secretKey = bs58.decode(walletData.privateKey);
        const creatorWallet = Keypair.fromSecretKey(secretKey);
        console.log('Creator Wallet Loaded:', creatorWallet.publicKey.toString());

        // 2. Connect to Solana
        const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

        // 3. Fetch multisig account state to get the next transaction index
        const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(connection, new PublicKey(MULTISIG_ADDRESS));
        const transactionIndex = BigInt(multisigAccount.transactionIndex.toNumber() + 1);
        console.log(`Next transaction index: ${transactionIndex}`);

        // 4. Create a simple, no-op instruction (e.g., transfer 1 lamport to self)
        const transferIx = SystemProgram.transfer({
            fromPubkey: creatorWallet.publicKey,
            toPubkey: creatorWallet.publicKey,
            lamports: 1,
        });

        // 5. Create the vault transaction and proposal using the Squads SDK
        const { blockhash } = await connection.getLatestBlockhash();
        const transactionMessage = new TransactionMessage({
            payerKey: creatorWallet.publicKey,
            recentBlockhash: blockhash,
            instructions: [transferIx], // Keep only the transfer instruction in the message
        });

        const memo = `Requesting access to Arweave document: ${arweaveId}`;
        
        console.log('Creating vault transaction...');
        const createVaultTxIx = await multisig.instructions.vaultTransactionCreate({
            multisigPda: new PublicKey(MULTISIG_ADDRESS),
            transactionIndex,
            creator: creatorWallet.publicKey,
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage,
            memo,
        });
        
        console.log('Creating proposal...');
        const createProposalIx = await multisig.instructions.proposalCreate({
            multisigPda: new PublicKey(MULTISIG_ADDRESS),
            transactionIndex,
            creator: creatorWallet.publicKey,
        });

        // 6. Build and send the transaction
        const transaction = new Transaction().add(createVaultTxIx, createProposalIx);
        transaction.feePayer = creatorWallet.publicKey;
        transaction.recentBlockhash = blockhash;

        console.log('Sending transaction to create proposal...');
        const signature = await connection.sendTransaction(transaction, [creatorWallet], { skipPreflight: false });
        await connection.confirmTransaction(signature, 'confirmed');

        console.log('Proposal created successfully!');
        console.log('Transaction Signature:', signature);
        console.log(`Transaction Index: ${transactionIndex}`);

    } catch (error) {
        console.error('Error creating proposal:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

// Usage: node create-proposal.js <arweave_id>
const [,, cliArweaveId] = process.argv;
const walletPath = WALLET_PATH;
const arweaveId = cliArweaveId;
if (!arweaveId) {
    console.error('Usage: node scripts/access-control/create-proposal.js <arweave_id>');
    console.error('Or set WALLET_PATH in the script.');
    process.exit(1);
}

createProposal(walletPath, arweaveId);