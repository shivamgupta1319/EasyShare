#!/usr/bin/env node

/**
 * Development server launcher
 * This script helps ensure both the React app and Express server are running
 */

const { spawn } = require('child_process');

// Start the Express server
const serverProcess = spawn('node', ['server/server.js'], {
    stdio: 'inherit',
    shell: true
});

console.log('Started Express server on http://localhost:3001');

// Start Create React App development server
const reactProcess = spawn('npm', ['start'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, BROWSER: 'none' } // Prevents opening browser automatically
});

console.log('Started React development server on http://localhost:3000');

// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down development servers...');
    serverProcess.kill('SIGINT');
    reactProcess.kill('SIGINT');
    process.exit(0);
});

console.log('\nDevelopment environment is running!');
console.log('- Express API: http://localhost:3001/api');
console.log('- React App:   http://localhost:3000');
console.log('\nPress Ctrl+C to stop all servers.\n');
