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
    const { owner, repo, projectsType = 'repository' } = args;

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
    const { projectNumber, owner, repo } = args;

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
    const { owner, repo, title } = args;

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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GitHub Projects MCP Server running...');
  }
}

const server = new GitHubProjectsServer();
server.run().catch(console.error);