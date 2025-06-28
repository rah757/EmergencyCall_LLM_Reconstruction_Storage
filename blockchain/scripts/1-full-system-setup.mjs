import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import Arweave from 'arweave';
import * as multisig from '@sqds/multisig';
import fs from 'fs';
import path from 'path';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const walletsDir = path.resolve(__dirname, '../testing/wallets');

const writeWallet = (filePath, keypair) => {
    const data = {
        publicKey: keypair.publicKey.toBase58(),
        privateKey: bs58.encode(keypair.secretKey)
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

async function masterSetup() {
    console.log("--- STARTING ULTRA-DEEP SYSTEM SETUP ---");

    if (!fs.existsSync(walletsDir)) {
        fs.mkdirSync(walletsDir, { recursive: true });
    }
    console.log("✅ Wallets directory ensured.");

    const arweave = Arweave.init({});
    const arweaveKey = await arweave.wallets.generate();
    const arweaveAddress = await arweave.wallets.jwkToAddress(arweaveKey);
    fs.writeFileSync(path.join(walletsDir, 'arweave-wallet.json'), JSON.stringify(arweaveKey, null, 2));
    console.log(`✅ Arweave wallet created: ${arweaveAddress}`);

    // Load wallets from disk
    const authorityWalletData = JSON.parse(fs.readFileSync(path.join(walletsDir, 'authority-wallet.json'), 'utf8'));
    const member1Data = JSON.parse(fs.readFileSync(path.join(walletsDir, 'member-wallet-1.json'), 'utf8'));
    const member2Data = JSON.parse(fs.readFileSync(path.join(walletsDir, 'member-wallet-2.json'), 'utf8'));

    const authority = Keypair.fromSecretKey(bs58.decode(authorityWalletData.privateKey));
    const members = [
        new PublicKey(member1Data.publicKey),
        new PublicKey(member2Data.publicKey)
    ];

    console.log("Wallets loaded:");
    console.log("  Authority:", authority.publicKey.toBase58());
    console.log("  Members:", members);
    console.log('member1Data:', member1Data);
    console.log('member2Data:', member2Data);

    const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
    console.log("✅ Authority wallet already funded, skipping airdrop...");

    const createKey = Keypair.generate();
    const threshold = 2;

    // Debug all arguments
    console.log('DEBUG: connection:', typeof connection, connection ? 'ok' : 'undefined');
    console.log('DEBUG: creator:', typeof authority, authority ? 'ok' : 'undefined');
    console.log('DEBUG: createKey:', typeof createKey, createKey ? 'ok' : 'undefined');
    console.log('DEBUG: threshold:', typeof threshold, threshold);
    console.log('DEBUG: members:', Array.isArray(members), members.map(m => m ? m.toBase58() : 'undefined'));
    console.log('DEBUG: timeLock:', typeof 0, 0);

    console.log("Sending transaction to create multisig...");
    const { multisigPda, vaultPda, vaultBump } = await multisig.rpc.multisigCreate({
        connection,
        creator: authority,
        createKey,
        threshold,
        members,
        timeLock: 0,
    });

    console.log("Multisig created successfully!");
    console.log("  Multisig PDA:", multisigPda.toBase58());
    console.log("  Vault PDA:", vaultPda.toBase58());

    const multisigInfo = {
        address: multisigPda.toBase58(),
        threshold,
        members: members.map(m => m.toBase58())
    };
    fs.writeFileSync(path.join(walletsDir, 'multisig-info.json'), JSON.stringify(multisigInfo, null, 2));
    console.log("✅ Multisig info saved.");


    const fundArweaveWallet = require('./utils/fund-arweave-wallet');

    const jwkPath = process.argv[2] || path.resolve(process.cwd(), 'testing/wallets/arweave-wallet.json');
    await fundArweaveWallet(jwkPath);

    console.log("\n\n🚨🚨🚨 ACTION REQUIRED 🚨🚨🚨");
    console.log("Setup is almost complete. You must perform one manual step:");
    console.log("1. Open the '.env' file in your project root.");
    console.log(`2. Find the line 'MULTISIG_PDA=""'`);
    console.log(`3. Paste the Multisig PDA into the quotes: MULTISIG_PDA=\"${multisigPda.toBase58()}\"`);
    console.log("----------------------------------------------");
    console.log("\n⚠️  NOTE: This is a simplified multisig setup. For production, you'll need to implement proper multisig creation.");
}

masterSetup().catch(err => {
    console.error("\n❌ SETUP FAILED:", err);
}); 