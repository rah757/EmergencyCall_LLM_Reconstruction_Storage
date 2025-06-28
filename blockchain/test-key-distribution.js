require('dotenv').config();
const KeyDistributionService = require('./src/components/key-distribution/key-distribution-service');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58').default;
const fs = require('fs');
const path = require('path');

async function testKeyDistribution() {
    try {
        console.log('Testing Key Distribution Service...');

        // Load the authority wallet
        const walletPath = path.resolve('./testing/wallets/authority-wallet.json');
        const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        const secretKey = bs58.decode(walletData.privateKey);
        const authorityWallet = Keypair.fromSecretKey(secretKey);
        console.log('✅ Authority wallet loaded:', authorityWallet.publicKey.toString());

        // Initialize the key distribution service
        const keyDistributionService = new KeyDistributionService(authorityWallet);
        console.log('✅ Key Distribution Service initialized');

        // Test transaction ID
        const transactionId = 'JKqgxJDTRg2ngxHmiXtbFnk4JMnkulNtwzUkUZM3PVI';
        const testKey = Buffer.from('test-key-32-bytes-long-for-testing', 'utf8');

        console.log('\n--- Testing Key Distribution ---');
        console.log('Transaction ID:', transactionId);
        console.log('Test key length:', testKey.length);

        // Test key distribution
        const distributionResult = await keyDistributionService.splitAndDistributeKey(transactionId, testKey);
        console.log('Distribution result:', distributionResult);

        // Wait a moment for the shares to be stored
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('\n--- Testing Key Reconstruction ---');
        
        // Test key reconstruction
        const reconstructedKey = await keyDistributionService.reconstructKey(transactionId);
        console.log('Reconstructed key length:', reconstructedKey.length);
        console.log('Original key:', testKey.toString('hex'));
        console.log('Reconstructed key:', reconstructedKey.toString('hex'));
        console.log('Keys match:', testKey.equals(reconstructedKey));

        if (testKey.equals(reconstructedKey)) {
            console.log('✅ Key distribution and reconstruction successful!');
        } else {
            console.log('❌ Key reconstruction failed!');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testKeyDistribution(); 