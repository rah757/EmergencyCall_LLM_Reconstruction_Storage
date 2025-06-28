const fs = require('fs');
const secrets = require('secrets.js-grempe');

const transactionId = 'QIuEytoYIGsuhu-xMJm23XIgwZiyKUV13PGpCcUcXsA';

// Read shares from all key servers
const shares = [];
for (let port = 3010; port <= 3013; port++) {
    try {
        const storageFile = `key_share_storage_port_${port}.json`;
        const data = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
        if (data[transactionId]) {
            shares.push(data[transactionId]);
            console.log(`Port ${port}: ${data[transactionId]}`);
        } else {
            console.log(`Port ${port}: No share found for transaction ${transactionId}`);
        }
    } catch (e) {
        console.log(`Port ${port}: Error reading storage file - ${e.message}`);
    }
}

console.log(`\nFound ${shares.length} shares for transaction ${transactionId}`);

if (shares.length >= 3) {
    const reconstructedKeyHex = secrets.combine(shares);
    console.log('Reconstructed key (hex):', reconstructedKeyHex);
    console.log('Reconstructed key length:', Buffer.from(reconstructedKeyHex, 'hex').length, 'bytes');
} else {
    console.log('Insufficient shares to reconstruct key');
} 