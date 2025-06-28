const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const bs58 = require('bs58').default;

console.log("Starting wallet creation for multisig setup...");

// Define the output directory
const outputDir = path.resolve(__dirname, '../../testing/wallets');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// --- Create Authority Wallet ---
// This wallet will be the creator and initial fee payer for the multisig
const authority = Keypair.generate();
const authorityData = {
    publicKey: authority.publicKey.toBase58(),
    privateKey: bs58.encode(authority.secretKey)
};
fs.writeFileSync(path.join(outputDir, 'authority-wallet.json'), JSON.stringify(authorityData, null, 2));
console.log(`Authority wallet created: ${authority.publicKey.toBase58()}`);


// --- Create Member Wallets ---
const memberWallets = [];
const memberCount = 2; // Create 2 member wallets

for (let i = 1; i <= memberCount; i++) {
    const member = Keypair.generate();
    const memberData = {
        publicKey: member.publicKey.toBase58(),
        privateKey: bs58.encode(member.secretKey)
    };
    const fileName = `member-wallet-${i}.json`;
    fs.writeFileSync(path.join(outputDir, fileName), JSON.stringify(memberData, null, 2));
    memberWallets.push(memberData);
    console.log(`Member ${i} wallet created: ${member.publicKey.toBase58()}`);
}

console.log("\nWallet creation complete!");
console.log(`Files saved in: ${outputDir}`);