# Workspace Feature Documentation

## Overview

The YouTube Knowledge Graph now supports **workspaces** - complete data isolation sandboxes that allow you to maintain separate knowledge graphs for different domains or projects.

## What are Workspaces?

Workspaces provide complete isolation between different knowledge domains. Each workspace maintains:

- **Independent Neo4j database**: Each workspace uses a separate Neo4j database (`workspace_<name>`)
- **Isolated data**: Videos, segments, concepts, and relationships are completely separate
- **Separate vector indices**: Semantic search results never cross workspace boundaries
- **No concept collisions**: The same concept name can exist in multiple workspaces with different meanings

### Example Use Cases

- **Multi-domain content**: Separate "health", "finance", and "ecommerce" workspaces
- **Client separation**: Different workspaces for different clients or projects
- **Testing**: Separate "production" and "staging" workspaces
- **Language separation**: Different workspaces for different languages

## Architecture

The workspace implementation uses:

1. **AsyncLocalStorage** (Node.js): Maintains workspace context throughout the request lifecycle without passing parameters
2. **Neo4j Multi-Database**: Each workspace gets its own Neo4j database
3. **Workspace-specific vector indices**: Semantic search is scoped to the current workspace
4. **Request middleware**: Automatically extracts workspace from headers/query params

## Setup

### 1. Update Docker Configuration

The workspace feature requires Neo4j Enterprise Edition (included in docker-compose.yml):

```bash
docker-compose up -d
```

The updated configuration uses `neo4j:5.15-enterprise` which supports multiple databases.

### 2. Run Migration Script

Create the default workspace and initialize its schema:

```bash
npx tsx scripts/migrate-to-workspaces.ts
```

### 3. Create Additional Workspaces

#### Via UI
1. Navigate to `/workspaces` in your browser
2. Enter a workspace name (lowercase, alphanumeric, underscores only)
3. Click "Create"

#### Via CLI
```bash
npx tsx scripts/create-workspace.ts health
npx tsx scripts/create-workspace.ts ecommerce
```

#### Via API
```bash
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{"workspace": "health"}'
```

## Usage

### Frontend (UI)

The workspace selector appears in the navigation bar. Simply select your desired workspace from the dropdown. The page will reload and all subsequent operations will use the selected workspace.

### API Calls

#### Option 1: Using the API Client (Recommended)

The API client automatically includes the workspace from localStorage:

```typescript
import { apiGet, apiPost } from '@/lib/api-client';

// Automatically uses the current workspace
const concepts = await apiGet('/api/concepts');
const result = await apiPost('/api/segments/ingest', { videoUrl: '...' });
```

#### Option 2: Manual Headers

Include the `X-Workspace` header in your requests:

```typescript
fetch('/api/concepts', {
  headers: {
    'X-Workspace': 'health'
  }
});
```

#### Option 3: Query Parameters

Add the `workspace` query parameter:

```
GET /api/concepts?workspace=health
POST /api/segments/ingest?workspace=health
```

### Backend (API Routes)

Wrap your API route handlers with `withWorkspace`:

```typescript
import { withWorkspace } from '@/lib/workspace-context';
import { NextResponse } from 'next/server';
import { getAllConcepts } from '@/lib/neo4j/queries';

export const GET = withWorkspace(async () => {
  // getAllConcepts automatically uses the current workspace
  const concepts = await getAllConcepts();
  return NextResponse.json({ concepts });
});
```

### Database Queries

All database queries automatically use the current workspace:

```typescript
import { getSession } from '@/lib/neo4j/client';

// getSession() automatically connects to the correct workspace database
const session = getSession();
const result = await session.run('MATCH (n:Concept) RETURN n');
```

## Workspace Management

### List Workspaces

**API:**
```bash
GET /api/workspaces
```

**CLI:**
```typescript
import { listWorkspaces } from '@/lib/neo4j/client';
const workspaces = await listWorkspaces();
```

### Create Workspace

**API:**
```bash
POST /api/workspaces
Content-Type: application/json

{"workspace": "health"}
```

**CLI:**
```bash
npx tsx scripts/create-workspace.ts health
```

### Delete Workspace

**API:**
```bash
DELETE /api/workspaces/health
```

**Note:** Cannot delete the `default` workspace or the currently active workspace.

### Switch Workspace

**UI:** Use the workspace dropdown in the navigation bar

