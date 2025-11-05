# Work Plan: Complete Isolation Sandboxing (Workspaces)

## Problem
Currently, all segments, concepts, and videos exist in a single shared knowledge graph. This causes issues when working with content from different domains:
- Concept name collisions (e.g., "conversion" in health vs. e-commerce contexts)
- Mixed search results across unrelated domains
- No way to focus queries on specific knowledge domains
- Risk of incorrect concept normalization across domains

**Example:** Health videos and Shopify e-commerce videos should be completely separate - no shared concepts, no cross-references, isolated search results.

## Goal
Implement complete isolation through **workspaces** (sandboxes) where each workspace maintains its own isolated knowledge graph. Users can work within a specific workspace, and all data (segments, concepts, videos, embeddings, relationships) are scoped to that workspace.

---

## Architecture Design

### Option 1: Database-Level Isolation (RECOMMENDED)
- Each workspace gets its own Neo4j database
- Complete physical separation
- Separate vector indices per workspace
- No risk of data leakage
- Easiest to reason about and secure

**Pros:**
- True isolation, no query filtering needed
- Better performance (smaller graphs per workspace)
- Easy to backup/restore individual workspaces
- Simpler queries (no workspace filtering)

**Cons:**
- More complex connection management
- Requires Neo4j Enterprise for multiple databases (or separate Docker containers)
- Cannot easily query across workspaces if needed later

### Option 2: Label-Based Isolation (ALTERNATIVE)
- Single database with workspace labels on all nodes
- All queries filtered by workspace
- Single vector index with workspace metadata filtering

**Pros:**
- Works with Neo4j Community Edition
- Simpler infrastructure
- Can query across workspaces if needed

**Cons:**
- Must remember to filter every query
- Higher risk of bugs/data leakage
- Larger graph = slower queries
- More complex query patterns

**DECISION:** Use **Option 1 (Database-Level Isolation)** for true complete isolation.

---

## Implementation Plan

### Phase 1: Infrastructure Setup

#### Step 1.1: Multi-Database Neo4j Setup
**Goal:** Configure Neo4j to support multiple databases (one per workspace)

**For Development (Docker):**
```yaml
# docker-compose.yml
services:
  neo4j:
    image: neo4j:5.15-enterprise  # Enterprise supports multiple DBs
    environment:
      - NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
      - NEO4J_AUTH=neo4j/password123
      - NEO4J_server_databases_default__to__read__only=false
    # Or use Community Edition with multiple Docker containers
```

**For Community Edition Alternative:**
- Run multiple Neo4j containers (one per workspace)
- Map different ports: 7474 (workspace1), 7475 (workspace2), etc.

**Tasks:**
- [ ] Update docker-compose.yml for multi-database support
- [ ] Document workspace creation commands
- [ ] Create init script to set up default workspaces

#### Step 1.2: Database Connection Management
**File:** `lib/neo4j/client.ts`

**Current:**
```typescript
export function getSession() {
  return driver.session();
}
```

**Update to:**
```typescript
export function getSession(workspace: string = 'default') {
  // Validate workspace name
  if (!isValidWorkspace(workspace)) {
    throw new Error(`Invalid workspace: ${workspace}`);
  }

  return driver.session({
    database: `workspace_${workspace}`,
  });
}

export function isValidWorkspace(workspace: string): boolean {
  // Alphanumeric and underscores only
  return /^[a-z0-9_]+$/.test(workspace);
}

export async function listWorkspaces(): Promise<string[]> {
  const session = driver.session({ database: 'system' });
  try {
    const result = await session.run('SHOW DATABASES');
    return result.records
      .map(r => r.get('name'))
      .filter(name => name.startsWith('workspace_'))
      .map(name => name.replace('workspace_', ''));
  } finally {
    await session.close();
  }
}

export async function createWorkspace(workspace: string): Promise<void> {
  if (!isValidWorkspace(workspace)) {
    throw new Error(`Invalid workspace name: ${workspace}`);
  }

  const session = driver.session({ database: 'system' });
  try {
    await session.run(`CREATE DATABASE workspace_${workspace} IF NOT EXISTS`);
  } finally {
    await session.close();
  }
}

export async function deleteWorkspace(workspace: string): Promise<void> {
  if (workspace === 'default') {
    throw new Error('Cannot delete default workspace');
  }

  const session = driver.session({ database: 'system' });
  try {
    await session.run(`DROP DATABASE workspace_${workspace} IF EXISTS`);
  } finally {
    await session.close();
  }
}
```

