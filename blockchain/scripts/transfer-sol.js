const { Connection, Keypair, LAMPORTS_PER_SOL, Transaction, SystemProgram } = require('@solana/web3.js');
const bs58 = require('bs58');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function transferSOL() {
    console.log("--- SOL Transfer Script ---");
    
    // Load source wallet from the authority wallet file
    const authorityWalletPath = path.resolve(__dirname, '../testing/wallets/authority-wallet.json');
    const authorityWalletData = JSON.parse(fs.readFileSync(authorityWalletPath, 'utf8'));
    const sourceWallet = Keypair.fromSecretKey(bs58.decode(authorityWalletData.privateKey));
    
    // Destination wallets (from your setup)
    const member1PublicKey = "D66ELXd8kWu6Qu45T2zDJLot7ghPFAK7dNwkr6YQzGUT";
    const member2PublicKey = "6HrVtrUeYoJpnSTLwUYK3qFDbshDw8tiMiEk2BimsnXA";
    
    // Connect to Solana
    const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
    
    console.log("Source wallet:", sourceWallet.publicKey.toBase58());
    console.log("Transferring 0.5 SOL to each member wallet...");
    
    // Transfer to Member 1
    const transfer1 = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: sourceWallet.publicKey,
            toPubkey: new (require('@solana/web3.js').PublicKey)(member1PublicKey),
            lamports: 0.5 * LAMPORTS_PER_SOL,
        })
    );
    
    const signature1 = await connection.sendTransaction(transfer1, [sourceWallet]);
    await connection.confirmTransaction(signature1, 'confirmed');
    console.log("✅ Transferred 0.5 SOL to Member 1:", signature1);
    
    // Transfer to Member 2
    const transfer2 = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: sourceWallet.publicKey,
            toPubkey: new (require('@solana/web3.js').PublicKey)(member2PublicKey),
            lamports: 0.5 * LAMPORTS_PER_SOL,
        })
    );
    
    const signature2 = await connection.sendTransaction(transfer2, [sourceWallet]);
    await connection.confirmTransaction(signature2, 'confirmed');
    console.log("✅ Transferred 0.5 SOL to Member 2:", signature2);
    
    console.log("🎉 All transfers completed successfully!");
}

transferSOL().catch(err => {
    console.error("❌ Transfer failed:", err);
}); 