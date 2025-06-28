const storageService = require('../src/components/storage/storage.service');
const keyDistributionService = require('../src/components/key-distribution/key-distribution.service');
const crypto = require('crypto');

describe('End-to-End Document Storage and Retrieval', () => {
    it('should correctly store, distribute, reconstruct, and decrypt a document', async () => {
        // 1. Define dummy data
        const originalDocument = { id: 123, data: "top secret info" };
        const masterKey = crypto.randomBytes(32);

        // 2. Mock the Arweave storage part
        const encrypted = storageService.encrypt(masterKey, JSON.stringify(originalDocument));
        
        // 3. Test distribution
        const transactionId = `test-tx-${Date.now()}`;
        await keyDistributionService.splitAndDistributeKey(transactionId, masterKey);
        
        // 4. Test reconstruction
        const reconstructedKey = await keyDistributionService.reconstructKey(transactionId);
        expect(reconstructedKey).toEqual(masterKey);

        // 5. Test decryption
        const decrypted = storageService.decrypt(reconstructedKey, encrypted.iv, encrypted.encryptedData);
        const finalDocument = JSON.parse(decrypted);

        expect(finalDocument).toEqual(originalDocument);
    }, 30000); // 30s timeout for async operations
});