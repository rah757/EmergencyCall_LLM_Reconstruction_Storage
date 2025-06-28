const axios = require('axios');

async function retrieveDocument(arweaveId) {
    try {
        console.log(`Retrieving document with Arweave ID: ${arweaveId}`);
        
        const response = await axios.get(`http://localhost:3000/storage/retrieve/${arweaveId}`);
        
        console.log('Document retrieved successfully!');
        console.log('Document content:', response.data);
        
        return response.data;
    } catch (error) {
        console.error('Error retrieving document:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        throw error;
    }
}

// Command-line execution logic
if (require.main === module) {
    const arweaveId = process.argv[2];
    if (!arweaveId) {
        console.error('Usage: node scripts/storage/retrieve-document.js <arweave_id>');
        process.exit(1);
    }
    retrieveDocument(arweaveId);
}

module.exports = retrieveDocument; 