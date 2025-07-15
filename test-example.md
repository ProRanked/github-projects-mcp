# Testing GitHub Projects MCP Server

## Method 1: Direct Testing with npm

1. **Start the server in development mode:**
   ```bash
   npm run dev
   ```
   You should see: `GitHub Projects MCP Server running...`

2. **The server is now listening on stdio for MCP commands.**

## Method 2: Testing with Claude Desktop

1. **Add to Claude Desktop configuration:**
   - On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - On Windows: `%APPDATA%\Claude\claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "github-projects": {
         "command": "node",
         "args": ["/Users/devmoreno/MCP/Github-MCP/github-projects-mcp/dist/index.js"],
         "env": {
           "GITHUB_TOKEN": "your_github_token_here"
         }
       }
     }
   }
   ```

2. **Restart Claude Desktop**

3. **Test by asking Claude to:**
   - "Use the github-projects MCP server to list my repositories' projects"
   - "Get details about project #1 in repository owner/repo"

## Method 3: Testing with a Test Client

1. **Install MCP inspector (if available):**
   ```bash
   npm install -g @modelcontextprotocol/inspector
   ```

2. **Run the inspector:**
   ```bash
   mcp-inspector node dist/index.js
   ```

## Example Test Queries

Once connected, you can test these operations:

1. **List projects in a repository:**
   ```json
   {
     "tool": "list_projects",
     "arguments": {
       "owner": "octocat",
       "repo": "hello-world"
     }
   }
   ```

2. **Get organization projects:**
   ```json
   {
     "tool": "list_projects", 
     "arguments": {
       "owner": "github",
       "projectsType": "organization"
     }
   }
   ```

3. **Get project details:**
   ```json
   {
     "tool": "get_project",
     "arguments": {
       "owner": "octocat",
       "repo": "hello-world",
       "projectNumber": 1
     }
   }
   ```

## Troubleshooting

1. **"GITHUB_TOKEN environment variable is required"**
   - Make sure your `.env` file exists and contains a valid token
   - Token needs `repo`, `read:org`, and `project` scopes

2. **"Project not found"**
   - Verify the owner/repo names are correct
   - Check if your token has access to the repository
   - Ensure the project number exists

3. **GraphQL errors**
   - Check your token permissions
   - Verify the API endpoint is accessible
   - Look for rate limiting issues