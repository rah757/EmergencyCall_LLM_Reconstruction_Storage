const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function checkBalances() {
    const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
    const walletsDir = path.resolve(__dirname, '../../testing/wallets');
    const files = fs.readdirSync(walletsDir);

    console.log("--- Checking Wallet Balances ---");

    for (const file of files) {
        if (file.endsWith('.json')) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(walletsDir, file), 'utf8'));
                if (data.publicKey) {
                    const publicKey = new PublicKey(data.publicKey);
                    const balance = await connection.getBalance(publicKey);
                    console.log(`${file.padEnd(25)} | ${publicKey.toBase58()} | ${balance / LAMPORTS_PER_SOL} SOL`);
                }
            } catch (error) {
                // Ignore files that aren't wallets
            }
        }
    }
}

checkBalances();