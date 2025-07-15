#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import { config } from 'dotenv';
import readline from 'readline';

config();

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function testMCPServer() {
  console.log(`${colors.cyan}GitHub Projects MCP Server Test Suite${colors.reset}\n`);

  // Check if GITHUB_TOKEN is set
  if (!process.env.GITHUB_TOKEN) {
    console.error(`${colors.red}❌ Error: GITHUB_TOKEN environment variable is not set${colors.reset}`);
    console.log(`\nPlease create a .env file with your GitHub token:`);
    console.log(`  1. Copy .env.example to .env`);
    console.log(`  2. Add your GitHub personal access token`);
    console.log(`  3. Ensure token has 'repo' and 'project' permissions\n`);
    process.exit(1);
  }

  console.log(`${colors.green}✓ GITHUB_TOKEN found${colors.reset}`);

  // Start the MCP server
  console.log(`\n${colors.blue}Starting MCP server...${colors.reset}`);
  
  const serverProcess = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  // Create transport and client
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: { ...process.env }
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    // Connect to the server
    await client.connect(transport);
    console.log(`${colors.green}✓ Connected to MCP server${colors.reset}\n`);

    // Test 1: List available tools
    console.log(`${colors.yellow}Test 1: Listing available tools${colors.reset}`);
    const toolsResponse = await client.request({
      method: 'tools/list'
    });
    
    console.log(`Found ${toolsResponse.tools.length} tools:`);
    toolsResponse.tools.forEach(tool => {
      console.log(`  • ${colors.cyan}${tool.name}${colors.reset}: ${tool.description}`);
    });

    // Test 2: Interactive tool testing
    console.log(`\n${colors.yellow}Test 2: Interactive tool testing${colors.reset}`);
    
    const owner = await question('\nEnter GitHub owner/organization (e.g., "octocat"): ');
    const repo = await question('Enter repository name (optional, press Enter to skip): ');
    
    if (owner) {
      // Test listing projects
      console.log(`\n${colors.blue}Testing list_projects...${colors.reset}`);
      try {
        const listProjectsResponse = await client.request({
          method: 'tools/call',
          params: {
            name: 'list_projects',
            arguments: {
              owner: owner.trim(),
              ...(repo.trim() && { repo: repo.trim() }),
              projectsType: repo.trim() ? 'repository' : 'organization'
            }
          }
        });

        const projects = JSON.parse(listProjectsResponse.content[0].text);
        if (projects.length > 0) {
          console.log(`${colors.green}✓ Found ${projects.length} project(s)${colors.reset}`);
          projects.forEach((project, index) => {
            console.log(`\n  Project ${index + 1}:`);
            console.log(`    ID: ${project.id}`);
            console.log(`    Number: ${project.number}`);
            console.log(`    Title: ${project.title}`);
            console.log(`    Closed: ${project.closed}`);
            console.log(`    Public: ${project.public}`);
          });

          // Test getting project details
          const projectNumber = await question('\nEnter a project number to get details (or press Enter to skip): ');
          if (projectNumber) {
            console.log(`\n${colors.blue}Testing get_project...${colors.reset}`);
            try {
              const getProjectResponse = await client.request({
                method: 'tools/call',
                params: {
                  name: 'get_project',
                  arguments: {
                    projectNumber: parseInt(projectNumber),
                    owner: owner.trim(),
                    ...(repo.trim() && { repo: repo.trim() })
                  }
                }
              });

              const project = JSON.parse(getProjectResponse.content[0].text);
              console.log(`${colors.green}✓ Retrieved project details${colors.reset}`);
              console.log(`  Title: ${project.title}`);
              console.log(`  Description: ${project.shortDescription || 'No description'}`);
              console.log(`  Fields: ${project.fields.nodes.length}`);

              // Test listing project items
              const testItems = await question('\nList items in this project? (y/n): ');
              if (testItems.toLowerCase() === 'y') {
                console.log(`\n${colors.blue}Testing list_project_items...${colors.reset}`);
                const itemsResponse = await client.request({
                  method: 'tools/call',
                  params: {
                    name: 'list_project_items',
                    arguments: {
                      projectId: project.id,
                      first: 5
                    }
                  }
                });

                const items = JSON.parse(itemsResponse.content[0].text);
                console.log(`${colors.green}✓ Found ${items.length} item(s)${colors.reset}`);
                items.forEach((item, index) => {
                  const content = item.content;
                  if (content) {
                    console.log(`  Item ${index + 1}: ${content.title || 'Draft Issue'} (#${content.number || 'N/A'})`);
                  }
                });
              }
            } catch (error) {
              console.log(`${colors.red}❌ Error getting project details: ${error.message}${colors.reset}`);
            }
          }
        } else {
          console.log(`${colors.yellow}No projects found for ${owner}${repo ? '/' + repo : ''}${colors.reset}`);
        }
      } catch (error) {
        console.log(`${colors.red}❌ Error listing projects: ${error.message}${colors.reset}`);
      }
    }

    // Test 3: Server capabilities
    console.log(`\n${colors.yellow}Test 3: Server capabilities${colors.reset}`);
    const serverInfo = transport.serverInfo;
    if (serverInfo) {
      console.log(`Server name: ${serverInfo.name}`);
      console.log(`Server version: ${serverInfo.version}`);
    }

    console.log(`\n${colors.green}✅ All tests completed!${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}❌ Error during testing: ${error.message}${colors.reset}`);
    console.error(error.stack);
  } finally {
    // Clean up
    rl.close();
    await client.close();
    serverProcess.kill();
    process.exit(0);
  }
}

// Run the test
testMCPServer().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});