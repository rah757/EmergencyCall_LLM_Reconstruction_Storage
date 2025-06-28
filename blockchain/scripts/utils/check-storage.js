const Arweave = require('arweave');
const axios = require('axios');

const arweave = Arweave.init({
    host: 'localhost',
    port: 1984,
    protocol: 'http'
});

async function checkStorage(transactionId) {
    if (!transactionId) {
        console.error("Please provide an Arweave transaction ID.");
        return;
    }
    try {
        console.log(`Checking storage for transaction: ${transactionId}`);

        // 1. Check Arweave directly
        const tx = await arweave.transactions.get(transactionId);
        const data = tx.get('data', { decode: true, string: false });
        console.log("✅ Data found on Arweave.");
        console.log("  - Data size:", data.byteLength, "bytes");

        // 2. Check if key shares exist on key servers
        console.log("\nChecking for key shares on servers...");
        const keyServerUrls = ['http://localhost:3010', 'http://localhost:3011', 'http://localhost:3012', 'http://localhost:3013'];
        let sharesFound = 0;
        for (const url of keyServerUrls) {
            try {
                await axios.get(`${url}/getShare/${transactionId}`);
                console.log(`  ✅ Share found on ${url}`);
                sharesFound++;
            } catch (e) {
                console.log(`  ❌ Share NOT found on ${url}`);
            }
        }
        console.log(`\nFound ${sharesFound}/4 key shares.`);
        if (sharesFound >= 3) {
            console.log("✅ System is healthy. Key can be reconstructed.");
        } else {
            console.log("⚠️ WARNING: Not enough shares to reconstruct the key.");
        }

    } catch (error) {
        console.error("Failed to check storage:", error.message);
    }
}

const txId = process.argv[2];
checkStorage(txId);