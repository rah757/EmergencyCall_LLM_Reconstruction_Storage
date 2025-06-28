const { spawn } = require('child_process');

const PORTS = process.env.KEY_SERVER_PORTS 
    ? process.env.KEY_SERVER_PORTS.split(',') 
    : ['3010','3011','3012','3013','3014','3015','3016'];

console.log(`Starting ${PORTS.length} key servers...`);

PORTS.forEach(port => {
    const server = spawn('node', ['key-server.js', port], {
        cwd: process.cwd(),
        stdio: 'inherit'
    });
    
    server.on('error', (err) => {
        console.error(`Failed to start server on port ${port}:`, err);
    });
    
    console.log(`Started key server on port ${port}`);
});

process.on('SIGINT', () => {
    console.log('\nShutting down all servers...');
    process.exit(0);
});