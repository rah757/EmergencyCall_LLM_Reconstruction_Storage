const storageService = require('./storage.service');

// Controller to handle the request and response for storing data
async function store(req, res) {
    try {
        const { data } = req.body;
        if (!data) {
            return res.status(400).json({ message: 'No data provided to store.' });
        }
        const result = await storageService.storeData(data);
        res.status(201).json(result);
    } catch (error) {
        console.error('Storage Controller Error:', error);
        res.status(500).json({ message: 'Failed to store data.', error: error.message });
    }
}

// Controller to handle retrieving data
async function retrieve(req, res) {
    try {
        const { transactionId } = req.params;
        const data = await storageService.retrieveData(transactionId);
        if (data) {
            res.status(200).json(data);
        } else {
            res.status(404).json({ message: 'Data not found.' });
        }
    } catch (error) {
        console.error('Retrieval Controller Error:', error);
        res.status(500).json({ message: 'Failed to retrieve data.', error: error.message });
    }
}

// Controller to handle retrieving data and re-encrypting for requester
async function retrieveSealed(req, res) {
    try {
        const { transactionId, requesterPublicKey } = req.body;
        if (!transactionId || !requesterPublicKey) {
            return res.status(400).json({ message: 'transactionId and requesterPublicKey are required.' });
        }
        const data = await storageService.retrieveData(transactionId);
        const sealed = await storageService.reencryptForRequester(data, requesterPublicKey);
        res.status(200).json({ ciphertext: sealed });
    } catch (error) {
        console.error('Sealed Retrieval Controller Error:', error);
        res.status(500).json({ message: 'Failed to retrieve and seal data.', error: error.message });
    }
}

module.exports = {
    store,
    retrieve,
    retrieveSealed,
};