const { TransactionInstruction, PublicKey } = require('@solana/web3.js');

function createMemoInstruction(memo) {
  return new TransactionInstruction({
    keys: [],
    programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcVcvvMNAmarkuJwy"),
    data: Buffer.from(memo, "utf-8"),
  });
}

module.exports = { createMemoInstruction };