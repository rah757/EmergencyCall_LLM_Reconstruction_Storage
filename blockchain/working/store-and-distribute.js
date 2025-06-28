const axios = require('axios');
const secrets = require('secrets.js-grempe');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Arweave = require('arweave');
const { getCurrentEpochId } = require('../src/core/key-rotation.service');

const KEY_SERVER_URLS = process.env.KEY_SERVER_URLS
    ? process.env.KEY_SERVER_URLS.split(',')
    : [
        'http://localhost:3010',
        'http://localhost:3011',
        'http://localhost:3012',
        'http://localhost:3013',
    ];

// Arweave local (arlocal) settings
const AR_HOST = process.env.ARWEAVE_HOST || 'localhost';
const AR_PORT = process.env.ARWEAVE_PORT || 1984;
const AR_PROTOCOL = process.env.ARWEAVE_PROTOCOL || 'http';

const arweave = Arweave.init({ host: AR_HOST, port: AR_PORT, protocol: AR_PROTOCOL });
// Path to the arweave wallet JSON
const AR_WALLET_PATH = process.env.ARWEAVE_WALLET_FILE || path.resolve(__dirname, '../testing/wallets/arweave-wallet.json');

// Load multisig address from JSON file (kept for reference, not used here directly)
const multisigInfo = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../testing/wallets/multisig-info.json'), 'utf8'));
const MULTISIG_ADDRESS = multisigInfo.address;

async function storeDocument() {
    try {
        console.log('Storing document with current epoch encryption...');
        
        const epochId = getCurrentEpochId();
        console.log('Current epoch:', epochId);
        
        const dummyData = {
            documentId: `doc_${Math.floor(Math.random() * 10000)}`,
            content: "This is a test document for verification.",
            timestamp: new Date().toISOString(),
            epochId: epochId
        };

        // For now, store as plaintext - encryption will happen when epoch key is reconstructed
        // In production, you'd reconstruct the epoch key here to encrypt
        const payload = Buffer.from(JSON.stringify(dummyData));

        // Store document directly on Arweave with epoch tag
        const arWallet = JSON.parse(fs.readFileSync(AR_WALLET_PATH, 'utf8'));
        const tx = await arweave.createTransaction({ data: payload }, arWallet);
        
        // Tag with epoch for later retrieval
        tx.addTag('key-epoch', epochId);
        tx.addTag('App-Name', 'Solana-RBAC-Storage-Epoch');
        
        await arweave.transactions.sign(tx, arWallet);
        await arweave.transactions.post(tx);
        
        console.log('✅ Document stored on Arweave');
        console.log('Transaction ID:', tx.id);
        console.log('Epoch ID:', epochId);
        console.log(`\nFor retrieval, use: node working/requesterCode.js <proposalIndex> ${tx.id} ${epochId}`);
        
    } catch (e) {
        console.error('Error in storeDocument:', e.message);
    }
}

storeDocument(); 