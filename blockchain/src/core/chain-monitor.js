require('dotenv').config();
const { Connection, PublicKey } = require('@solana/web3.js');
const { Multisig } = require('@sqds/multisig');
const storageService = require('../components/storage/storage.service');

// Memo parser to extract Arweave ID from proposal creation memos
function parseCreationMemo(memo) {
    if (!memo || typeof memo !== 'string') return null;
    const match = memo.match(/Requesting access to Arweave document: ([\w-]+)/);
    return match ? match[1] : null;
}

class AdvancedChainMonitor {
    constructor() {
        this.connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
        this.multisigPda = new PublicKey(process.env.MULTISIG_PDA);
        // Map to track proposals: K: proposalPda (string), V: { arweaveId: string, status: string }
        this.trackedProposals = new Map();
        this.onLogsId = null; // To store the subscription ID
        console.log('ADVANCED Chain Monitor Initialized.');
    }

    /**
     * Starts the main, persistent listener for all transactions on the multisig account.
     * This is the entry point that keeps the script alive.
     */
    listen() {
        console.log(`[Monitor] Starting persistent listener for multisig PDA: ${this.multisigPda.toBase58()}`);
        this.onLogsId = this.connection.onLogs(
            this.multisigPda,
            (logs, context) => this.handleTransactionLogs(logs),
            'confirmed'
        );
        console.log('[Monitor] Now actively listening for on-chain events...');
    }

    /**
     * Handles logs for any transaction involving the multisig.
     */
    async handleTransactionLogs(logs) {
        if (logs.err) return; // Ignore failed transactions

        // Check if a new proposal was just created
        const proposalCreated = logs.logs.some(log => log.includes('Instruction: ProposalCreate'));
        if (proposalCreated) {
            try {
                // We need to fetch the transaction to get the memo and transactionIndex
                const tx = await this.connection.getParsedTransaction(logs.signature, 'confirmed');
                const memoIx = tx.transaction.message.instructions.find(ix => ix.programId.toBase58() === 'MemoSq4gqABAXKb96qnH8TysNcVcvvMNAmarkuJwy');
                
                // Find the Squads instruction to get the transactionIndex
                const squadIx = tx.transaction.message.instructions.find(ix => ix.programId.equals(this.multisigPda));
                
                // This is a simplified way to get the index. A robust parser would be needed for complex txs.
                // The transactionIndex is typically the last piece of data in the proposalCreate instruction.
                const txIndex = BigInt(tx.meta.logMessages.find(msg => msg.includes("transaction_index")).split(" ").pop());


                if (memoIx && txIndex !== undefined) {
                    const arweaveId = parseCreationMemo(memoIx.parsed);
                    if (arweaveId) {
                        console.log(`[Monitor] Detected new proposal creation for Arweave ID: ${arweaveId} at index ${txIndex}`);
                        this.startTrackingProposal(txIndex, arweaveId);
                    }
                }
            } catch (error) {
                console.error("[Monitor] Error processing new proposal:", error);
            }
        }
    }

    /**
     * Starts tracking a specific proposal's status changes.
     */
    async startTrackingProposal(transactionIndex, arweaveId) {
        const [proposalPda] = Multisig.getProposalPda({
            multisigPda: this.multisigPda,
            transactionIndex,
        });
        const proposalPdaString = proposalPda.toBase58();

        if (this.trackedProposals.has(proposalPdaString)) return;

        console.log(`[Monitor] Attaching account change listener to proposal: ${proposalPdaString}`);
        this.trackedProposals.set(proposalPdaString, { arweaveId, status: 'pending' });

        this.connection.onAccountChange(
            proposalPda,
            (accountInfo) => this.handleProposalUpdate(proposalPdaString, accountInfo),
            'confirmed'
        );
    }

    /**
     * Handles the status update for a specific, tracked proposal.
     */
    async handleProposalUpdate(proposalPdaString, accountInfo) {
        try {
            const proposal = Multisig.decode.proposal(accountInfo.data);
            const trackedProposal = this.trackedProposals.get(proposalPdaString);
            const newStatus = Object.keys(proposal.status)[0];

            if (trackedProposal.status === newStatus) return;

            trackedProposal.status = newStatus;
            console.log(`[Monitor] Proposal ${proposalPdaString} status updated to: ${newStatus.toUpperCase()}`);

            if (proposal.status.executed) {
                console.log(`[Monitor] EXECUTION DETECTED for Arweave ID: ${trackedProposal.arweaveId}`);
                await this.processFullDocumentRetrieval(trackedProposal.arweaveId);
                this.trackedProposals.delete(proposalPdaString);
            }
        } catch (error) {
            console.error(`[Monitor] Error handling proposal update:`, error);
        }
    }

    /**
     * The final step: reconstructs key and decrypts document.
     */
    async processFullDocumentRetrieval(arweaveId) {
        console.log(`[Monitor] Starting full document processing pipeline for ${arweaveId}...`);
        try {
            const document = await storageService.retrieveData(arweaveId);
            console.log("✅ [Monitor] SUCCESS: Document retrieved and decrypted.");
            console.log("  > Document Content:", document);
        } catch (error) {
            console.error(`❌ [Monitor] FAILED to process document ${arweaveId}:`, error.message);
        }
    }
}

// --- Main Execution ---
async function main() {
    // We need to initialize the storage service so the monitor can use it.
    await storageService.initializeStorageService();
    const monitor = new AdvancedChainMonitor();
    monitor.listen();
}

main().catch(err => {
    console.error("❌ FATAL: Chain monitor failed to start.", err);
    process.exit(1);
});
