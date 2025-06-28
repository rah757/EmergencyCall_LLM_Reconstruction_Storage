const accessControlService = require('./access-control.service');

// Controller to get the wallet's public key
function getWallet(req, res) {
    try {
        const publicKey = accessControlService.getWalletPublicKey();
        res.status(200).json({ publicKey });
    } catch (error) {
        res.status(500).json({ message: 'Error getting wallet public key.', error: error.message });
    }
}

// Controller to get the wallet's balance
async function getBalance(req, res) {
    try {
        const balance = await accessControlService.getBalance();
        res.status(200).json({ balance_SOL: balance });
    } catch (error) {
        res.status(500).json({ message: 'Error getting wallet balance.', error: error.message });
    }
}

module.exports = {
    getWallet,
    getBalance,
};