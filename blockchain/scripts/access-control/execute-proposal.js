const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const multisig = require('@sqds/multisig');
const bs58 = require('bs58').default;
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function executeProposal(transactionIndex, walletFile) {
    try {
        console.log(`Executing proposal for transaction index: ${transactionIndex}`);

        // 1. Load executing member's wallet
        const walletPath = path.resolve(walletFile);
        const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        const secretKey = bs58.decode(walletData.privateKey);
        const memberWallet = Keypair.fromSecretKey(secretKey);
        console.log('Executing Member Wallet:', memberWallet.publicKey.toString());

        // 2. Load multisig info
        const multisigInfoPath = path.resolve(__dirname, '../../testing/wallets/multisig-info.json');
        const multisigInfo = JSON.parse(fs.readFileSync(multisigInfoPath, 'utf8'));
        const multisigPda = new PublicKey(multisigInfo.address);
        
        // 3. Connect to Solana
        const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

        // 4. Execute the transaction using the Squads SDK RPC method
        console.log('Sending execution transaction...');
        const signature = await multisig.rpc.vaultTransactionExecute({
            connection,
            feePayer: memberWallet,
            multisigPda,
            transactionIndex: BigInt(transactionIndex),
            member: memberWallet.publicKey,
            signers: [memberWallet]
        });

        await connection.confirmTransaction(signature, 'confirmed');

        console.log('Proposal executed successfully!');
        console.log('Transaction Signature:', signature);

    } catch (error) {
        console.error('Error executing proposal:', error.message);
    }
}

// Command-line execution logic
if (require.main === module) {
    const transactionIndex = process.argv[2];
    const walletFile = process.argv[3];
    if (!transactionIndex || !walletFile) {
        console.error('Usage: node scripts/access-control/execute-proposal.js <transaction_index> <path_to_wallet_file>');
        process.exit(1);
    }
    executeProposal(transactionIndex, walletFile);
}