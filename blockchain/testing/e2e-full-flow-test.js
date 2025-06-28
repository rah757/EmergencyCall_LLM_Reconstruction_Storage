const storageService = require('../src/components/storage/storage.service');
const KeyDistributionService = require('../src/components/key-distribution/key-distribution.service');
const { Keypair } = require('@solana/web3.js');

// NOTE: This test requires the key servers to be running.
describe('Full E2E System Test', () => {
    it('should store, distribute, reconstruct, and retrieve a document successfully', async () => {
        const dummyWallet = Keypair.generate();
        const keyDistService = new KeyDistributionService(dummyWallet);

        const originalDocument = { message: "This is the final test", timestamp: Date.now() };
        const masterKey = crypto.randomBytes(32);
        
        // 1. Encrypt data
        const { iv, encryptedData } = storageService.encrypt(masterKey, JSON.stringify(originalDocument));
        const dataToStore = Buffer.concat([iv, encryptedData]);
        const transactionId = `e2e-test-${Date.now()}`;

        // 2. Distribute key
        const distributionResult = await keyDistService.splitAndDistributeKey(transactionId, masterKey);
        expect(distributionResult.successful).toBe(4);

        // 3. Reconstruct key
        const reconstructedKey = await keyDistService.reconstructKey(transactionId);
        expect(reconstructedKey).toEqual(masterKey);

        // 4. Decrypt data
        const decrypted = storageService.decrypt(reconstructedKey, dataToStore.slice(0, 16), dataToStore.slice(16));
        const finalDocument = JSON.parse(decrypted);

        expect(finalDocument).toEqual(originalDocument);
    }, 30000);
});