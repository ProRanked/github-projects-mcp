#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { graphql } from '@octokit/graphql';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

// Trim any whitespace that might have been introduced
const cleanToken = GITHUB_TOKEN.trim();

// GitHub supports both 'token' (classic) and 'Bearer' (fine-grained) formats
// Fine-grained PATs start with 'github_pat_' and use Bearer auth
const authHeader = cleanToken.startsWith('github_pat_') 
  ? `Bearer ${cleanToken}`
  : `token ${cleanToken}`;

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: authHeader,
    // Enable GitHub beta features and preview schemas
    'Accept': 'application/vnd.github.v4+json',
    'X-Github-Next-Global-ID': '1',
  },
});

class GitHubProjectsServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'github-projects-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_projects',
          description: 'List GitHub projects for a repository or organization',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner or organization name',
              },
              repo: {
                type: 'string',
                description: 'Repository name (optional for org projects)',
              },
              projectsType: {
                type: 'string',
                enum: ['repository', 'organization'],
                description: 'Type of projects to list',
                default: 'repository',
              },
            },
            required: ['owner'],
          },
        },
        {
          name: 'get_project',
          description: 'Get details of a specific GitHub project',
          inputSchema: {
            type: 'object',
            properties: {
              projectNumber: {
                type: 'number',
                description: 'Project number',
              },
              owner: {
                type: 'string',
                description: 'Repository owner or organization name',
              },
              repo: {
                type: 'string',
                description: 'Repository name (optional for org projects)',
              },
            },
            required: ['projectNumber', 'owner'],
          },
        },
        {
          name: 'list_project_items',
          description: 'List items in a GitHub project',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Project node ID',
              },
              first: {
                type: 'number',
                description: 'Number of items to return',
                default: 20,
              },
            },
            required: ['projectId'],
          },
        },
        {
          name: 'create_project_item',
          description: 'Create a new item in a GitHub project',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Project node ID',
              },
              contentId: {
                type: 'string',
                description: 'Issue or PR node ID to add to project',
              },
            },
            required: ['projectId', 'contentId'],
          },
        },
        {
          name: 'update_project_item_field',
          description: 'Update a field value for a project item',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Project node ID',
              },
              itemId: {
                type: 'string',
                description: 'Project item node ID',
              },
              fieldId: {
                type: 'string',
                description: 'Field node ID',
              },
              value: {
                type: 'string',
                description: 'New value for the field',
              },
            },
            required: ['projectId', 'itemId', 'fieldId', 'value'],
          },
        },
        {
          name: 'create_project',
          description: 'Create a new GitHub project for a repository or organization',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner or organization name',
              },
              repo: {
                type: 'string',
                description: 'Repository name (omit for organization project)',
              },
              title: {
                type: 'string',
                description: 'Project title',
              },
            },
            required: ['owner', 'title'],
          },
        },
        {
          name: 'create_issue',
          description: 'Create a new issue in a repository',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              title: {
                type: 'string',
                description: 'Issue title',
              },
              body: {
                type: 'string',
                description: 'Issue body/description (optional)',
              },
              labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Labels to assign (optional)',
              },
              assignees: {
                type: 'array',
                items: { type: 'string' },
                description: 'Users to assign (optional)',
              },
              milestone: {
                type: 'number',
                description: 'Milestone number (optional)',
              },
              parentIssueNumber: {
                type: 'number',
                description: 'Parent issue number to link this issue to (optional)',
              },
            },
            required: ['owner', 'repo', 'title'],
          },
        },
        {
          name: 'update_issue',
          description: 'Update an existing issue',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              issueNumber: {
                type: 'number',
                description: 'Issue number',
              },
              title: {
                type: 'string',
                description: 'New title (optional)',
              },
              body: {
                type: 'string',
                description: 'New body (optional)',
              },
              state: {
                type: 'string',
                enum: ['open', 'closed'],
                description: 'Issue state (optional)',
              },
              labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Replace all labels (optional)',
              },
              assignees: {
                type: 'array',
                items: { type: 'string' },
                description: 'Replace all assignees (optional)',
              },
              milestone: {
                type: 'number',
                description: 'Milestone number or null to remove (optional)',
              },
            },
            required: ['owner', 'repo', 'issueNumber'],
          },
        },
        {
          name: 'list_issues',
          description: 'List issues in a repository',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              state: {
                type: 'string',
                enum: ['open', 'closed', 'all'],
                description: 'Filter by state (default: open)',
                default: 'open',
              },
              labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by labels (optional)',
              },
              assignee: {
                type: 'string',
                description: 'Filter by assignee username (optional)',
              },
              first: {
                type: 'number',
                description: 'Number of issues to return (default: 20)',
                default: 20,
              },
            },
            required: ['owner', 'repo'],
          },
        },
        {
          name: 'get_issue',
          description: 'Get details of a specific issue',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              issueNumber: {
                type: 'number',
                description: 'Issue number',
              },
            },
            required: ['owner', 'repo', 'issueNumber'],
          },
        },
        {
          name: 'ensure_labels',
          description: 'Ensure standard issue type labels exist in the repository',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              labels: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Label name',
                    },
                    color: {
                      type: 'string',
                      description: 'Label color (hex without #)',
                    },
                    description: {
                      type: 'string',
                      description: 'Label description',
                    },
                  },
                  required: ['name', 'color'],
                },
                description: 'Labels to ensure exist (optional, uses defaults if not provided)',
              },
            },
            required: ['owner', 'repo'],
          },
        },
        {
          name: 'link_issues',
          description: 'Create parent-child relationship between issues (Epic > Feature > Story/Task)',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              parentIssueNumber: {
                type: 'number',
                description: 'Parent issue number (e.g., Epic or Feature)',
              },
              childIssueNumber: {
                type: 'number',
                description: 'Child issue number to link',
              },
              linkType: {
                type: 'string',
                enum: ['tracks', 'blocks', 'related'],
                description: 'Type of relationship (default: tracks for parent-child)',
                default: 'tracks',
              },
            },
            required: ['owner', 'repo', 'parentIssueNumber', 'childIssueNumber'],
          },
        },
        {
          name: 'set_parent',
          description: 'Set or update the parent of an issue (simpler alternative to link_issues)',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              issueNumber: {
                type: 'number',
                description: 'Issue number to set parent for',
              },
              parentIssueNumber: {
                type: 'number',
                description: 'Parent issue number (e.g., Epic or Feature)',
              },
            },
            required: ['owner', 'repo', 'issueNumber', 'parentIssueNumber'],
          },
        },
        {
          name: 'get_issue_hierarchy',
          description: 'Get the full hierarchy of an issue (parents and children)',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              issueNumber: {
                type: 'number',
                description: 'Issue number to get hierarchy for',
              },
            },
            required: ['owner', 'repo', 'issueNumber'],
          },
        },
        {
          name: 'add_sub_issue',
          description: 'Add a sub-issue relationship using GitHub beta API (creates native parent-child relationship)',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              parentIssueNumber: {
                type: 'number',
                description: 'Parent issue number',
              },
              childIssueNumber: {
                type: 'number',
                description: 'Child issue number to add as sub-issue',
              },
            },
            required: ['owner', 'repo', 'parentIssueNumber', 'childIssueNumber'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'list_projects':
            return await this.listProjects(args);
          case 'get_project':
            return await this.getProject(args);
          case 'list_project_items':
            return await this.listProjectItems(args);
          case 'create_project_item':
            return await this.createProjectItem(args);
          case 'update_project_item_field':
            return await this.updateProjectItemField(args);
          case 'create_project':
            return await this.createProject(args);
          case 'create_issue':
            return await this.createIssue(args);
          case 'update_issue':
            return await this.updateIssue(args);
          case 'list_issues':
            return await this.listIssues(args);
          case 'get_issue':
            return await this.getIssue(args);
          case 'ensure_labels':
            return await this.ensureLabels(args);
          case 'link_issues':
            return await this.linkIssues(args);
          case 'set_parent':
            return await this.setParent(args);
          case 'get_issue_hierarchy':
            return await this.getIssueHierarchy(args);
          case 'add_sub_issue':
            return await this.addSubIssue(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) throw error;
        
        // Provide more detailed error information
        let errorMessage = 'GitHub API error: ';
        if (error instanceof Error) {
          errorMessage += error.message;
          // Check for common auth errors
          if (error.message.includes('Bad credentials')) {
            errorMessage += '. Please check that your GitHub token is valid and has the required permissions (repo, project, read:org).';
          }
        } else {
          errorMessage += String(error);
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          errorMessage
        );
      }
    });
  }

  private async listProjects(args: any) {
    let { owner, repo, projectsType = 'repository' } = args;
    
    // Ensure owner is lowercase
    owner = owner.toLowerCase();

    let query;
    let variables;

    if (projectsType === 'repository' && repo) {
      query = `
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            projectsV2(first: 20) {
              nodes {
                id
                number
                title
                shortDescription
                closed
                public
                createdAt
                updatedAt
              }
            }
          }
        }
      `;
      variables = { owner, repo };
    } else {
      query = `
        query($owner: String!) {
          organization(login: $owner) {
            projectsV2(first: 20) {
              nodes {
                id
                number
                title
                shortDescription
                closed
                public
                createdAt
                updatedAt
              }
            }
          }
        }
      `;
      variables = { owner };
    }

    const result: any = await graphqlWithAuth(query, variables);
    const projects = projectsType === 'repository' && repo
      ? result.repository?.projectsV2?.nodes || []
      : result.organization?.projectsV2?.nodes || [];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(projects, null, 2),
        },
      ],
    };
  }

  private async getProject(args: any) {
    let { projectNumber, owner, repo } = args;
    
    // Ensure owner is lowercase
    owner = owner.toLowerCase();

    let query;
    let variables;

    if (repo) {
      query = `
        query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            projectV2(number: $number) {
              id
              number
              title
              shortDescription
              readme
              closed
              public
              createdAt
              updatedAt
              fields(first: 20) {
                nodes {
                  ... on ProjectV2Field {
                    id
                    name
                    dataType
                  }
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                    dataType
                    options {
                      id
                      name
                    }
                  }
                  ... on ProjectV2IterationField {
                    id
                    name
                    dataType
                  }
                }
              }
            }
          }
        }
      `;
      variables = { owner, repo, number: projectNumber };
    } else {
      query = `
        query($owner: String!, $number: Int!) {
          organization(login: $owner) {
            projectV2(number: $number) {
              id
              number
              title
              shortDescription
              readme
              closed
              public
              createdAt
              updatedAt
              fields(first: 20) {
                nodes {
                  ... on ProjectV2Field {
                    id
                    name
                    dataType
                  }
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                    dataType
                    options {
                      id
                      name
                    }
                  }
                  ... on ProjectV2IterationField {
                    id
                    name
                    dataType
                  }
                }
              }
            }
          }
        }
      `;
      variables = { owner, number: projectNumber };
    }

    const result: any = await graphqlWithAuth(query, variables);
    const project = repo
      ? result.repository?.projectV2
      : result.organization?.projectV2;

    if (!project) {
      throw new McpError(ErrorCode.InvalidRequest, 'Project not found');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(project, null, 2),
        },
      ],
    };
  }

  private async listProjectItems(args: any) {
    const { projectId, first = 20 } = args;

    const query = `
      query($projectId: ID!, $first: Int!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: $first) {
              nodes {
                id
                createdAt
                updatedAt
                content {
                  ... on Issue {
                    id
                    number
                    title
                    state
                    url
                  }
                  ... on PullRequest {
                    id
                    number
                    title
                    state
                    url
                  }
                  ... on DraftIssue {
                    id
                    title
                  }
                }
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldTextValue {
                      field {
                        ... on ProjectV2Field {
                          id
                          name
                        }
                      }
                      text
                    }
                    ... on ProjectV2ItemFieldNumberValue {
                      field {
                        ... on ProjectV2Field {
                          id
                          name
                        }
                      }
                      number
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      field {
                        ... on ProjectV2Field {
                          id
                          name
                        }
                      }
                      date
                    }
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      field {
                        ... on ProjectV2SingleSelectField {
                          id
                          name
                        }
                      }
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result: any = await graphqlWithAuth(query, { projectId, first });
    const items = result.node?.items?.nodes || [];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(items, null, 2),
        },
      ],
    };
  }

  private async createProjectItem(args: any) {
    const { projectId, contentId } = args;

    const mutation = `
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
          item {
            id
            createdAt
          }
        }
      }
    `;

    const result: any = await graphqlWithAuth(mutation, { projectId, contentId });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.addProjectV2ItemById.item, null, 2),
        },
      ],
    };
  }

  private async updateProjectItemField(args: any) {
    const { projectId, itemId, fieldId, value } = args;

    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: $value
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;

    const result: any = await graphqlWithAuth(mutation, {
      projectId,
      itemId,
      fieldId,
      value: { text: value },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.updateProjectV2ItemFieldValue.projectV2Item, null, 2),
        },
      ],
    };
  }

  private async createProject(args: any) {
    let { owner, repo, title } = args;
    
    // Ensure owner is lowercase
    owner = owner.toLowerCase();

    let mutation;
    let variables: any;

    if (repo) {
      // Create repository project
      const repoQuery = `
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            id
          }
        }
      `;
      const repoResult: any = await graphqlWithAuth(repoQuery, { owner, repo });
      const repositoryId = repoResult.repository?.id;

      if (!repositoryId) {
        throw new McpError(ErrorCode.InvalidRequest, 'Repository not found');
      }

      mutation = `
        mutation($repositoryId: ID!, $title: String!) {
          createProjectV2(input: {
            repositoryId: $repositoryId,
            title: $title
          }) {
            projectV2 {
              id
              number
              title
              shortDescription
              url
              createdAt
            }
          }
        }
      `;
      variables = { repositoryId, title };
    } else {
      // Create organization project
      const orgQuery = `
        query($owner: String!) {
          organization(login: $owner) {
            id
          }
        }
      `;
      const orgResult: any = await graphqlWithAuth(orgQuery, { owner });
      const ownerId = orgResult.organization?.id;

      if (!ownerId) {
        throw new McpError(ErrorCode.InvalidRequest, 'Organization not found');
      }

      mutation = `
        mutation($ownerId: ID!, $title: String!) {
          createProjectV2(input: {
            ownerId: $ownerId,
            title: $title
          }) {
            projectV2 {
              id
              number
              title
              shortDescription
              url
              createdAt
            }
          }
        }
      `;
      variables = { ownerId, title };
    }

    const result: any = await graphqlWithAuth(mutation, variables);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.createProjectV2.projectV2, null, 2),
        },
      ],
    };
  }

  private detectIssueType(title: string, body?: string): string | null {
    const combinedText = `${title} ${body || ''}`.toLowerCase();
    
    // Epic detection patterns
    if (combinedText.includes('epic') || 
        combinedText.includes('initiative') || 
        combinedText.includes('milestone') ||
        combinedText.includes('parent')) {
      return 'epic';
    }
    
    // Feature detection patterns
    if (combinedText.includes('feature') || 
        combinedText.includes('enhancement') || 
        combinedText.includes('new functionality') ||
        combinedText.includes('add support') ||
        combinedText.includes('implement')) {
      return 'feature';
    }
    
    // Bug detection patterns
    if (combinedText.includes('bug') || 
        combinedText.includes('fix') || 
        combinedText.includes('error') ||
        combinedText.includes('issue') ||
        combinedText.includes('broken') ||
        combinedText.includes('crash')) {
      return 'bug';
    }
    
    // Task detection patterns
    if (combinedText.includes('task') || 
        combinedText.includes('chore') || 
        combinedText.includes('refactor') ||
        combinedText.includes('update') ||
        combinedText.includes('clean')) {
      return 'task';
    }
    
    // Story detection patterns
    if (combinedText.includes('story') || 
        combinedText.includes('user story') || 
        combinedText.includes('as a user') ||
        combinedText.includes('i want')) {
      return 'story';
    }
    
    // Documentation detection patterns
    if (combinedText.includes('documentation') || 
        combinedText.includes('docs') || 
        combinedText.includes('readme') ||
        combinedText.includes('guide')) {
      return 'documentation';
    }
    
    return null;
  }

  private async createIssue(args: any) {
    let { owner, repo, title, body, labels = [], assignees, milestone, parentIssueNumber } = args;
    
    // Ensure owner is lowercase
    owner = owner.toLowerCase();
    
    // Detect issue type and add appropriate label
    const issueType = this.detectIssueType(title, body);
    const autoLabels = [...labels];
    
    if (issueType && !autoLabels.includes(issueType)) {
      autoLabels.push(issueType);
    }

    // First, get repository ID
    const repoQuery = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
        }
      }
    `;
    const repoResult: any = await graphqlWithAuth(repoQuery, { owner, repo });
    const repositoryId = repoResult.repository?.id;

    if (!repositoryId) {
      throw new McpError(ErrorCode.InvalidRequest, 'Repository not found');
    }

    // Build the mutation
    const mutation = `
      mutation($repositoryId: ID!, $title: String!, $body: String, $labelIds: [ID!], $assigneeIds: [ID!], $milestoneId: ID) {
        createIssue(input: {
          repositoryId: $repositoryId,
          title: $title,
          body: $body,
          labelIds: $labelIds,
          assigneeIds: $assigneeIds,
          milestoneId: $milestoneId
        }) {
          issue {
            id
            number
            title
            body
            state
            url
            createdAt
            updatedAt
            author {
              login
            }
            labels(first: 10) {
              nodes {
                name
                color
              }
            }
            assignees(first: 10) {
              nodes {
                login
              }
            }
            milestone {
              title
              number
            }
          }
        }
      }
    `;

    // Convert label names to IDs if provided
    let labelIds = null;
    if (autoLabels && autoLabels.length > 0) {
      const labelsQuery = `
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            labels(first: 100) {
              nodes {
                id
                name
              }
            }
          }
        }
      `;
      const labelsResult: any = await graphqlWithAuth(labelsQuery, { owner, repo });
      const repoLabels = labelsResult.repository?.labels?.nodes || [];
      labelIds = autoLabels.map((labelName: string) => {
        const label = repoLabels.find((l: any) => l.name === labelName);
        return label?.id;
      }).filter(Boolean);
    }

    // Convert assignee usernames to IDs if provided
    let assigneeIds = null;
    if (assignees && assignees.length > 0) {
      assigneeIds = await Promise.all(assignees.map(async (username: string) => {
        const userQuery = `
          query($username: String!) {
            user(login: $username) {
              id
            }
          }
        `;
        const userResult: any = await graphqlWithAuth(userQuery, { username });
        return userResult.user?.id;
      }));
      assigneeIds = assigneeIds.filter(Boolean);
    }

    // Get milestone ID if provided
    let milestoneId = null;
    if (milestone) {
      const milestoneQuery = `
        query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            milestone(number: $number) {
              id
            }
          }
        }
      `;
      const milestoneResult: any = await graphqlWithAuth(milestoneQuery, { owner, repo, number: milestone });
      milestoneId = milestoneResult.repository?.milestone?.id;
    }

    const variables = {
      repositoryId,
      title,
      body: body || null,
      labelIds,
      assigneeIds,
      milestoneId,
    };

    const result: any = await graphqlWithAuth(mutation, variables);
    const createdIssue = result.createIssue.issue;

    // Link to parent issue if specified
    if (parentIssueNumber) {
      try {
        await this.linkIssues({
          owner,
          repo,
          parentIssueNumber,
          childIssueNumber: createdIssue.number,
          linkType: 'tracks',
        });
        
        // Add parent info to the response
        createdIssue.parentIssue = {
          number: parentIssueNumber,
          relationship: 'tracks',
        };
      } catch (linkError) {
        // Include link error in response but don't fail the whole operation
        createdIssue.linkError = linkError instanceof Error ? linkError.message : String(linkError);
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(createdIssue, null, 2),
        },
      ],
    };
  }

  private async updateIssue(args: any) {
    let { owner, repo, issueNumber, title, body, state, labels, assignees, milestone } = args;
    
    // Ensure owner is lowercase
    owner = owner.toLowerCase();

    // Get issue ID
    const issueQuery = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
          }
        }
      }
    `;
    const issueResult: any = await graphqlWithAuth(issueQuery, { owner, repo, number: issueNumber });
    const issueId = issueResult.repository?.issue?.id;

    if (!issueId) {
      console.error('Issue query result:', JSON.stringify(issueResult, null, 2));
      throw new McpError(ErrorCode.InvalidRequest, `Issue #${issueNumber} not found in ${owner}/${repo}`);
    }

    // Build update input dynamically
    const updateInput: any = { id: issueId };
    
    // Debug logging to verify the input structure
    console.error('Building updateInput with issueId:', issueId);
    
    if (title !== undefined) updateInput.title = title;
    if (body !== undefined) updateInput.body = body;
    if (state !== undefined) updateInput.state = state.toUpperCase();

    // Handle labels if provided
    if (labels !== undefined) {
      const labelsQuery = `
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            labels(first: 100) {
              nodes {
                id
                name
              }
            }
          }
        }
      `;
      const labelsResult: any = await graphqlWithAuth(labelsQuery, { owner, repo });
      const repoLabels = labelsResult.repository?.labels?.nodes || [];
      updateInput.labelIds = labels.map((labelName: string) => {
        const label = repoLabels.find((l: any) => l.name === labelName);
        return label?.id;
      }).filter(Boolean);
    }

    // Handle assignees if provided
    if (assignees !== undefined) {
      updateInput.assigneeIds = await Promise.all(assignees.map(async (username: string) => {
        const userQuery = `
          query($username: String!) {
            user(login: $username) {
              id
            }
          }
        `;
        const userResult: any = await graphqlWithAuth(userQuery, { username });
        return userResult.user?.id;
      }));
      updateInput.assigneeIds = updateInput.assigneeIds.filter(Boolean);
    }

    // Handle milestone if provided
    if (milestone !== undefined) {
      if (milestone === null) {
        updateInput.milestoneId = null;
      } else {
        const milestoneQuery = `
          query($owner: String!, $repo: String!, $number: Int!) {
            repository(owner: $owner, name: $repo) {
              milestone(number: $number) {
                id
              }
            }
          }
        `;
        const milestoneResult: any = await graphqlWithAuth(milestoneQuery, { owner, repo, number: milestone });
        updateInput.milestoneId = milestoneResult.repository?.milestone?.id;
      }
    }

    // Debug log the final updateInput before mutation
    console.error('Final updateInput:', JSON.stringify(updateInput, null, 2));

    const mutation = `
      mutation($input: UpdateIssueInput!) {
        updateIssue(input: $input) {
          issue {
            id
            number
            title
            body
            state
            url
            updatedAt
            labels(first: 10) {
              nodes {
                name
                color
              }
            }
            assignees(first: 10) {
              nodes {
                login
              }
            }
            milestone {
              title
              number
            }
          }
        }
      }
    `;

    const result: any = await graphqlWithAuth(mutation, { input: updateInput });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.updateIssue.issue, null, 2),
        },
      ],
    };
  }

  private async listIssues(args: any) {
    let { owner, repo, state = 'open', labels, assignee, first = 20 } = args;
    
    // Ensure owner is lowercase
    owner = owner.toLowerCase();

    let stateFilter = '';
    if (state !== 'all') {
      stateFilter = `, states: ${state.toUpperCase()}`;
    }

    let labelsFilter = '';
    if (labels && labels.length > 0) {
      labelsFilter = `, labels: ${JSON.stringify(labels)}`;
    }

    let assigneeFilter = '';
    if (assignee) {
      assigneeFilter = `, filterBy: { assignee: "${assignee}" }`;
    }

    const query = `
      query($owner: String!, $repo: String!, $first: Int!) {
        repository(owner: $owner, name: $repo) {
          issues(first: $first${stateFilter}${labelsFilter}${assigneeFilter}, orderBy: {field: CREATED_AT, direction: DESC}) {
            nodes {
              id
              number
              title
              body
              state
              url
              createdAt
              updatedAt
              author {
                login
              }
              labels(first: 5) {
                nodes {
                  name
                  color
                }
              }
              assignees(first: 5) {
                nodes {
                  login
                }
              }
            }
            totalCount
          }
        }
      }
    `;

    const result: any = await graphqlWithAuth(query, { owner, repo, first });
    const issues = result.repository?.issues || { nodes: [], totalCount: 0 };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(issues, null, 2),
        },
      ],
    };
  }

  private async getIssue(args: any) {
    let { owner, repo, issueNumber } = args;
    
    // Ensure owner is lowercase
    owner = owner.toLowerCase();

    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
            number
            title
            body
            state
            url
            createdAt
            updatedAt
            closedAt
            author {
              login
            }
            labels(first: 10) {
              nodes {
                name
                color
                description
              }
            }
            assignees(first: 10) {
              nodes {
                login
                name
              }
            }
            milestone {
              title
              number
              description
              dueOn
              state
            }
            projectItems(first: 10) {
              nodes {
                project {
                  title
                  number
                }
              }
            }
            comments(first: 5) {
              totalCount
              nodes {
                author {
                  login
                }
                body
                createdAt
              }
            }
          }
        }
      }
    `;

    const result: any = await graphqlWithAuth(query, { owner, repo, number: issueNumber });
    const issue = result.repository?.issue;

    if (!issue) {
      throw new McpError(ErrorCode.InvalidRequest, 'Issue not found');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(issue, null, 2),
        },
      ],
    };
  }

  private async ensureLabels(args: any) {
    let { owner, repo, labels } = args;
    
    // Ensure owner is lowercase
    owner = owner.toLowerCase();
    
    // Default labels for issue types
    const defaultLabels = [
      { name: 'epic', color: '6B46C1', description: 'Large initiative or milestone' },
      { name: 'feature', color: '0E8A16', description: 'New feature or enhancement' },
      { name: 'bug', color: 'D73A4A', description: 'Something isn\'t working' },
      { name: 'task', color: '0075CA', description: 'General task or chore' },
      { name: 'story', color: '1D76DB', description: 'User story' },
      { name: 'documentation', color: '0052CC', description: 'Documentation updates' },
    ];
    
    const labelsToEnsure = labels || defaultLabels;
    
    // Get repository ID
    const repoQuery = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
        }
      }
    `;
    const repoResult: any = await graphqlWithAuth(repoQuery, { owner, repo });
    const repositoryId = repoResult.repository?.id;
    
    if (!repositoryId) {
      throw new McpError(ErrorCode.InvalidRequest, 'Repository not found');
    }
    
    // Get existing labels
    const existingLabelsQuery = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          labels(first: 100) {
            nodes {
              id
              name
            }
          }
        }
      }
    `;
    const existingLabelsResult: any = await graphqlWithAuth(existingLabelsQuery, { owner, repo });
    const existingLabels = existingLabelsResult.repository?.labels?.nodes || [];
    const existingLabelNames = existingLabels.map((l: any) => l.name.toLowerCase());
    
    const results = [];
    
    // Create missing labels
    for (const labelDef of labelsToEnsure) {
      if (!existingLabelNames.includes(labelDef.name.toLowerCase())) {
        try {
          const createLabelMutation = `
            mutation($repositoryId: ID!, $name: String!, $color: String!, $description: String) {
              createLabel(input: {
                repositoryId: $repositoryId,
                name: $name,
                color: $color,
                description: $description
              }) {
                label {
                  id
                  name
                  color
                  description
                }
              }
            }
          `;
          
          const result: any = await graphqlWithAuth(createLabelMutation, {
            repositoryId,
            name: labelDef.name,
            color: labelDef.color,
            description: labelDef.description,
          });
          
          results.push({
            action: 'created',
            label: result.createLabel.label,
          });
        } catch (error) {
          results.push({
            action: 'error',
            label: labelDef.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        results.push({
          action: 'exists',
          label: labelDef.name,
        });
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  private async linkIssues(args: any) {
    let { owner, repo, parentIssueNumber, childIssueNumber, linkType = 'tracks' } = args;
    
    // Ensure owner is lowercase
    owner = owner.toLowerCase();
    
    // First, add a comment in the parent issue referencing the child
    const parentComment = linkType === 'tracks' 
      ? `Tracks #${childIssueNumber}`
      : linkType === 'blocks'
      ? `Blocks #${childIssueNumber}`
      : `Related to #${childIssueNumber}`;
    
    // Get parent issue ID and body
    const parentQuery = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
            title
            body
            labels(first: 10) {
              nodes {
                name
              }
            }
          }
        }
      }
    `;
    const parentResult: any = await graphqlWithAuth(parentQuery, { owner, repo, number: parentIssueNumber });
    const parentIssueId = parentResult.repository?.issue?.id;
    const parentIssueTitle = parentResult.repository?.issue?.title;
    const parentIssueBody = parentResult.repository?.issue?.body || '';
    
    if (!parentIssueId) {
      throw new McpError(ErrorCode.InvalidRequest, 'Parent issue not found');
    }
    
    // Get child issue ID
    const childQuery = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
            title
            body
          }
        }
      }
    `;
    const childResult: any = await graphqlWithAuth(childQuery, { owner, repo, number: childIssueNumber });
    const childIssueId = childResult.repository?.issue?.id;
    const childIssueTitle = childResult.repository?.issue?.title;
    const childIssueBody = childResult.repository?.issue?.body || '';
    
    if (!childIssueId) {
      throw new McpError(ErrorCode.InvalidRequest, 'Child issue not found');
    }
    
    // Add comment to parent issue
    const addParentCommentMutation = `
      mutation($issueId: ID!, $body: String!) {
        addComment(input: {subjectId: $issueId, body: $body}) {
          commentEdge {
            node {
              id
            }
          }
        }
      }
    `;
    
    await graphqlWithAuth(addParentCommentMutation, {
      issueId: parentIssueId,
      body: parentComment,
    });
    
    // Add comment to child issue with parent reference
    const childComment = linkType === 'tracks'
      ? `Tracked by #${parentIssueNumber}`
      : linkType === 'blocks'
      ? `Blocked by #${parentIssueNumber}`
      : `Related to #${parentIssueNumber}`;
    
    await graphqlWithAuth(addParentCommentMutation, {
      issueId: childIssueId,
      body: childComment,
    });
    
    // Update child issue body to include parent reference if it's a tracks relationship
    if (linkType === 'tracks') {
      const parentRef = `\n\n---\n**Parent:** #${parentIssueNumber} - ${parentIssueTitle}`;
      const updatedBody = childIssueBody.includes('**Parent:**') 
        ? childIssueBody.replace(/\n\n---\n\*\*Parent:\*\*.+/, parentRef)
        : childIssueBody + parentRef;
      
      const updateBodyMutation = `
        mutation($issueId: ID!, $body: String!) {
          updateIssue(input: {id: $issueId, body: $body}) {
            issue {
              id
            }
          }
        }
      `;
      
      await graphqlWithAuth(updateBodyMutation, {
        issueId: childIssueId,
        body: updatedBody,
      });
      
      // Update parent issue body with GitHub's task list format for native tracking
      // This creates trackable relationships in GitHub
      const childTaskItem = `- [ ] #${childIssueNumber} ${childIssueTitle}`;
      let updatedParentBody = parentIssueBody;
      
      // Look for existing task list in the body
      const taskListRegex = /(^|\n)(- \[[ x]\] #\d+.*\n)+/gm;
      const hasTaskList = taskListRegex.test(updatedParentBody);
      
      if (hasTaskList) {
        // Check if this child is already in the task list
        if (!updatedParentBody.includes(`#${childIssueNumber}`)) {
          // Find the last task item and add after it
          updatedParentBody = updatedParentBody.replace(taskListRegex, (match: string) => {
            return match.trimEnd() + '\n' + childTaskItem + '\n';
          });
        }
      } else {
        // Add task list at the beginning of the body for better visibility
        const tasksSection = `### Tasks\n${childTaskItem}\n\n`;
        updatedParentBody = tasksSection + updatedParentBody;
      }
      
      // Update parent issue body
      await graphqlWithAuth(updateBodyMutation, {
        issueId: parentIssueId,
        body: updatedParentBody,
      });
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            parent: {
              number: parentIssueNumber,
              title: parentIssueTitle,
            },
            child: {
              number: childIssueNumber,
              title: childIssueTitle,
            },
            relationship: linkType,
          }, null, 2),
        },
      ],
    };
  }

  private async setParent(args: any) {
    let { owner, repo, issueNumber, parentIssueNumber } = args;
    
    // Ensure owner is lowercase
    owner = owner.toLowerCase();
    
    // Simply call linkIssues with the child and parent swapped to match expected behavior
    return await this.linkIssues({
      owner,
      repo,
      parentIssueNumber,
      childIssueNumber: issueNumber,
      linkType: 'tracks'
    });
  }

  private async addSubIssue(args: any) {
    let { owner, repo, parentIssueNumber, childIssueNumber } = args;
    
    // Ensure owner is lowercase
    owner = owner.toLowerCase();
    
    // First, get both issues' node IDs
    const query = `
      query($owner: String!, $repo: String!, $parentNumber: Int!, $childNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          parentIssue: issue(number: $parentNumber) {
            id
            title
          }
          childIssue: issue(number: $childNumber) {
            id
            title
          }
        }
      }
    `;
    
    const result: any = await graphqlWithAuth(query, { 
      owner, 
      repo, 
      parentNumber: parentIssueNumber,
      childNumber: childIssueNumber 
    });
    
    const parentId = result.repository?.parentIssue?.id;
    const childId = result.repository?.childIssue?.id;
    const parentTitle = result.repository?.parentIssue?.title;
    const childTitle = result.repository?.childIssue?.title;
    
    if (!parentId || !childId) {
      throw new McpError(
        ErrorCode.InvalidRequest, 
        !parentId ? 'Parent issue not found' : 'Child issue not found'
      );
    }
    
    try {
      // Try using GitHub's beta addSubIssue mutation
      const addSubIssueMutation = `
        mutation($parentId: ID!, $childId: ID!) {
          addSubIssue(input: {
            issueId: $parentId,
            subIssueId: $childId
          }) {
            parentIssue {
              id
              number
              title
            }
            subIssue {
              id
              number
              title
            }
          }
        }
      `;
      
      const mutationResult: any = await graphqlWithAuth(addSubIssueMutation, {
        parentId,
        childId
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              relationship: 'native_sub_issue',
              parent: {
                number: parentIssueNumber,
                title: parentTitle,
              },
              child: {
                number: childIssueNumber,
                title: childTitle,
              },
              result: mutationResult.addSubIssue
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      // If the beta API fails, try the convertProjectCardNoteToIssue approach
      // or fall back to our enhanced linking approach
      console.error('Beta API failed:', error.message);
      
      // If beta API is not available, use our enhanced approach
      if (error.message.includes('Field \'addSubIssue\' doesn\'t exist') || 
          error.message.includes('Unknown field')) {
        
        // Fall back to our enhanced linking with task lists
        return await this.linkIssues({
          owner,
          repo,
          parentIssueNumber,
          childIssueNumber,
          linkType: 'tracks'
        });
      }
      
      throw error;
    }
  }

  private async getIssueHierarchy(args: any) {
    let { owner, repo, issueNumber } = args;
    
    // Ensure owner is lowercase
    owner = owner.toLowerCase();
    
    // Get the issue and its comments to find relationships
    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
            number
            title
            body
            state
            labels(first: 10) {
              nodes {
                name
              }
            }
            comments(first: 100) {
              nodes {
                body
                author {
                  login
                }
              }
            }
          }
        }
      }
    `;
    
    const result: any = await graphqlWithAuth(query, { owner, repo, number: issueNumber });
    const issue = result.repository?.issue;
    
    if (!issue) {
      throw new McpError(ErrorCode.InvalidRequest, 'Issue not found');
    }
    
    // Extract relationships from comments and body
    const hierarchy: any = {
      current: {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels: issue.labels.nodes.map((l: any) => l.name),
        type: this.detectIssueType(issue.title, issue.body),
      },
      parents: [],
      children: [],
    };
    
    // Find parent references in body
    const parentMatch = issue.body?.match(/\*\*Parent:\*\* #(\d+)/);
    if (parentMatch) {
      const parentNumber = parseInt(parentMatch[1]);
      try {
        const parentQuery = `
          query($owner: String!, $repo: String!, $number: Int!) {
            repository(owner: $owner, name: $repo) {
              issue(number: $number) {
                number
                title
                state
                labels(first: 5) {
                  nodes {
                    name
                  }
                }
              }
            }
          }
        `;
        const parentResult: any = await graphqlWithAuth(parentQuery, { owner, repo, number: parentNumber });
        if (parentResult.repository?.issue) {
          hierarchy.parents.push({
            number: parentResult.repository.issue.number,
            title: parentResult.repository.issue.title,
            state: parentResult.repository.issue.state,
            labels: parentResult.repository.issue.labels.nodes.map((l: any) => l.name),
            type: this.detectIssueType(parentResult.repository.issue.title, ''),
          });
        }
      } catch (e) {
        // Parent might be deleted or inaccessible
      }
    }
    
    // Find child references in comments
    const childPattern = /Tracks #(\d+)/g;
    const comments = issue.comments.nodes || [];
    const childNumbers = new Set<number>();
    
    for (const comment of comments) {
      let match;
      while ((match = childPattern.exec(comment.body)) !== null) {
        childNumbers.add(parseInt(match[1]));
      }
    }
    
    // Fetch details for each child
    for (const childNumber of childNumbers) {
      try {
        const childQuery = `
          query($owner: String!, $repo: String!, $number: Int!) {
            repository(owner: $owner, name: $repo) {
              issue(number: $number) {
                number
                title
                state
                labels(first: 5) {
                  nodes {
                    name
                  }
                }
              }
            }
          }
        `;
        const childResult: any = await graphqlWithAuth(childQuery, { owner, repo, number: childNumber });
        if (childResult.repository?.issue) {
          hierarchy.children.push({
            number: childResult.repository.issue.number,
            title: childResult.repository.issue.title,
            state: childResult.repository.issue.state,
            labels: childResult.repository.issue.labels.nodes.map((l: any) => l.name),
            type: this.detectIssueType(childResult.repository.issue.title, ''),
          });
        }
      } catch (e) {
        // Child might be deleted or inaccessible
      }
    }
    
    // Sort children by type (features before stories/tasks)
    const typeOrder = { epic: 0, feature: 1, story: 2, task: 3, bug: 4, documentation: 5 };
    hierarchy.children.sort((a: any, b: any) => {
      const aOrder = typeOrder[a.type as keyof typeof typeOrder] ?? 6;
      const bOrder = typeOrder[b.type as keyof typeof typeOrder] ?? 6;
      return aOrder - bOrder;
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(hierarchy, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GitHub Projects MCP Server running...');
  }
}

const server = new GitHubProjectsServer();
server.run().catch(console.error);