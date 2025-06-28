#!/usr/bin/env node
const { rotateKey } = require('../src/core/key-rotation.service');

(async () => {
    try {
        await rotateKey();
        console.log('Key rotation completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Key rotation failed:', error.message);
        process.exit(1);
    }
})();