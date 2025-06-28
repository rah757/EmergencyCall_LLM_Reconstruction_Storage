const axios = require('axios');
const Arweave = require('arweave');
const crypto = require('crypto');
const secrets = require('secrets.js-grempe');
const bs58 = require('bs58').default;
const nacl = require('tweetnacl');
const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');
const sodium = require('libsodium-wrappers');

const KEY_SERVER_URLS = process.env.KEY_SERVER_URLS
    ? process.env.KEY_SERVER_URLS.split(',').map(port => `http://localhost:${port}`)
    : [
        'http://localhost:3010',
        'http://localhost:3011',
        'http://localhost:3012',
        'http://localhost:3013',
        'http://localhost:3014',
        'http://localhost:3015',
        'http://localhost:3016',
    ];

const ARWEAVE_HOST = process.env.ARWEAVE_HOST || 'localhost';
const ARWEAVE_PORT = process.env.ARWEAVE_PORT || 1984;
const ARWEAVE_PROTOCOL = process.env.ARWEAVE_PROTOCOL || 'http';

// Load multisig address from JSON file
const multisigInfo = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../testing/wallets/multisig-info.json'), 'utf8'));
const MULTISIG_ADDRESS = multisigInfo.address;
const REQUESTER_WALLET_PATH = path.resolve(__dirname, '../testing/wallets/member-wallet-1.json');

// Usage: node requesterCode.js <transactionIndex> <transactionId> <epochId>
const [,, transactionIndex, transactionId, epochId] = process.argv;
if (!transactionIndex || !transactionId || !epochId) {
    console.error('Usage: node requesterCode.js <transactionIndex> <transactionId> <epochId>');
    process.exit(1);
}

function signMessage(keypair, message) {
    const messageBytes = Buffer.from(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    return bs58.encode(signature);
}

async function fetchAndDecryptDocument(keyHex, transactionId) {
    const arweave = Arweave.init({
        host: ARWEAVE_HOST,
        port: ARWEAVE_PORT,
        protocol: ARWEAVE_PROTOCOL
    });
    
    console.log('Fetching data from Arweave...');
    const txData = await arweave.transactions.getData(transactionId, { decode: true, string: false });
    
    // For now, data might be stored as plaintext (see store script)
    // In production with encryption, you'd decrypt here:
    /*
    const IV_LENGTH = 16;
    const iv = txData.slice(0, IV_LENGTH);
    const encryptedData = txData.slice(IV_LENGTH);
    const key = Buffer.from(keyHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    */
    
    try {
        const document = JSON.parse(txData.toString());
        console.log('Retrieved document:', document);
        return document;
    } catch (e) {
        console.log('Retrieved data (not JSON):', txData.toString());
        return txData.toString();
    }
}

function loadKeypair(walletPath) {
    const raw = fs.readFileSync(walletPath, 'utf8');
    let secretKey;
    try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
            secretKey = Uint8Array.from(arr);
        } else if (typeof arr === 'string') {
            secretKey = bs58.decode(arr);
        } else if (arr._keypair && arr._keypair.secretKey) {
            secretKey = Uint8Array.from(arr._keypair.secretKey);
        } else if (arr.privateKey) {
            secretKey = bs58.decode(arr.privateKey);
        } else {
            throw new Error('Unknown keypair format');
        }
    } catch (e) {
        throw new Error('Failed to parse keypair: ' + e.message);
    }
    if (secretKey.length !== 64) {
        throw new Error('bad secret key size: ' + secretKey.length);
    }
    return Keypair.fromSecretKey(secretKey);
}

async function retrieveSharesAndDecrypt() {
    const keypair = loadKeypair(REQUESTER_WALLET_PATH);
    const requesterPublicKey = keypair.publicKey.toBase58();
    const signature = signMessage(keypair, epochId);  // Sign the epochId instead of transactionId
    
    console.log('requesterPublicKey:', requesterPublicKey);
    console.log('signature:', signature);
    console.log('transactionIndex:', transactionIndex);
    console.log('multisigAddress:', MULTISIG_ADDRESS);
    console.log('epochId:', epochId);
    console.log('transactionId:', transactionId);
    
    const retrievalPayload = {
        requesterPublicKey,
        signature,
        epochId,
        transactionIndex,  // Still needed for multisig verification
        multisigAddress: MULTISIG_ADDRESS,
        transactionId
    };
    
    // Request shares from all servers in parallel
    const sharePromises = KEY_SERVER_URLS.map(url =>
        axios.post(`${url}/getShare`, retrievalPayload)
            .then(res => res.data.sealedShare || res.data.share)
            .catch(e => {
                console.error(`Failed to get share from ${url}:`, e.response?.data?.message || e.message);
                return null;
            })
    );
    
    const sealedShares = (await Promise.all(sharePromises)).filter(Boolean);
    console.log(`Retrieved ${sealedShares.length} sealed shares`);

    await sodium.ready;
    // Convert ed25519 keys to curve25519 for unsealing
    const edSecret = keypair.secretKey; // 64 bytes
    const curveSk = sodium.crypto_sign_ed25519_sk_to_curve25519(edSecret);
    const curvePk = sodium.crypto_sign_ed25519_pk_to_curve25519(keypair.publicKey.toBytes());

    const shares = [];
    for (const sealedB64 of sealedShares) {
        try {
            const sealedBuf = Buffer.from(sealedB64, 'base64');
            const opened = sodium.crypto_box_seal_open(sealedBuf, curvePk, curveSk);
            shares.push(Buffer.from(opened).toString());
        } catch (e) {
            console.error('Failed to open sealed share:', e.message);
        }
    }

    const threshold = +(process.env.EPOCH_THRESHOLD || 4);
    if (shares.length < threshold) {
        console.error(`Insufficient shares retrieved to reconstruct key (need ${threshold}, got ${shares.length})`);
        process.exit(1);
    }

    // Reconstruct the key
    console.log('Retrieved shares (after unsealing):', shares.length);
    const recoveredKeyHex = secrets.combine(shares);
    console.log('Reconstructed key (hex):', recoveredKeyHex);
    const key = Buffer.from(recoveredKeyHex, 'hex');
    console.log('Key length:', key.length, 'bytes');

    // Fetch and decrypt the document
    await fetchAndDecryptDocument(recoveredKeyHex, transactionId);
}

retrieveSharesAndDecrypt(); 