const shamir = require('shamir-secret-sharing');
const crypto = require('crypto');

console.log("--- Testing Shamir's Secret Sharing ---");

// 1. Generate a dummy 256-bit key
const masterKey = crypto.randomBytes(32);
const masterKeyHex = masterKey.toString('hex');
console.log("Original Master Key:", masterKeyHex);

// 2. Split the key into 5 shares, with a threshold of 3
const shares = shamir.split(masterKeyHex, { shares: 5, threshold: 3 });
console.log("\nKey split into 5 shares (threshold of 3 required):");
shares.forEach((share, i) => {
    console.log(`  Share ${i + 1}: ${share.toString('hex')}`);
});

// 3. Reconstruct the key using a subset of shares (e.g., shares 1, 3, and 5)
const sharesToCombine = [shares[0], shares[2], shares[4]];
console.log("\nCombining shares 1, 3, and 5...");
const reconstructedKey = shamir.combine(sharesToCombine);
const reconstructedKeyHex = reconstructedKey.toString();

console.log("\nReconstructed Key:", reconstructedKeyHex);

// 4. Verify
if (reconstructedKeyHex === masterKeyHex) {
    console.log("\n✅ SUCCESS: Reconstructed key matches the original master key.");
} else {
    console.log("\n❌ FAILED: Reconstructed key does NOT match the original.");
}