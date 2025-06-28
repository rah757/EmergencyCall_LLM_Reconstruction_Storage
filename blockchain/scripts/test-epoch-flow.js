const { rotateKey, getCurrentEpochId } = require('../src/core/key-rotation.service');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function testEpochFlow() {
    try {
        console.log('🧪 Testing epoch-based key rotation flow...\n');
        
        // 1. Rotate key
        console.log('1. Rotating epoch key...');
        await rotateKey();
        
        const epochId = getCurrentEpochId();
        console.log(`✅ Key rotated for epoch: ${epochId}\n`);
        
        // 2. Store document
        console.log('2. Storing document...');
        const { stdout: storeOutput } = await execAsync('node working/store-and-distribute.js');
        console.log(storeOutput);
        
        // Extract transaction ID from output (you'll need to parse this based on your output format)
        const txMatch = storeOutput.match(/Transaction ID: ([A-Za-z0-9_-]+)/);
        if (!txMatch) {
            throw new Error('Could not extract transaction ID from store output');
        }
        const transactionId = txMatch[1];
        
        console.log(`✅ Document stored with ID: ${transactionId}\n`);
        
        // 3. Test retrieval (you'll need to implement proposal flow here)
        console.log('3. Testing retrieval...');
        console.log(`Run: node working/requesterCode.js <proposalIndex> ${transactionId} ${epochId}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testEpochFlow();