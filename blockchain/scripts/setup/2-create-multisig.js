const { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } = require('@solana/web3.js');
const multisig = require('@sqds/multisig');
const fs = require('fs');
const path = require('path');
const bs58 = require('bs58').default;
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function createMultisig() {
    try {
        console.log("Starting multisig creation...");

        // 1. Load wallets from the testing/wallets directory
        const walletsDir = path.resolve(__dirname, '../../testing/wallets');
        const authorityWalletData = JSON.parse(fs.readFileSync(path.join(walletsDir, 'authority-wallet.json'), 'utf8'));
        const member1Data = JSON.parse(fs.readFileSync(path.join(walletsDir, 'member-wallet-1.json'), 'utf8'));
        const member2Data = JSON.parse(fs.readFileSync(path.join(walletsDir, 'member-wallet-2.json'), 'utf8'));

        const authority = Keypair.fromSecretKey(bs58.decode(authorityWalletData.privateKey));
        const members = [member1Data.publicKey, member2Data.publicKey];
        
        console.log("Wallets loaded:");
        console.log("  Authority:", authority.publicKey.toBase58());
        console.log("  Members:", members);

        // 2. Connect to Solana and airdrop SOL to the authority if needed
        const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
        
        console.log("Airdropping 2 SOL to authority wallet to cover fees...");
        const airdropSignature = await connection.requestAirdrop(authority.publicKey, 2 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(airdropSignature, 'confirmed');
        console.log("Airdrop confirmed.");

        // 3. Define multisig parameters
        const createKey = Keypair.generate(); // Each multisig needs a unique key
        const threshold = 2; // Requires 2 out of 2 members to approve

        // 4. Create the multisig using the Squads SDK
        console.log("Sending transaction to create multisig...");
        const { multisigPda, vaultPda, vaultBump } = await multisig.rpc.multisigCreate({
            connection,
            creator: authority,
            createKey,
            threshold,
            members,
            timeLock: 0, // No time lock
        });

        console.log("Multisig created successfully!");
        console.log("  Multisig PDA:", multisigPda.toBase58());
        console.log("  Vault PDA:", vaultPda.toBase58());

        // 5. Save the multisig info for other scripts to use
        const multisigInfo = {
            address: multisigPda.toBase58(),
            vaultAddress: vaultPda.toBase58(),
            createKey: createKey.publicKey.toBase58(),
            threshold,
            members,
        };
        fs.writeFileSync(path.join(walletsDir, 'multisig-info.json'), JSON.stringify(multisigInfo, null, 2));
        console.log("Multisig info saved to testing/wallets/multisig-info.json");

    } catch (error) {
        console.error("Error creating multisig:", error.message);
    }
}

createMultisig();

const pk = new PublicKey('D66ELXd8kWu6Qu45T2zDJLot7ghPFAK7dNwkr6YQzGUT');
console.log(pk.toBase58());