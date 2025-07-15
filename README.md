# GitHub Projects MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with GitHub Projects via GraphQL API. This repo is managed by the Model Context Protocol (MCP) and is designed to work seamlessly with Claude Desktop. Written by ProRanked.

## Features

### Project Management
- Create new projects for repositories or organizations
- List projects for repositories and organizations
- Get detailed project information including fields
- List items in a project
- Create new project items from issues/PRs
- Update project item field values

### Issue Management
- Create new issues with automatic type detection and labeling
- Smart detection of issue types: Epic, Feature, Bug, Task, Story, Documentation
- Create parent-child relationships between issues (Epic > Feature > Story/Task)
- Update existing issues (title, body, state, labels, assignees, milestone)
- List issues with filtering options (state, labels, assignee)
- Get detailed issue information including comments and project associations
- View complete issue hierarchy (parents and children)
- Ensure standard issue type labels exist in repositories

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

#### Project Tools

##### create_project
Create a new GitHub project.

Parameters:
- `owner` (required): Repository owner or organization name
- `title` (required): Project title
- `repo` (optional): Repository name (omit for organization project)

##### list_projects
List GitHub projects for a repository or organization.

Parameters:
- `owner` (required): Repository owner or organization name
- `repo` (optional): Repository name (omit for organization projects)
- `projectsType` (optional): "repository" or "organization" (default: "repository")

##### get_project
Get detailed information about a specific project.

Parameters:
- `projectNumber` (required): Project number
- `owner` (required): Repository owner or organization name
- `repo` (optional): Repository name (omit for organization projects)

##### list_project_items
List items in a GitHub project.

Parameters:
- `projectId` (required): Project node ID
- `first` (optional): Number of items to return (default: 20)

##### create_project_item
Add an existing issue or pull request to a project.

Parameters:
- `projectId` (required): Project node ID
- `contentId` (required): Issue or PR node ID

##### update_project_item_field
Update a field value for a project item.

Parameters:
- `projectId` (required): Project node ID
- `itemId` (required): Project item node ID
- `fieldId` (required): Field node ID
- `value` (required): New value for the field

#### Issue Tools

##### create_issue
Create a new issue in a repository with automatic type detection.

Parameters:
- `owner` (required): Repository owner (automatically converted to lowercase)
- `repo` (required): Repository name
- `title` (required): Issue title
- `body` (optional): Issue body/description
- `labels` (optional): Array of label names to assign
- `assignees` (optional): Array of usernames to assign
- `milestone` (optional): Milestone number to assign
- `parentIssueNumber` (optional): Parent issue number to link this issue to

**Automatic Type Detection**: The tool analyzes the title and body to automatically add appropriate labels:
- **Epic**: Large initiatives, milestones, parent tasks
- **Feature**: New functionality, enhancements, implementations
- **Bug**: Errors, fixes, crashes, broken functionality
- **Task**: General tasks, chores, refactoring, updates
- **Story**: User stories, "as a user" scenarios
- **Documentation**: Docs, README, guides

##### update_issue
Update an existing issue.

Parameters:
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `issueNumber` (required): Issue number
- `title` (optional): New title
- `body` (optional): New body
- `state` (optional): "open" or "closed"
- `labels` (optional): Replace all labels with this array
- `assignees` (optional): Replace all assignees with this array
- `milestone` (optional): New milestone number (or null to remove)

##### list_issues
List issues in a repository.

Parameters:
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `state` (optional): "open", "closed", or "all" (default: "open")
- `labels` (optional): Array of labels to filter by
- `assignee` (optional): Filter by assignee username
- `first` (optional): Number of issues to return (default: 20)

##### get_issue
Get detailed information about a specific issue.

Parameters:
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `issueNumber` (required): Issue number

##### ensure_labels
Ensure standard issue type labels exist in the repository.

Parameters:
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `labels` (optional): Array of label definitions with:
  - `name` (required): Label name
  - `color` (required): Hex color without #
  - `description` (optional): Label description

If no labels are provided, creates default issue type labels (epic, feature, bug, task, story, documentation).

##### link_issues
Create parent-child relationships between issues.

Parameters:
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `parentIssueNumber` (required): Parent issue number (e.g., Epic or Feature)
- `childIssueNumber` (required): Child issue number to link
- `linkType` (optional): Relationship type - "tracks" (default), "blocks", or "related"

##### set_parent
Set or update the parent of an issue (simpler alternative to link_issues).

Parameters:
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `issueNumber` (required): Issue number to set parent for
- `parentIssueNumber` (required): Parent issue number (e.g., Epic or Feature)

##### get_issue_hierarchy
Get the complete hierarchy of an issue showing all parents and children.

Parameters:
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `issueNumber` (required): Issue number to get hierarchy for

##### add_sub_issue
Add a native sub-issue relationship using GitHub beta API (creates parent-child relationship visible in GitHub's UI).

Parameters:
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `parentIssueNumber` (required): Parent issue number
- `childIssueNumber` (required): Child issue number to add as sub-issue

Note: This uses GitHub's beta API. If not available, it falls back to task list approach.

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

### Project Examples

1. Create a new project:
   ```
   Tool: create_project
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world",
     "title": "My New Project"
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

### Issue Examples

4. Ensure issue type labels exist:
   ```
   Tool: ensure_labels
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world"
   }
   ```

5. Create a new issue (auto-detects as bug):
   ```
   Tool: create_issue
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world",
     "title": "Bug: Application crashes on startup",
     "body": "When I try to start the application, it crashes with error XYZ.",
     "labels": ["high-priority"],
     "assignees": ["octocat"]
   }
   ```

6. Create an epic:
   ```
   Tool: create_issue
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world",
     "title": "Epic: Implement user authentication system",
     "body": "This epic covers the implementation of a complete authentication system including login, registration, and password recovery."
   }
   ```

7. Create a feature under an epic:
   ```
   Tool: create_issue
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world",
     "title": "Feature: Implement login functionality",
     "body": "Implement secure login with JWT tokens",
     "parentIssueNumber": 100
   }
   ```

8. Link existing issues:
   ```
   Tool: link_issues
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world",
     "parentIssueNumber": 100,
     "childIssueNumber": 101,
     "linkType": "tracks"
   }
   ```

9. Set parent for an issue (simpler syntax):
   ```
   Tool: set_parent
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world",
     "issueNumber": 101,
     "parentIssueNumber": 100
   }
   ```

10. View issue hierarchy:
   ```
   Tool: get_issue_hierarchy
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world",
     "issueNumber": 100
   }
   ```

11. Add native sub-issue relationship (beta):
   ```
   Tool: add_sub_issue
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world",
     "parentIssueNumber": 100,
     "childIssueNumber": 101
   }
   ```

12. Update an issue:
   ```
   Tool: update_issue
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world",
     "issueNumber": 42,
     "state": "closed",
     "labels": ["bug", "fixed"]
   }
   ```

13. List open issues with a specific label:
   ```
   Tool: list_issues
   Arguments: {
     "owner": "octocat",
     "repo": "hello-world",
     "state": "open",
     "labels": ["bug"]
   }
   ```

14. Add an issue to a project:
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