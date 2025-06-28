const fs = require('fs');
const path = require('path');
const { Connection, Keypair, clusterApiUrl, LAMPORTS_PER_SOL } = require('@solana/web3.js');

class AccessControlService {
    constructor() {
        this.connection = new Connection(process.env.SOLANA_RPC_URL || clusterApiUrl('devnet'), 'confirmed');
        // The path now needs to go up two directories to reach the project root
        this.walletFilePath = path.resolve(__dirname, '..', '..', '..', 'wallet.json');
        this.wallet = this._loadOrCreateWallet();
        console.log("Access Control Service Initialized.");
    }

    // Load wallet from file or create a new one
    _loadOrCreateWallet() {
        try {
            if (fs.existsSync(this.walletFilePath)) {
                const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(this.walletFilePath, 'utf8')));
                return Keypair.fromSecretKey(secretKey);
            } else {
                console.log('No wallet found. Creating a new one...');
                const newWallet = Keypair.generate();
                fs.writeFileSync(this.walletFilePath, JSON.stringify(Array.from(newWallet.secretKey)));
                console.log(`New wallet created and saved at ${this.walletFilePath}`);
                return newWallet;
            }
        } catch (error) {
            console.error("CRITICAL: Could not load or create wallet.", error);
            process.exit(1); // Exit if we can't get a wallet
        }
    }

    // Get wallet public key
    getWalletPublicKey() {
        return this.wallet.publicKey.toBase58();
    }

    // Check wallet balance
    async getBalance() {
        try {
            const balance = await this.connection.getBalance(this.wallet.publicKey);
            return balance / LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Error getting balance:', error);
            throw error;
        }
    }
}

// Export a singleton instance of the service
module.exports = new AccessControlService();