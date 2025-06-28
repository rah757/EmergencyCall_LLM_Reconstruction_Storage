const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const Arweave = require('arweave');
const multisig = require('@sqds/multisig');
const fs = require('fs');
const path = require('path');
const bs58 = require('bs58').default;
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const walletsDir = path.resolve(__dirname, '../../testing/wallets');

// Helper to write JSON wallet files
const writeWallet = (filePath, keypair) => {
    const data = {
        publicKey: keypair.publicKey.toBase58(),
        privateKey: bs58.encode(keypair.secretKey)
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

async function masterSetup() {
    console.log("--- STARTING ULTRA-DEEP SYSTEM SETUP ---");

    // 1. Ensure wallets directory exists
    if (!fs.existsSync(walletsDir)) {
        fs.mkdirSync(walletsDir, { recursive: true });
    }
    console.log("✅ Wallets directory ensured.");

    // 2. Create Arweave Wallet
    const arweave = Arweave.init({});
    const arweaveKey = await arweave.wallets.generate();
    const arweaveAddress = await arweave.wallets.jwkToAddress(arweaveKey);
    fs.writeFileSync(path.join(walletsDir, 'arweave-wallet.json'), JSON.stringify(arweaveKey, null, 2));
    console.log(`✅ Arweave wallet created: ${arweaveAddress}`);

    // 3. Create Solana Wallets
    const authority = Keypair.generate();
    const member1 = Keypair.generate();
    const member2 = Keypair.generate();
    writeWallet(path.join(walletsDir, 'authority-wallet.json'), authority);
    writeWallet(path.join(walletsDir, 'member-wallet-1.json'), member1);
    writeWallet(path.join(walletsDir, 'member-wallet-2.json'), member2);
    console.log("✅ Solana authority and member wallets created.");

    // 4. Create Multisig
    console.log("\n--- Creating Multisig (this may take a moment) ---");
    const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');

    console.log("Airdropping 2 SOL to authority for fees...");
    const airdropSignature = await connection.requestAirdrop(authority.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSignature, 'confirmed');
    console.log("✅ Airdrop successful.");

    const createKey = Keypair.generate();
    const members = [member1.publicKey, member2.publicKey];
    const threshold = 2;

    const { multisigPda } = await multisig.rpc.multisigCreate({
        connection,
        creator: authority,
        createKey,
        threshold,
        members,
        timeLock: 0,
    });
    console.log(`✅ Multisig account created successfully!`);
    console.log(`   -> Multisig PDA: ${multisigPda.toBase58()}`);

    // 5. Save multisig info
    const multisigInfo = { address: multisigPda.toBase58(), threshold, members: members.map(m => m.toBase58()) };
    fs.writeFileSync(path.join(walletsDir, 'multisig-info.json'), JSON.stringify(multisigInfo, null, 2));
    console.log("✅ Multisig info saved.");

    // 6. FINAL INSTRUCTION
    console.log("\n\n🚨🚨🚨 ACTION REQUIRED 🚨🚨🚨");
    console.log("Setup is almost complete. You must perform one manual step:");
    console.log("1. Open the '.env' file in your project root.");
    console.log(`2. Find the line 'MULTISIG_PDA=""'`);
    console.log(`3. Paste the Multisig PDA into the quotes: MULTISIG_PDA="${multisigPda.toBase58()}"`);
    console.log("----------------------------------------------");
}

masterSetup().catch(err => {
    console.error("\n❌ SETUP FAILED:", err);
});
