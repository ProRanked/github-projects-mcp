#!/usr/bin/env node
// Development entry point that loads .env file
import { config } from 'dotenv';
config();

// Import and run the main server
import('./index.js');