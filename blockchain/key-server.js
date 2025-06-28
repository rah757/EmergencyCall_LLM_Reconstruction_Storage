console.log('DEBUG: This is the key-server.js you are editing!');

const express = require('express');
const { PublicKey, Connection } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const bs58 = require('bs58').default;
const fs = require('fs').promises;
const path = require('path');
const multisig = require('@sqds/multisig');
const sodium = require('libsodium-wrappers');

const app = express();
app.use(express.json());

// Get port from command line arguments
const port = process.argv[2];
if (!port) {
    console.error("Please provide a port number. Usage: node key-server.js <port>");
    process.exit(1);
}

// Each server gets its own unique storage file based on its port
const STORAGE_FILE = path.resolve(__dirname, `key_share_storage_port_${port}.json`);
let shareStore = {};

// Hardcode Solana RPC URL to devnet
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

// Key retention settings
const KEY_RETENTION_MONTHS = +(process.env.KEY_RETENTION_MONTHS || 12);

/**
 * Loads the key share store from its JSON file on disk.
 * If the file doesn't exist, it initializes an empty store.
 */
const loadStore = async () => {
    try {
        const data = await fs.readFile(STORAGE_FILE, 'utf8');
        shareStore = JSON.parse(data);
        console.log(`[Key Server ${port}] Loaded existing shares from ${path.basename(STORAGE_FILE)}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`[Key Server ${port}] No storage file found. Initializing a new one.`);
            shareStore = {};
        } else {
            console.error(`[Key Server ${port}] Error loading store:`, error);
        }
    }
};

/**
 * Persists the current in-memory key share store to its JSON file.
 */
const persistStore = async () => {
    try {
        await fs.writeFile(STORAGE_FILE, JSON.stringify(shareStore, null, 2));
    } catch (error) {
        console.error(`[Key Server ${port}] Error persisting store:`, error);
    }
};

/**
 * Prune epochs older than KEY_RETENTION_MONTHS
 */
const pruneOldEpochs = () => {
    const epochs = Object.keys(shareStore).sort();     // YYYY-MM sort works
    while (epochs.length > KEY_RETENTION_MONTHS) {
        const oldEpoch = epochs.shift();
        delete shareStore[oldEpoch];
        console.log(`[Key Server ${port}] Pruned old epoch: ${oldEpoch}`);
    }
};

// --- ROUTES ---

// Store an epoch key share
app.post('/storeEpochShare', async (req, res) => {
    const { epochId, share } = req.body;
    if (!epochId || !share) {
        return res.status(400).json({ message: 'epochId and share are required.' });
    }
    
    shareStore[epochId] = share;
    pruneOldEpochs();
    await persistStore();
    
    console.log(`[Key Server ${port}] Stored share for epoch ${epochId}`);
    res.status(200).json({ message: 'Epoch share stored successfully.' });
});

// Legacy route for backward compatibility
app.post('/storeShare', async (req, res) => {
    const { transactionId, share } = req.body;
    if (!transactionId || !share) {
        return res.status(400).json({ message: 'transactionId and share are required.' });
    }
    shareStore[transactionId] = share;
    await persistStore();
    res.status(200).json({ message: 'Share stored successfully.' });
});

// Retrieve a key share (on-chain gated, POST)
app.post('/getShare', async (req, res) => {
    console.log(`[Key Server ${port}] /getShare called`);
    const { requesterPublicKey, signature, epochId, transactionId } = req.body;
    
    // Support both new epochId and legacy transactionIndex for backward compatibility
    const shareKey = epochId || transactionId;
    
    if (!requesterPublicKey || !signature || !shareKey) {
        return res.status(400).json({ message: 'requesterPublicKey, signature, and epochId (or transactionId) are required.' });
    }

    // 1. Verify signature (requester signs the shareKey as message)
    try {
        const message = Buffer.from(shareKey);
        const signatureBytes = bs58.decode(signature);
        const publicKeyBytes = new PublicKey(requesterPublicKey).toBytes();
        if (!nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes)) {
            return res.status(401).json({ message: 'Invalid signature.' });
        }
    } catch (e) {
        return res.status(400).json({ message: 'Signature verification failed.' });
    }

    // 2. On-chain check: For epochs, we still need multisig verification
    // You can modify this logic based on your access control requirements
    try {
        if (req.body.multisigAddress && req.body.transactionIndex) {
            const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
            const multisigPda = new PublicKey(req.body.multisigAddress);
            const [proposalPda] = multisig.getProposalPda({
                multisigPda,
                transactionIndex: BigInt(req.body.transactionIndex)
            });
            const proposalAccount = await multisig.accounts.Proposal.fromAccountAddress(connection, proposalPda);
            if (proposalAccount.status.__kind !== 'Executed') {
                return res.status(403).json({ message: 'Proposal not executed.' });
            }
            
            // Check if requester is a multisig member
            const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);
            
            const isMember = multisigAccount.members.some(m => {
                let pk;
                if (typeof m === 'string') {
                    pk = m;
                } else if (m && m.key) {
                    pk = typeof m.key === 'string' ? m.key : m.key.toString();
                } else if (m && typeof m.toBase58 === 'function') {
                    pk = m.toBase58();
                } else if (m && typeof m.toString === 'function') {
                    pk = m.toString();
                } else {
                    pk = '[unknown]';
                }
                
                return pk === requesterPublicKey;
            });
            
            if (!isMember) {
                return res.status(403).json({ message: 'Requester is not a multisig member.' });
            }
        }
    } catch (e) {
        return res.status(500).json({ message: 'On-chain check failed.', error: e.message });
    }

    // 3. Return the sealed share if all checks pass
    const share = shareStore[shareKey];
    if (share) {
        try {
            // Seal the share for the requester using their Solana public key
            await sodium.ready;
            // Convert requester Ed25519 public key -> Curve25519
            const edPubKeyBytes = bs58.decode(requesterPublicKey);
            const curvePubKey = sodium.crypto_sign_ed25519_pk_to_curve25519(edPubKeyBytes);
            const sealed = sodium.crypto_box_seal(Buffer.from(share, 'utf8'), curvePubKey);
            const sealedB64 = Buffer.from(sealed).toString('base64');
            res.status(200).json({ sealedShare: sealedB64 });
        } catch (e) {
            console.error(`[Key Server ${port}] Error sealing share:`, e.message);
            res.status(500).json({ message: 'Failed to seal share.' });
        }
    } else {
        res.status(404).json({ message: 'Share not found.' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`[Key Server ${port}] is running on http://localhost:${port}`);
    loadStore();
});
