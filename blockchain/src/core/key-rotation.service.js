const secrets = require('secrets.js-grempe');
const crypto = require('crypto');
const axios = require('axios');

const PORTS = process.env.KEY_SERVER_PORTS ? process.env.KEY_SERVER_PORTS.split(',') : ['3010','3011','3012','3013','3014','3015','3016'];
const THRESHOLD = +(process.env.EPOCH_THRESHOLD || 4);
const RETAIN = +(process.env.KEY_RETENTION_MONTHS || 12);

function getCurrentEpochId() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function rotateKey() {
    const epochId = getCurrentEpochId();
    const key = crypto.randomBytes(32).toString('hex');          // 256-bit
    const shares = secrets.share(key, PORTS.length, THRESHOLD);

    console.log(`Generating new epoch ${epochId} with ${PORTS.length} shares (threshold: ${THRESHOLD})`);

    // Post share i to port i
    const results = await Promise.allSettled(
        PORTS.map((p, i) =>
            axios.post(`http://localhost:${p}/storeEpochShare`, {
                epochId,
                share: shares[i]
            }).catch(e => {
                console.error(`Failed to store share on port ${p}:`, e.message);
                throw e;
            })
        )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ New epoch ${epochId}, key distributed to ${successful}/${PORTS.length} servers.`);
    
    if (successful < THRESHOLD) {
        throw new Error(`Only ${successful} servers available, need at least ${THRESHOLD}`);
    }
}

async function getCurrentKey() {
    return { epochId: getCurrentEpochId() };      // no key here; servers hold it
}

module.exports = { rotateKey, getCurrentKey, getCurrentEpochId, RETAIN };