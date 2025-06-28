const express = require('express');
const router = express.Router();
const keyDistributionController = require('./key-distribution.controller');

// POST /get-key
router.post('/get-key', keyDistributionController.getKey);

module.exports = router; 