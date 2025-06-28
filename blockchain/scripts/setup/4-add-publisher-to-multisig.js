const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const multisig = require('@sqds/multisig');
const fs = require('fs');
const path = require('path');
const bs58 = require('bs58').default;
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// This script shows HOW to create the instruction to add a publisher.
// This instruction must then be put into a proposal.

async function generateAddPublisherInstruction() {
    try {
        console.log("Generating instruction to add a publisher...");

        // 1. Load multisig and publisher info
        const walletsDir = path.resolve(__dirname, '../../testing/wallets');
        const multisigInfo = JSON.parse(fs.readFileSync(path.join(walletsDir, 'multisig-info.json'), 'utf8'));
        const publisherInfo = JSON.parse(fs.readFileSync(path.join(walletsDir, 'publisher-wallet.json'), 'utf8'));
        
        const multisigPda = new PublicKey(multisigInfo.address);
        const publisherPubkey = new PublicKey(publisherInfo.publicKey);

        // 2. Create the instruction to add the publisher to the multisig config
        const addPublisherIx = await multisig.instructions.configMemberAdd({
            multisig: multisigPda,
            member: publisherPubkey,
        });

        console.log("\n--- INSTRUCTION CREATED ---");
        console.log("This instruction must be placed into a new proposal (using create-proposal.js).");
        console.log("The proposal must then be approved and executed by the multisig members.");
        console.log("Target Member Public Key:", publisherPubkey.toBase58());
        
        // This script doesn't send a transaction, it just shows what needs to be done.
        // You would adapt `create-proposal.js` to use this instruction instead of the
        // no-op transfer instruction.

    } catch (error) {
        console.error("Failed to generate 'add publisher' instruction:", error.message);
    }
}

generateAddPublisherInstruction();