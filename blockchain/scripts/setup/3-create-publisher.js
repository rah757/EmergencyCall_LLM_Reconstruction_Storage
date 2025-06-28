const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const bs58 = require('bs58').default;

console.log("Creating Publisher wallet...");

const outputDir = path.resolve(__dirname, '../../testing/wallets');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const publisher = Keypair.generate();
const publisherData = {
    publicKey: publisher.publicKey.toBase58(),
    privateKey: bs58.encode(publisher.secretKey)
};

const walletPath = path.join(outputDir, 'publisher-wallet.json');
fs.writeFileSync(walletPath, JSON.stringify(publisherData, null, 2));

console.log(`Publisher wallet created: ${publisher.publicKey.toBase58()}`);
console.log(`Saved to: ${walletPath}`);