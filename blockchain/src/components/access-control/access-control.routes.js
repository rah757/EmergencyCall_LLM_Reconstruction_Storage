const express = require('express');
const router = express.Router();
const accessControlController = require('./access-control.controller');

// Get wallet public key
router.get('/wallet', accessControlController.getWallet);

// Get wallet balance
router.get('/balance', accessControlController.getBalance);

module.exports = router;