---

### Phase 2: API Layer Changes

#### Step 2.1: Add Workspace Context to All API Routes
**Strategy:** Add workspace parameter to all API endpoints

**Options for Workspace Selection:**
1. **Query Parameter:** `/api/segments?workspace=health`
2. **Header:** `X-Workspace: health`
3. **Path Prefix:** `/api/health/segments`
4. **Subdomain:** `health.yourdomain.com/api/segments`

**RECOMMENDATION:** Use **Header + Query Parameter** (flexible, works with both approaches)

**Middleware Implementation:**
**File:** `middleware/workspace.ts` (NEW)
```typescript
import { NextRequest } from 'next/server';

export function getWorkspaceFromRequest(request: NextRequest): string {
  // Priority: header > query param > default
  const headerWorkspace = request.headers.get('X-Workspace');
  const queryWorkspace = request.nextUrl.searchParams.get('workspace');

  return headerWorkspace || queryWorkspace || 'default';
}
```

#### Step 2.2: Update All Query Functions
**All files in:** `lib/neo4j/queries.ts`

**Pattern for all functions:**
```typescript
// BEFORE
export async function getAllConcepts(): Promise<Concept[]> {
  const session = getSession();
  // ...
}

// AFTER
export async function getAllConcepts(workspace: string = 'default'): Promise<Concept[]> {
  const session = getSession(workspace);
  // ...
}
```

**Files to Update:**
- `lib/neo4j/queries.ts` - Add workspace parameter to all 20+ functions
- `lib/utils/ingest.ts` - Pass workspace through ingestion pipeline
- All API routes in `app/api/` - Extract and pass workspace

#### Step 2.3: Update API Routes
**Pattern for all API routes:**

**Example:** `app/api/concepts/route.ts`
```typescript
import { getWorkspaceFromRequest } from '@/middleware/workspace';

export async function GET(request: NextRequest) {
  const workspace = getWorkspaceFromRequest(request);

  try {
    const concepts = await getAllConcepts(workspace);
    return NextResponse.json(concepts);
  } catch (error) {
    // ...
  }
}
```

**Routes to Update:**
- `app/api/concepts/route.ts`
- `app/api/concepts/[id]/route.ts`
- `app/api/segments/route.ts`
- `app/api/segments/[id]/route.ts`
- `app/api/segments/ingest/route.ts`
- `app/api/videos/route.ts`
- `app/api/videos/[id]/route.ts`
- `app/api/graph/route.ts`
- `app/api/chat/route.ts`
- `app/api/backfill/route.ts`

---

### Phase 3: Vector Search Isolation

#### Step 3.1: Workspace-Specific Vector Indices
**File:** `scripts/create-vector-index.ts`

**Current:** Single vector index
```cypher
CREATE VECTOR INDEX segmentEmbeddings IF NOT EXISTS
FOR (s:Segment) ON (s.embedding)
```

