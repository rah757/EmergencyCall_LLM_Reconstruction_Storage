const axios = require('axios');
const API_BASE_URL = 'http://localhost:3000';

async function storeDummyDocument() {
    try {
        console.log('Storing a dummy test document...');
        const dummyData = {
            documentId: `doc_${Math.floor(Math.random() * 10000)}`,
            content: "This is a test document for verification.",
            timestamp: new Date().toISOString(),
        };
        const response = await axios.post(`${API_BASE_URL}/storage/store`, {
            data: dummyData
        });
        console.log('API Response:', response.data);
        console.log(`\nSUCCESS! Document stored.`);
        console.log(`Use this Arweave ID to create a proposal: ${response.data.transactionId}`);
    } catch (error) {
        console.error('Error storing document:', error.response ? error.response.data : error.message);
    }
}

storeDummyDocument();