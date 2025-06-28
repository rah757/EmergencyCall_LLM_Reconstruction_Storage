const Arweave = require('arweave');
const fs = require('fs').promises;
const path = require('path');

async function testArweaveStorage() {
    console.log('Testing Arweave storage...');
    
    try {
        // 1. Initialize Arweave
        console.log('1. Initializing Arweave...');
        const arweave = Arweave.init({
            host: 'localhost',
            port: 1984,
            protocol: 'http'
        });
        console.log('✅ Arweave initialized');
        
        // 2. Load wallet
        console.log('2. Loading wallet...');
        const walletPath = path.resolve(__dirname, './testing/wallets/arweave-wallet.json');
        const walletData = JSON.parse(await fs.readFile(walletPath, 'utf8'));
        console.log('✅ Wallet loaded, address:', walletData.addr);
        
        // 3. Check wallet balance
        console.log('3. Checking wallet balance...');
        const balance = await arweave.wallets.getBalance(walletData.addr);
        console.log('✅ Balance:', arweave.ar.winstonToAr(balance), 'AR');
        
        // 4. Create transaction
        console.log('4. Creating transaction...');
        const data = JSON.stringify({ test: 'data', timestamp: Date.now() });
        const transaction = await arweave.createTransaction({ data }, walletData);
        transaction.addTag('App-Name', 'Test-Storage');
        console.log('✅ Transaction created, ID:', transaction.id);
        
        // 5. Sign transaction
        console.log('5. Signing transaction...');
        await arweave.transactions.sign(transaction, walletData);
        console.log('✅ Transaction signed');
        
        // 6. Post transaction
        console.log('6. Posting transaction...');
        const response = await arweave.transactions.post(transaction);
        console.log('✅ Transaction posted, response:', response.status);
        
        // 7. Verify transaction exists
        console.log('7. Verifying transaction...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit
        const txData = await arweave.transactions.getData(transaction.id, { decode: true, string: true });
        console.log('✅ Transaction verified, data:', txData);
        
        console.log('\n🎉 SUCCESS! Arweave storage is working.');
        console.log('Transaction ID:', transaction.id);
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
    }
}

testArweaveStorage(); 