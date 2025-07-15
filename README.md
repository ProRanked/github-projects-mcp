# GitHub Projects MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with GitHub Projects via GraphQL API. This repo is managed by the Model Context Protocol (MCP) and is designed to work seamlessly with Claude Desktop. Written by ProRanked.

## Features

- Create new projects for repositories or organizations
- List projects for repositories and organizations
- Get detailed project information including fields
- List items in a project
- Create new project items from issues/PRs
- Update project item field values

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Configure your GitHub token in Claude Desktop settings (see Integration section below)

## Usage

### Running the server

The server is designed to be run through Claude Desktop's MCP integration. 

For local development with a `.env` file:
```bash
npm run dev
```

**Note:** The production server (`npm start`) requires the `GITHUB_TOKEN` environment variable to be set externally.

### Available Tools

#### create_project
Create a new GitHub project.

Parameters:
- `owner` (required): Repository owner or organization name
- `title` (required): Project title
- `repo` (optional): Repository name (omit for organization project)
- `body` (optional): Project description

#### list_projects
List GitHub projects for a repository or organization.

Parameters:
- `owner` (required): Repository owner or organization name
- `repo` (optional): Repository name (omit for organization projects)
- `projectsType` (optional): "repository" or "organization" (default: "repository")

#### get_project
Get detailed information about a specific project.

Parameters:
- `projectNumber` (required): Project number
- `owner` (required): Repository owner or organization name
- `repo` (optional): Repository name (omit for organization projects)

#### list_project_items
List items in a GitHub project.

Parameters:
- `projectId` (required): Project node ID
- `first` (optional): Number of items to return (default: 20)

#### create_project_item
Add an existing issue or pull request to a project.

Parameters:
- `projectId` (required): Project node ID
- `contentId` (required): Issue or PR node ID

#### update_project_item_field
Update a field value for a project item.

Parameters:
- `projectId` (required): Project node ID
- `itemId` (required): Project item node ID
- `fieldId` (required): Field node ID
- `value` (required): New value for the field

## Integration with Claude Desktop

Add to your Claude Desktop configuration file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "github-projects": {
      "command": "node",
      "args": ["/path/to/github-projects-mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_personal_access_token"
      }
    }
  }
}
```

### Required GitHub Token Permissions:
- `repo` - For accessing repository projects
- `read:org` - For accessing organization projects  
- `project` - For full project access (read/write)

Create your token at: https://github.com/settings/tokens

## Example Usage

1. Create a new project:
   ```
   Tool: create_project
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world",
     "title": "My New Project",
     "body": "A project to track development tasks"
   }
   ```

2. List all projects in a repository:
   ```
   Tool: list_projects
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world"
   }
   ```

3. Get project details:
   ```
   Tool: get_project
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world",
     "projectNumber": 1
   }
   ```

4. Add an issue to a project:
   ```
   Tool: create_project_item
   Arguments: {
     "projectId": "PVT_kwDOBgKK184AAAAA",
     "contentId": "I_kwDOBgKK185BBBBB"
   }
   ```

## Development

The server is built with:
- TypeScript for type safety
- @modelcontextprotocol/sdk for MCP server implementation
- @octokit/graphql for GitHub GraphQL API access
- dotenv for environment configuration

## Author

Created by [ProRanked](https://github.com/ProRanked)

## License

MIT License - see [LICENSE](LICENSE) file for details