**Update to:** Per-workspace indices
```typescript
export async function createVectorIndices(workspace: string) {
  const session = getSession(workspace);

  try {
    // Segment embeddings index
    await session.run(`
      CREATE VECTOR INDEX segmentEmbeddings_${workspace} IF NOT EXISTS
      FOR (s:Segment) ON (s.embedding)
      OPTIONS {
        indexConfig: {
          \`vector.dimensions\`: 768,
          \`vector.similarity_function\`: 'cosine'
        }
      }
    `);

    // Concept embeddings index
    await session.run(`
      CREATE VECTOR INDEX conceptEmbeddings_${workspace} IF NOT EXISTS
      FOR (c:Concept) ON (c.embedding)
      OPTIONS {
        indexConfig: {
          \`vector.dimensions\`: 768,
          \`vector.similarity_function\`: 'cosine'
        }
      }
    `);
  } finally {
    await session.close();
  }
}
```

#### Step 3.2: Update Vector Search Functions
**File:** `lib/ai/embeddings.ts`

**Update searchSimilarSegments:**
```typescript
export async function searchSimilarSegments(
  queryEmbedding: number[],
  limit: number = 5,
  workspace: string = 'default'
): Promise<any[]> {
  const session = getSession(workspace);

  try {
    const result = await session.run(
      `
      CALL db.index.vector.queryNodes(
        'segmentEmbeddings_${workspace}',
        $limit,
        $embedding
      )
      YIELD node, score
      MATCH (node)-[:FROM_VIDEO]->(v:Video)
      RETURN node, score, v
      ORDER BY score DESC
      `,
      { embedding: queryEmbedding, limit: neo4j.int(limit) }
    );
    // ...
  } finally {
    await session.close();
  }
}
```

---

### Phase 4: UI/Frontend Changes

#### Step 4.1: Workspace Selector Component
**File:** `components/workspace-selector.tsx` (NEW)
```typescript
'use client';

import { useState, useEffect } from 'react';

export function WorkspaceSelector() {
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState('default');

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('workspace');
    if (saved) setCurrentWorkspace(saved);

    // Fetch available workspaces
    fetch('/api/workspaces')
      .then(r => r.json())
      .then(data => setWorkspaces(data.workspaces));
  }, []);

  const handleChange = (workspace: string) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem('workspace', workspace);
    window.location.reload(); // Reload to fetch new workspace data
  };

  return (
    <div className="workspace-selector">
      <label>Workspace:</label>
      <select value={currentWorkspace} onChange={(e) => handleChange(e.target.value)}>
        {workspaces.map(ws => (
          <option key={ws} value={ws}>{ws}</option>
        ))}
      </select>
    </div>
  );
}
```

#### Step 4.2: Update API Client to Include Workspace
**File:** `lib/api-client.ts` (NEW or UPDATE)
```typescript
export function getWorkspace(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('workspace') || 'default';
  }
  return 'default';
}

export async function apiGet(path: string) {
  const workspace = getWorkspace();
  const response = await fetch(path, {
    headers: {
      'X-Workspace': workspace,
    },
  });
  return response.json();
}

export async function apiPost(path: string, body: any) {
  const workspace = getWorkspace();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace': workspace,
    },
    body: JSON.stringify(body),
  });
  return response.json();
}
```

#### Step 4.3: Add Workspace Selector to Layout
**File:** `app/layout.tsx`
```typescript
import { WorkspaceSelector } from '@/components/workspace-selector';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <nav>
          <WorkspaceSelector />
          {/* existing nav items */}
        </nav>
        {children}
      </body>
    </html>
  );
}
```

#### Step 4.4: Update All Data Fetching
**Files to Update:**
- `app/concepts/page.tsx`
- `app/segments/page.tsx`
- `app/videos/page.tsx`
- `app/graph/page.tsx`
- `app/chat/page.tsx`

**Replace `fetch()` calls with `apiGet()`/`apiPost()` from api-client**

---

### Phase 5: Workspace Management API

#### Step 5.1: Workspace CRUD Endpoints
**File:** `app/api/workspaces/route.ts` (NEW)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { listWorkspaces, createWorkspace, deleteWorkspace } from '@/lib/neo4j/client';

export async function GET() {
  try {
    const workspaces = await listWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list workspaces' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspace } = await request.json();
    await createWorkspace(workspace);
    return NextResponse.json({ success: true, workspace });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
```

**File:** `app/api/workspaces/[id]/route.ts` (NEW)
```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteWorkspace(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
```

#### Step 5.2: Workspace Management UI
**File:** `app/workspaces/page.tsx` (NEW)
```typescript
'use client';

import { useState, useEffect } from 'react';

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [newWorkspace, setNewWorkspace] = useState('');

  // UI for creating/deleting workspaces
  // ...
}
```

---

## Migration Strategy

### Step 1: Migrate Existing Data
**Script:** `scripts/migrate-to-workspaces.ts` (NEW)
```typescript
// Move all existing data to 'default' workspace
import { getSession, createWorkspace } from '../lib/neo4j/client';

async function migrate() {
  // Create default workspace
  await createWorkspace('default');

  console.log('Migration complete: All existing data in "default" workspace');
}

migrate();
```

