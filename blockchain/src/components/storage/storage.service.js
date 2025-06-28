const Arweave = require('arweave');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58').default;
const sodium = require('libsodium-wrappers');

const { KeyDistributionService } = require('../key-distribution/key-distribution-service');

// --- Service State ---
let keyDistributionService;
let arweave;

// FIXED: Create an async initialization function to solve the race condition.
async function initializeStorageService() {
    if (keyDistributionService) {
        console.log("Storage Service already initialized.");
        return;
    }

    console.log("Initializing Storage Service...");

    // 1. Load the signing wallet required by the key distribution service.
    const walletPath = path.resolve(__dirname, '../../../testing/wallets/authority-wallet.json');
    const walletData = JSON.parse(await fs.readFile(walletPath, 'utf8'));
    const secretKey = bs58.decode(walletData.privateKey);
    const signingWallet = Keypair.fromSecretKey(secretKey);

    // 2. Initialize the key distribution service with the loaded wallet.
    keyDistributionService = new KeyDistributionService(signingWallet);

    // 3. Initialize the Arweave client.
    arweave = Arweave.init({
        host: process.env.ARWEAVE_HOST,
        port: process.env.ARWEAVE_PORT,
        protocol: process.env.ARWEAVE_PROTOCOL
    });

    console.log("✅ Storage Service Initialized Successfully.");
}


// --- Encryption Functions (Complete Implementation) ---
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function generateEncryptionKey() {
    return crypto.randomBytes(32); // 256-bit key
}

function encrypt(key, data) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key), iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv, encryptedData: encrypted };
}

function decrypt(key, iv, encryptedData) {
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key), Buffer.from(iv));
    let decrypted = decipher.update(Buffer.from(encryptedData));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
// ---

// --- Main Service Functions ---
async function storeData(data) {
    if (!keyDistributionService) throw new Error("Storage Service not initialized. Call initializeStorageService() first.");
    
    const arweaveWallet = JSON.parse(await fs.readFile(process.env.ARWEAVE_WALLET_FILE));
    const masterKey = generateEncryptionKey();
    const { iv, encryptedData } = encrypt(masterKey, JSON.stringify(data));
    const dataToStore = Buffer.concat([iv, encryptedData]);

    const transaction = await arweave.createTransaction({ data: dataToStore }, arweaveWallet);
    transaction.addTag('App-Name', 'Solana-RBAC-Storage-Final');

    await arweave.transactions.sign(transaction, arweaveWallet);
    await arweave.transactions.post(transaction);

    console.log('Distributing key for Arweave ID:', transaction.id); // or arweaveTxId
    await keyDistributionService.splitAndDistributeKey(transaction.id, masterKey);
    console.log('Key distribution complete for:', transaction.id);
    
    return { transactionId: transaction.id };
}

async function retrieveData(transactionId) {
    if (!keyDistributionService) throw new Error("Storage Service not initialized. Call initializeStorageService() first.");

    console.log('Attempting to retrieve data for transaction ID:', transactionId);
    
    try {
        console.log('Reconstructing key...');
        const key = await keyDistributionService.reconstructKey(transactionId);
        console.log('Key reconstructed successfully, length:', key.length);
        
        console.log('Fetching data from Arweave...');
        const txData = await arweave.transactions.getData(transactionId, { decode: true, string: false });
        console.log('Arweave data fetched, length:', txData.length);
        
        const iv = txData.slice(0, IV_LENGTH);
        const encryptedData = txData.slice(IV_LENGTH);
        console.log('IV length:', iv.length, 'Encrypted data length:', encryptedData.length);
        
        console.log('Decrypting data...');
        const decryptedData = decrypt(key, iv, encryptedData);
        console.log('Data decrypted successfully');
        
        return JSON.parse(decryptedData);
    } catch (error) {
        console.error('Error in retrieveData:', error.message);
        throw error;
    }
}

/**
 * Re-encrypts a document for a requester's Solana public key using crypto_box_seal.
 * @param {Object} document - The decrypted document (object or string)
 * @param {string} requesterPublicKeyBase58 - The requester's Solana public key (base58 string)
 * @returns {Promise<string>} - The sealed ciphertext (base64)
 */
async function reencryptForRequester(document, requesterPublicKeyBase58) {
    await sodium.ready;
    const message = typeof document === 'string' ? document : JSON.stringify(document);
    // Decode the requester's Solana public key (Ed25519)
    const ed25519PublicKey = bs58.decode(requesterPublicKeyBase58);
    // Convert Ed25519 public key to Curve25519
    const curve25519PublicKey = sodium.crypto_sign_ed25519_pk_to_curve25519(ed25519PublicKey);
    // Encrypt using crypto_box_seal
    const ciphertext = sodium.crypto_box_seal(message, curve25519PublicKey);
    // Return as base64
    return Buffer.from(ciphertext).toString('base64');
}

module.exports = {
    initializeStorageService,
    storeData,
    retrieveData,
    encrypt,
    decrypt,
    reencryptForRequester
};