**Programmatically:**
```typescript
import { setWorkspace } from '@/lib/api-client';
setWorkspace('health');
window.location.reload(); // Reload to fetch new workspace data
```

## Implementation Details

### Context Management

The workspace context is managed using Node.js's `AsyncLocalStorage`, which provides request-scoped storage without passing parameters through every function:

```typescript
// lib/workspace-context.ts
import { AsyncLocalStorage } from 'async_hooks';

const workspaceStorage = new AsyncLocalStorage<string>();

export function getCurrentWorkspace(): string {
  return workspaceStorage.getStore() || 'default';
}
```

### Database Isolation

Each workspace gets its own Neo4j database:

- Default workspace: `workspace_default`
- Health workspace: `workspace_health`
- Custom workspace: `workspace_<name>`

The session creation automatically uses the correct database:

```typescript
// lib/neo4j/client.ts
export function getSession(): Session {
  const workspace = getCurrentWorkspace();
  return driver.session({
    database: `workspace_${workspace}`
  });
}
```

### Vector Search Isolation

Vector indices are created per-workspace:

- Concept embeddings: `concept_embeddings_<workspace>`
- Segment embeddings: `segment_embeddings_<workspace>`

This ensures semantic search results never cross workspace boundaries.

## Migrating Existing API Routes

To update an existing API route to support workspaces:

**Before:**
```typescript
export async function GET() {
  const concepts = await getAllConcepts();
  return NextResponse.json({ concepts });
}
```

**After:**
```typescript
import { withWorkspace } from '@/lib/workspace-context';

export const GET = withWorkspace(async () => {
  const concepts = await getAllConcepts();
  return NextResponse.json({ concepts });
});
```

No changes needed to the query functions - they automatically use the workspace context!

## Best Practices

1. **Always use the `withWorkspace` wrapper** for API routes
2. **Use the API client** (`apiGet`, `apiPost`, etc.) for frontend requests
3. **Name workspaces descriptively**: Use clear names like "health", "ecommerce", not "workspace1"
4. **Don't delete the default workspace**: Keep it as a fallback
5. **Test workspace isolation**: Verify that data doesn't leak between workspaces

## Troubleshooting

### "Invalid workspace name" error
Workspace names must be lowercase alphanumeric with underscores only. Valid: `health_test`, `ecommerce_v2`. Invalid: `Health-Test`, `eCommerce V2`.

### Vector search not finding results
Make sure vector indices are created for your workspace. When you create a workspace via the API or scripts, indices are automatically created. If needed, manually create them:

```typescript
import { createVectorIndexes } from '@/lib/neo4j/vector';
import { runWithWorkspaceAsync } from '@/lib/workspace-context';

await runWithWorkspaceAsync('health', async () => {
  await createVectorIndexes();
});
```

### Data appears in wrong workspace
Check that:
1. The `X-Workspace` header is being sent correctly
2. The API route is wrapped with `withWorkspace`
3. The middleware is configured correctly (should be automatic)

## Advanced Usage

### Running code in a specific workspace context

```typescript
import { runWithWorkspaceAsync } from '@/lib/workspace-context';

// Run operations in the 'health' workspace
await runWithWorkspaceAsync('health', async () => {
  const session = getSession(); // Connects to workspace_health
  await session.run('CREATE (n:Test {name: "test"})');
  await session.close();
});
```

### Cross-workspace operations

If you need to query multiple workspaces (rare), use `runWithWorkspaceAsync`:

```typescript
const healthData = await runWithWorkspaceAsync('health', async () => {
  return await getAllConcepts();
});

const ecommerceData = await runWithWorkspaceAsync('ecommerce', async () => {
  return await getAllConcepts();
});
```

## FAQ

**Q: Can I share data between workspaces?**
A: No, workspaces are completely isolated. This is by design to prevent concept collisions and maintain data integrity.

**Q: Do I need Neo4j Enterprise?**
A: Yes, for true multi-database support. Alternatively, you can run multiple Neo4j Community Edition containers on different ports.

**Q: Can I rename a workspace?**
A: Not directly. You would need to create a new workspace and migrate the data manually.

**Q: What happens if I don't specify a workspace?**
A: The system defaults to the 'default' workspace.

**Q: Can I backup individual workspaces?**
A: Yes! Each workspace is a separate Neo4j database, so you can backup/restore them individually using Neo4j's database management commands.

## Support

For issues or questions about workspaces, please open an issue on the GitHub repository.
