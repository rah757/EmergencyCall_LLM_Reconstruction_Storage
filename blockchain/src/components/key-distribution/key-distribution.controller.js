const { KeyDistributionService, isProposalExecuted } = require('./key-distribution-service');
const { Connection } = require('@solana/web3.js');

// You may want to load this from config/env
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'http://localhost:8899';

// The key distribution service instance should be initialized elsewhere and passed in, but for now, we can require it here for demo purposes.
let keyDistributionService;

function setKeyDistributionService(service) {
    keyDistributionService = service;
}

// POST /get-key
async function getKey(req, res) {
    try {
        const { transactionIndex, multisigAddress, transactionId } = req.body;
        if (!transactionIndex || !multisigAddress || !transactionId) {
            return res.status(400).json({ message: 'transactionIndex, multisigAddress, and transactionId are required.' });
        }
        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        const executed = await isProposalExecuted(multisigAddress, transactionIndex, connection);
        if (!executed) {
            return res.status(403).json({ message: 'Proposal not executed. Access denied or pending.' });
        }
        const key = await keyDistributionService.reconstructKey(transactionId);
        res.status(200).json({ key: key.toString('base64') });
    } catch (error) {
        console.error('getKey error:', error);
        res.status(500).json({ message: 'Failed to retrieve key.', error: error.message });
    }
}

module.exports = { getKey, setKeyDistributionService }; 