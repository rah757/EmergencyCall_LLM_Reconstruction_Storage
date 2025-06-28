const express = require('express');
const router = express.Router();
const storageController = require('./storage.controller');

// Route to store data
router.post('/store', storageController.store);

// Route to retrieve data
router.get('/retrieve/:transactionId', storageController.retrieve);

// Route to retrieve sealed (re-encrypted) data for a requester
router.post('/retrieve-sealed', storageController.retrieveSealed);

module.exports = router;