const { exec } = require('child_process');

const ports = [3010, 3011, 3012, 3013];

console.log("Starting 4 key servers...");

ports.forEach(port => {
    const serverProcess = exec(`node key-server.js ${port}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error with server on port ${port}:`, error);
        }
    });

    serverProcess.stdout.on('data', (data) => {
        process.stdout.write(data);
    });

    serverProcess.stderr.on('data', (data) => {
        process.stderr.write(data);
    });
});