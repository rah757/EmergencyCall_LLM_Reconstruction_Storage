const Arweave = require('arweave');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function fundArweaveWallet(jwkPath, amountWinston = '1000000000000') {
    const arweave = Arweave.init({
        host: 'localhost',
        port: 1984,
        protocol: 'http'
    });
    const jwk = JSON.parse(fs.readFileSync(jwkPath, 'utf8'));
    const address = await arweave.wallets.jwkToAddress(jwk);

    const url = `http://localhost:1984/mint/${address}/${amountWinston}`;
    console.log(`Funding Arweave wallet ${address} with ${amountWinston} winston...`);
    const res = await axios.get(url);
    
    // Check if funding was successful (response should be a number)
    if (res.data && !isNaN(res.data)) {
        console.log(`✅ Wallet funded successfully! New balance: ${res.data} winston`);
        return address;
    } else {
        console.log('⚠️  Funding response:', res.data);
        throw new Error('Failed to fund wallet');
    }
}

// If run directly, fund the default wallet
if (require.main === module) {
    const jwkPath = process.argv[2] || path.resolve(process.cwd(), 'testing/wallets/arweave-wallet.json');
    fundArweaveWallet(jwkPath).catch(console.error);
}

module.exports = fundArweaveWallet;