### Step 2: Gradual Rollout
1. Implement backend changes (Phase 1-3)
2. Keep existing routes working with 'default' workspace
3. Add workspace parameter support (backward compatible)
4. Add UI (Phase 4)
5. Document workspace creation process
6. Create new workspaces for different domains

---

## Testing Strategy

### Unit Tests
- Workspace validation logic
- Session creation with workspace parameter
- Workspace CRUD operations

### Integration Tests
- Data isolation verification
- Query filtering by workspace
- Vector search within workspace
- No cross-workspace data leakage

### Test Cases
```typescript
describe('Workspace Isolation', () => {
  it('should not find concepts from other workspaces', async () => {
    await createConcept({ ... }, 'health');
    const concepts = await getAllConcepts('shopify');
    expect(concepts).toHaveLength(0);
  });

  it('should isolate vector search results', async () => {
    // Add segment to 'health'
    // Search from 'shopify'
    // Should return no results
  });
});
```

---

## Files to Create/Modify

### New Files (8)
1. `middleware/workspace.ts` - Workspace extraction logic
2. `lib/api-client.ts` - Client-side API wrapper with workspace
3. `components/workspace-selector.tsx` - Workspace dropdown UI
4. `app/api/workspaces/route.ts` - List/create workspaces
5. `app/api/workspaces/[id]/route.ts` - Delete workspace
6. `app/workspaces/page.tsx` - Workspace management UI
7. `scripts/migrate-to-workspaces.ts` - Migration script
8. `scripts/create-workspace.ts` - CLI workspace creation

### Modified Files (15+)
1. `lib/neo4j/client.ts` - Multi-database session management
2. `lib/neo4j/queries.ts` - Add workspace param to all functions
3. `lib/utils/ingest.ts` - Pass workspace through pipeline
4. `lib/ai/embeddings.ts` - Workspace-scoped vector search
5. `scripts/create-vector-index.ts` - Per-workspace indices
6. `docker-compose.yml` - Neo4j Enterprise or multi-container setup
7. All API routes in `app/api/` (12 files) - Extract workspace
8. `app/layout.tsx` - Add workspace selector
9. All data-fetching pages (5+ files) - Use api-client

---

## Environment Variables

**File:** `.env.local`
```bash
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123

# Default workspace
DEFAULT_WORKSPACE=default

# For Enterprise Edition
NEO4J_EDITION=enterprise
NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
```

---

## Rollout Checklist

- [ ] Phase 1.1: Set up Neo4j Enterprise or multi-container
- [ ] Phase 1.2: Update client.ts with workspace session management
- [ ] Phase 2.1: Create workspace middleware
- [ ] Phase 2.2: Update all query functions with workspace param
- [ ] Phase 2.3: Update all API routes to extract workspace
- [ ] Phase 3.1: Create per-workspace vector indices
- [ ] Phase 3.2: Update vector search to use workspace indices
- [ ] Phase 4.1: Create workspace selector component
- [ ] Phase 4.2: Create API client wrapper
- [ ] Phase 4.3: Add workspace selector to layout
- [ ] Phase 4.4: Update all frontend data fetching
- [ ] Phase 5.1: Create workspace management API
- [ ] Phase 5.2: Create workspace management UI
- [ ] Test data isolation thoroughly
- [ ] Migrate existing data to 'default' workspace
- [ ] Document workspace creation/usage
- [ ] Create initial workspaces (health, shopify, etc.)

---

## Estimated Effort

- **Phase 1 (Infrastructure):** 2-3 hours
- **Phase 2 (API Layer):** 4-5 hours
- **Phase 3 (Vector Search):** 2-3 hours
- **Phase 4 (UI):** 3-4 hours
- **Phase 5 (Management):** 2-3 hours
- **Testing & Migration:** 2-3 hours

**Total:** 15-21 hours

---

## Future Enhancements

- Workspace templates (pre-configured workspaces)
- Workspace sharing/permissions
- Cross-workspace concept linking (if complete isolation is relaxed)
- Workspace analytics/statistics
- Bulk data import/export per workspace
- Workspace cloning
