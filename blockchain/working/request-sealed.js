const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sodium = require('libsodium-wrappers');
const bs58 = require('bs58').default;

const API_BASE_URL = 'http://localhost:3000';
const requesterWalletPath = path.resolve(__dirname, '../testing/wallets/member-wallet-1.json');

// Get the Arweave transaction ID from CLI
const transactionId = process.argv[2];
if (!transactionId) {
    console.error('Usage: node request-sealed.js <arweave_transaction_id>');
    process.exit(1);
}

// Load requester wallet public & private key
const requesterWallet = JSON.parse(fs.readFileSync(requesterWalletPath, 'utf8'));
const requesterPublicKey = requesterWallet.publicKey;
const requesterPrivateKey = requesterWallet.privateKey;

async function requestSealedDocument() {
    try {
        console.log(`Requesting sealed document for Arweave ID: ${transactionId}`);
        const response = await axios.post(`${API_BASE_URL}/storage/retrieve-sealed`, {
            transactionId,
            requesterPublicKey
        });
        const ciphertextBase64 = response.data.ciphertext;
        console.log('\nSealed ciphertext (base64):');
        console.log(ciphertextBase64);
        // Save ciphertext for later decryption
        fs.writeFileSync(path.resolve(__dirname, 'sealed-ciphertext.txt'), ciphertextBase64);
        console.log('\nCiphertext saved to working/sealed-ciphertext.txt');

        // --- Decryption Part ---
        await sodium.ready;
        // Decode keys
        const ed25519PublicKey = bs58.decode(requesterPublicKey);
        const ed25519SecretKey = bs58.decode(requesterPrivateKey);
        let fullEd25519SecretKey, ed25519PubKey;
        if (ed25519SecretKey.length === 32) {
            // If only 32 bytes, derive full keypair
            const keyPair = sodium.crypto_sign_seed_keypair(ed25519SecretKey);
            fullEd25519SecretKey = Buffer.concat([
                Buffer.from(keyPair.privateKey)
            ]);
            ed25519PubKey = Buffer.from(keyPair.publicKey);
        } else if (ed25519SecretKey.length === 64) {
            fullEd25519SecretKey = ed25519SecretKey;
            ed25519PubKey = ed25519PublicKey;
        } else {
            throw new Error('Invalid secret key length. Expected 32 or 64 bytes after Base58 decoding.');
        }
        // Convert to Curve25519
        const curve25519PrivateKey = sodium.crypto_sign_ed25519_sk_to_curve25519(fullEd25519SecretKey);
        const curve25519PublicKey = sodium.crypto_sign_ed25519_pk_to_curve25519(ed25519PubKey);
        // Decrypt
        const ciphertext = Buffer.from(ciphertextBase64, 'base64');
        const decrypted = sodium.crypto_box_seal_open(ciphertext, curve25519PublicKey, curve25519PrivateKey);
        if (!decrypted) {
            console.error('Decryption failed. Check if the correct key pair is used.');
            process.exit(1);
        }
        console.log('\nDecrypted document:');
        console.log(Buffer.from(decrypted).toString('utf8'));
    } catch (error) {
        console.error('Error requesting or decrypting sealed document:', error.response ? error.response.data : error.message);
    }
}

requestSealedDocument(); 