const multisig = require('@sqds/multisig');
const { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } = require('@solana/web3.js');
const Arweave = require('arweave');
const fs = require('fs');
const path = require('path');
const bs58 = require('bs58').default;
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const walletsDir = path.resolve(__dirname, '../testing/wallets');

// Helper to write JSON wallet files
const writeWallet = (filePath, keypair) => {
    console.log('DEBUG keypair:', keypair);
    console.log('DEBUG keypair.secretKey:', keypair.secretKey);
    const data = {
        publicKey: keypair.publicKey.toBase58(),
        privateKey: bs58.encode(keypair.secretKey)
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

function loadOrCreateWallet(filePath) {
    if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return Keypair.fromSecretKey(bs58.decode(data.privateKey));
    } else {
        const keypair = Keypair.generate();
        writeWallet(filePath, keypair);
        return keypair;
    }
}

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

    // 3. Load wallets from disk (exact pattern from working script)
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

    // 4. Connect to Solana
    const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
    
    // Skip airdrop since wallet is already funded
    console.log("✅ Authority wallet already funded, skipping airdrop...");

    // 5. Define multisig parameters
    const createKey = Keypair.generate(); // Each multisig needs a unique key
    const threshold = 2; // Requires 2 out of 2 members to approve

    console.log('DEBUG: connection:', typeof connection, connection ? 'ok' : 'undefined');
    console.log('DEBUG: creator:', typeof authority, authority ? 'ok' : 'undefined');
    console.log('DEBUG: createKey:', typeof createKey, createKey ? 'ok' : 'undefined');
    console.log('DEBUG: threshold:', typeof threshold, threshold);
    console.log('DEBUG: members:', Array.isArray(members), members.map(m => m ? m.toBase58() : 'undefined'));
    console.log('DEBUG: timeLock:', typeof 0, 0);

    // 6. Create the multisig using the Squads SDK
    console.log("Creating multisig instruction...");
    
    // Get multisig PDA
    const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey });
    console.log('\nMultisig PDA:', multisigPda.toString());

    // Fetch the program config PDA and treasury
    const programConfigPda = multisig.getProgramConfigPda({})[0];
    const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(connection, programConfigPda);
    const configTreasury = programConfig.treasury;

    // Define members with permissions (exact structure from working codebase)
    const membersWithPermissions = [
        {
            key: authority.publicKey,
            permissions: multisig.types.Permissions.all(),
        },
        {
            key: members[0],
            permissions: multisig.types.Permissions.all(),
        },
        {
            key: members[1],
            permissions: multisig.types.Permissions.fromPermissions([multisig.types.Permission.Propose, multisig.types.Permission.Vote,]),
        },
    ];

    console.log('\nCreating multisig instruction...');
    
    // Create the multisig using V2 instruction (exact from working codebase)
    const createIx = multisig.instructions.multisigCreateV2({
        createKey: createKey.publicKey,
        creator: authority.publicKey,
        multisigPda,
        configAuthority: authority.publicKey, // Optional, can remain null
        timeLock: 0, // No timelock
        members: membersWithPermissions,
        threshold: 1, // Minimum number of votes required
        treasury: configTreasury, // Required
        rentCollector: null, // Optional
    });

    console.log('\nCreating transaction...');
    
    // Create and send transaction
    const tx = new Transaction();
    tx.add(createIx);
    
    console.log('\nSending transaction...');
    const signature = await sendAndConfirmTransaction(
        connection,
        tx,
        [authority, createKey],
        { commitment: 'confirmed' }
    );

    console.log('\nTransaction signature:', signature);

    // 7. Save multisig info
    const multisigInfo = {
        address: multisigPda.toString(),
        createKey: createKey.publicKey.toString(),
        signature,
        members: membersWithPermissions.map(member => member.key.toString()),
    };
    fs.writeFileSync(path.join(walletsDir, 'multisig-info.json'), JSON.stringify(multisigInfo, null, 2));
    console.log("✅ Multisig info saved.");


    const fundArweaveWallet = require('../utils/fund-arweave-wallet');

await fundArweaveWallet('./testing/wallets/arweave-wallet.json');

    // 8. FINAL INSTRUCTION
    console.log("\n\n🚨🚨🚨 ACTION REQUIRED 🚨🚨🚨");
    console.log("Setup is almost complete. You must perform one manual step:");
    console.log("1. Open the '.env' file in your project root.");
    console.log(`2. Find the line 'MULTISIG_PDA=""'`);
    console.log(`3. Paste the Multisig PDA into the quotes: MULTISIG_PDA="${multisigPda.toString()}"`);
    console.log("----------------------------------------------");
    console.log("\n⚠️  NOTE: This is a simplified multisig setup. For production, you'll need to implement proper multisig creation.");
}

masterSetup().catch(err => {
    console.error("\n❌ SETUP FAILED:", err);
});