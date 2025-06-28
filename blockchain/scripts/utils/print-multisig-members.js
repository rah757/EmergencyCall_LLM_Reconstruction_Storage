const { Connection, PublicKey } = require('@solana/web3.js');
const multisig = require('@sqds/multisig');

async function printMultisigMembers(multisigAddress) {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const multisigPda = new PublicKey(multisigAddress);
    const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);
    console.log('Multisig:', multisigAddress);
    console.log('Members:');
    multisigAccount.members.forEach((m, i) => {
        console.log(`  ${i + 1}: ${m.key}`);
    });
}

const multisigAddress = process.argv[2];
if (!multisigAddress) {
    console.error('Usage: node print-multisig-members.js <multisig_address>');
    process.exit(1);
}
printMultisigMembers(multisigAddress);