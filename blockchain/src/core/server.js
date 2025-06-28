require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');

const storageRoutes = require('../components/storage/storage.routes');
const accessControlRoutes = require('../components/access-control/access-control.routes');
const { initializeStorageService } = require('../components/storage/storage.service');
const keyDistributionRoutes = require('../components/key-distribution/key-distribution.routes');
const { KeyDistributionService } = require('../components/key-distribution/key-distribution-service');
const { setKeyDistributionService } = require('../components/key-distribution/key-distribution.controller');

const app = express();
app.use(cors());
app.use(express.json());

// --- Main Application Start Function ---
async function startServer() {
    // FIXED: Await the storage service initialization before starting the server.
    await initializeStorageService();
    console.log("All services initialized. Starting API server...");

    // --- Initialize Key Distribution Service ---
    const keyDistributionService = new KeyDistributionService();
    setKeyDistributionService(keyDistributionService);

    // Mount routes after services are ready
    app.use('/storage', storageRoutes);
    app.use('/access-control', accessControlRoutes);
    app.use('/key-distribution', keyDistributionRoutes);

    app.get('/health', (req, res) => {
        res.status(200).send({ status: 'healthy', services: ['Storage', 'AccessControl', 'KeyDistribution'] });
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`API Server is running on port ${PORT}`);
    });
}

startServer().catch(err => {
    console.error("❌ FATAL: Failed to start server.", err);
    process.exit(1);
});
