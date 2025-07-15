#!/usr/bin/env node

// Simple test script to verify the MCP server
import { spawn } from 'child_process';
import readline from 'readline';

console.log('Starting GitHub Projects MCP Server test...\n');

// Start the server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

// Create readline interface for sending commands
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Handle server output
server.stdout.on('data', (data) => {
  console.log('Server:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('Server Error:', data.toString());
});

// Send initialize request
const initializeRequest = {
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '0.1.0',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  },
  id: 1
};

console.log('Sending initialize request...');
server.stdin.write(JSON.stringify(initializeRequest) + '\n');

// Send list tools request after a delay
setTimeout(() => {
  const listToolsRequest = {
    jsonrpc: '2.0',
    method: 'tools/list',
    params: {},
    id: 2
  };
  
  console.log('\nSending list tools request...');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
}, 1000);

// Exit after 3 seconds
setTimeout(() => {
  console.log('\nTest complete. Shutting down...');
  server.kill();
  process.exit(0);
}, 3000);

// Handle errors
server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});