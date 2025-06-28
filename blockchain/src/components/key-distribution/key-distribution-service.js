const secrets = require('secrets.js-grempe');
const axios = require('axios');
const bs58 = require('bs58').default;
const { Connection, PublicKey } = require('@solana/web3.js');
const multisig = require('@sqds/multisig');

// Best Practice: Load configuration from environment variables instead of hardcoding.
// Example .env file:
// KEY_SERVER_URLS="http://localhost:3010,http://localhost:3011,http://localhost:3012,http://localhost:3013"
const KEY_SERVER_URLS = process.env.KEY_SERVER_URLS ? process.env.KEY_SERVER_URLS.split(',') : [];

if (KEY_SERVER_URLS.length !== 4) {
    throw new Error("KEY_SERVER_URLS environment variable must be set with 4 comma-separated URLs.");
}

class KeyDistributionService {
    constructor() {
        // No signing wallet required for storing/distribution
        console.log("Key Distribution Service Initialized (no signing wallet required for storing/distribution)");
    }

    /**
     * Splits a master key and securely distributes the shares to all key servers.
     * No authentication required for storing.
     * @param {string} transactionId The unique identifier for the key.
     * @param {Buffer} masterKey The key to be split and distributed.
     * @returns {Promise<{successful: number, failed: number}>} An object summarizing the distribution outcome.
     */
    async splitAndDistributeKey(transactionId, masterKey) {
        const keyHex = masterKey.toString('hex');
        const shares = secrets.share(keyHex, 4, 3);

        const distributionPromises = shares.map(async (share, index) => {
            const url = KEY_SERVER_URLS[index];
            try {
                // No challenge-response, just send the share
                await axios.post(`${url}/storeShare`, {
                    transactionId,
                    share,
                });
                console.log(`Successfully stored share ${index + 1} on ${url}`);
                return { status: 'fulfilled', server: url };
            } catch (error) {
                console.error(`Failed to store share ${index + 1} on ${url}: ${error.message}`);
                return { status: 'rejected', server: url, reason: error.message };
            }
        });

        const results = await Promise.allSettled(distributionPromises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 'fulfilled').length;
        const failed = results.length - successful;

        console.log(`Distribution complete. Successful: ${successful}, Failed: ${failed}`);
        if (successful < 3) {
            console.warn("WARNING: Fewer than 3 shares were stored successfully. Key may not be recoverable.");
        }
        return { successful, failed };
    }

    /**
     * Retrieves shares in parallel from key servers and reconstructs the master key.
     * @param {string} transactionId The unique identifier.
     * @returns {Promise<Buffer>} The reconstructed master key.
     */
    async reconstructKey(transactionId) {
        // Performance Fix: Query all servers in parallel instead of sequentially.
        const retrievalPromises = KEY_SERVER_URLS.map(url =>
            axios.get(`${url}/getShare/${transactionId}`).catch(err => {
                console.warn(`Could not retrieve share from ${url}: ${err.message}`);
                return null; // Return null on failure instead of throwing
            })
        );

        const responses = await Promise.all(retrievalPromises);

        const retrievedSharesHex = responses
            .filter(res => res && res.data && res.data.share)
            .map(res => res.data.share);

        if (retrievedSharesHex.length < 3) {
            throw new Error(`Insufficient shares retrieved to reconstruct key (need 3, got ${retrievedSharesHex.length})`);
        }

        // Correct Usage: secrets.combine expects an array of the hex string shares.
        const recoveredKeyHex = secrets.combine(retrievedSharesHex);
        return Buffer.from(recoveredKeyHex, 'hex');
    }
}

/**
 * Checks if a proposal is executed on-chain using Squads SDK.
 * @param {string} multisigAddress - The multisig PDA (base58 string)
 * @param {string|number|BigInt} transactionIndex - The proposal index
 * @param {Connection} connection - Solana connection
 * @returns {Promise<boolean>} - True if executed, false otherwise
 */
async function isProposalExecuted(multisigAddress, transactionIndex, connection) {
    const multisigPda = new PublicKey(multisigAddress);
    const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: BigInt(transactionIndex)
    });
    const proposalAccount = await multisig.accounts.Proposal.fromAccountAddress(
        connection,
        proposalPda
    );
    return proposalAccount.status.__kind === 'Executed';
}

// Export the class directly for better testability and module usage.
module.exports = {
    KeyDistributionService,
    isProposalExecuted
};