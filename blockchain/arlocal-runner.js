// This script starts a local Arweave environment for testing.
// It's a simple wrapper around the 'arlocal' library.
const ArLocal = require('arlocal').default;

(async () => {
    const arLocal = new ArLocal(1984, false); // Port 1984, no logs shown in console
    
    // Start the server
    await arLocal.start();
    
    console.log("ArLocal server started on port 1984.");
    console.log("This is a local Arweave test environment.");
    console.log("Press Ctrl+C to stop the server.");
})();