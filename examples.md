# GitHub Projects MCP Server - Example Queries

This document provides example GraphQL queries used by the MCP server and demonstrates how to interact with GitHub Projects.

## GraphQL Query Examples

### 1. List Repository Projects

```graphql
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
```

### 2. List Organization Projects

```graphql
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
```

### 3. Get Project Details with Fields

```graphql
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
```

### 4. List Project Items

```graphql
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
```

### 5. Add Item to Project

```graphql
mutation($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
    item {
      id
      createdAt
    }
  }
}
```

### 6. Update Project Item Field

```graphql
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
```

## Common Field Types

GitHub Projects support various field types:

- **Text**: Plain text fields
- **Number**: Numeric values
- **Date**: Date values
- **Single Select**: Dropdown with predefined options
- **Iteration**: Sprint/iteration tracking
- **Milestone**: GitHub milestones
- **Labels**: GitHub labels
- **Assignees**: User assignments

## Working with Node IDs

GitHub's GraphQL API uses global node IDs. Here's how to find them:

1. **Project ID**: Returned when listing projects
2. **Issue/PR ID**: Available in issue/PR GraphQL queries
3. **Field ID**: Listed in project field queries
4. **Item ID**: Returned when listing project items

## Error Handling

Common errors and solutions:

1. **Authentication Error**: Ensure your GitHub token has the required scopes
2. **Not Found**: Verify the owner, repo, and project number
3. **Permission Denied**: Check if the token has access to private repositories/projects
4. **Invalid Field Value**: Ensure the value matches the field type

## Rate Limiting

GitHub GraphQL API has rate limits:
- Authenticated requests: 5,000 points per hour
- Each query consumes points based on complexity
- Monitor the `X-RateLimit-*` headers in responses