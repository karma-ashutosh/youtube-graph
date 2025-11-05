# YouTube Knowledge Graph - Codebase Structure

Last Updated: 2025-11-06

## Project Overview

A Next.js application that builds a knowledge graph from YouTube video transcripts, enabling semantic search and RAG-powered Q&A using Neo4j and AI embeddings.

**Tech Stack:**
- Next.js 15 (App Router)
- TypeScript
- Neo4j (Graph Database)
- Google Gemini / Anthropic Claude (AI)
- Tailwind CSS

---

## Directory Structure

```
youtube-graph/
├── app/                    # Next.js 15 App Router
│   ├── api/               # API Routes
│   │   ├── backfill/      # Embedding backfill endpoint
│   │   ├── chat/          # RAG-powered Q&A
│   │   ├── concepts/      # Concept CRUD
│   │   ├── graph/         # Graph data
│   │   ├── segments/      # Segment CRUD + ingestion
│   │   └── videos/        # Video CRUD
│   ├── chat/             # Chat UI page
│   ├── concepts/         # Concept list + detail pages
│   ├── graph/            # Graph visualization page
│   ├── query/            # Raw Cypher query interface
│   ├── segments/         # Segment list + detail pages
│   ├── upload/           # Video upload page
│   ├── videos/           # Video list + detail pages
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/
│   ├── Navigation.tsx    # Main navigation component
│   └── analytics/
│       └── Clarity.tsx   # Microsoft Clarity analytics
├── lib/
│   ├── ai/               # AI/ML functionality
│   │   ├── chat.ts       # RAG chat logic
│   │   ├── embeddings.ts # Embedding generation (Gemini)
│   │   └── normalize.ts  # Concept normalization
│   ├── neo4j/            # Neo4j database
│   │   ├── client.ts     # Database connection
│   │   ├── queries.ts    # Cypher queries
│   │   └── vector.ts     # Vector search utilities
│   ├── types/
│   │   └── index.ts      # TypeScript type definitions
│   └── utils/
│       ├── ingest.ts     # Segment ingestion logic
│       ├── parsers.ts    # Data parsers
│       └── validators.ts # Zod validation schemas
├── scripts/
│   ├── backfill-embeddings.ts  # CLI: Generate missing embeddings
│   └── migrate-db.ts           # CLI: Database migrations
└── public/               # Static assets
```

---

## Core Concepts & Data Model

### Neo4j Graph Schema

**Nodes:**
1. **Video**
   - Properties: `video_id`, `title`, `url`, `channel_name`, `created_at`

2. **Segment** (Video timestamps with transcripts)
   - Properties: `segment_id`, `topic_hint`, `start_time`, `end_time`, `transcript`, `embedding`, `created_at`

3. **Concept** (Extracted knowledge entities)
   - Properties: `concept_id`, `canonical_name`, `aliases[]`, `category`, `total_mentions`, `embedding`, `created_at`

**Relationships:**
- `(Video)-[:HAS_SEGMENT]->(Segment)`
- `(Segment)-[:MENTIONS {context}]->(Concept)`

**Indexes:**
- Vector index on `Concept.embedding` (768-dim, cosine similarity)
- Vector index on `Segment.embedding` (768-dim, cosine similarity)

---

## Key Features & File Mapping

### 1. Video Ingestion & Segmentation
**Files:**
- `app/upload/page.tsx` - Upload UI
- `app/api/segments/ingest/route.ts` - Ingestion endpoint
- `lib/utils/ingest.ts` - Core ingestion logic
- `lib/ai/normalize.ts` - AI-powered concept extraction

**Flow:**
1. User uploads JSON with video segments
2. System creates Video → Segments → Concepts
3. AI normalizes concepts (deduplication)
4. Relationships created in Neo4j

### 2. RAG-Powered Chat
**Files:**
- `app/chat/page.tsx` - Chat UI
- `app/api/chat/route.ts` - Chat API endpoint
- `lib/ai/chat.ts` - RAG implementation
- `lib/ai/embeddings.ts` - Embedding generation
- `lib/neo4j/vector.ts` - Vector search

**Flow:**
1. User asks question
2. Question → embedding (Gemini)
3. Vector search finds relevant concepts + segments
4. Context + question → LLM (Claude/Gemini)
5. Answer returned with sources

### 3. Embedding Backfill
**Files:**
- `app/api/backfill/route.ts` - API endpoint
- `app/chat/page.tsx` - UI button integration
- `scripts/backfill-embeddings.ts` - CLI version

**Purpose:**
- Generate embeddings for concepts/segments without them
- Batch processing with rate limiting
- UI-based or CLI execution

### 4. Graph Visualization
**Files:**
- `app/graph/page.tsx` - Graph UI
- `app/api/graph/route.ts` - Graph data endpoint
- Uses `react-force-graph-2d` library

**Features:**
- Interactive force-directed graph
- Shows Video → Segment → Concept relationships
- Click nodes to view details

### 5. CRUD Operations
**Concepts:**
- List: `app/concepts/page.tsx`
- Detail: `app/concepts/[id]/page.tsx`
- API: `app/api/concepts/route.ts`, `app/api/concepts/[id]/route.ts`

**Segments:**
- List: `app/segments/page.tsx`
- Detail: `app/segments/[id]/page.tsx`
- API: `app/api/segments/route.ts`, `app/api/segments/[id]/route.ts`

**Videos:**
- List: `app/videos/page.tsx`
- Detail: `app/videos/[id]/page.tsx`
- API: `app/api/videos/route.ts`, `app/api/videos/[id]/route.ts`

---

## Environment Variables

**Required:**
```bash
# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password

# Client-side Neo4j (for graph visualization)
NEXT_PUBLIC_NEO4J_URI=bolt://localhost:7687
NEXT_PUBLIC_NEO4J_USER=neo4j
NEXT_PUBLIC_NEO4J_PASSWORD=your_password

# AI Provider
AI_PROVIDER=gemini  # or "claude"
GOOGLE_API_KEY=your_key  # if using Gemini
ANTHROPIC_API_KEY=your_key  # if using Claude

# Analytics (optional)
NEXT_PUBLIC_CLARITY_PROJECT_ID=your_clarity_id
```

**Files:**
- `.env` - Committed defaults (no secrets)
- `.env.local` - Local overrides (gitignored)
- `.env.example` - Template

---

## AI Configuration

### Embedding Model
- **Provider:** Google Gemini
- **Model:** `text-embedding-004`
- **Dimensions:** 768
- **File:** `lib/ai/embeddings.ts`

### Chat Models
Configured via `AI_PROVIDER` env var:
- **Gemini:** `gemini-2.0-flash-exp` (default)
- **Claude:** `claude-3-5-sonnet-20241022`
- **File:** `lib/ai/chat.ts`

### Concept Normalization
- **Model:** Gemini Flash (lightweight)
- **Purpose:** Deduplicate and canonicalize concepts
- **File:** `lib/ai/normalize.ts`

---

## Database Schema & Migrations

**Vector Indexes:**
```cypher
CREATE VECTOR INDEX concept_embeddings IF NOT EXISTS
FOR (c:Concept) ON c.embedding
OPTIONS {indexConfig: {
  `vector.dimensions`: 768,
  `vector.similarity_function`: 'cosine'
}}

CREATE VECTOR INDEX segment_embeddings IF NOT EXISTS
FOR (s:Segment) ON s.embedding
OPTIONS {indexConfig: {
  `vector.dimensions`: 768,
  `vector.similarity_function`: 'cosine'
}}
```

**Migration Script:**
- `scripts/migrate-db.ts` - Ensures indexes exist

---

## Common Workflows

### Adding a New Feature
1. Create API route in `app/api/[feature]/route.ts`
2. Add page in `app/[feature]/page.tsx`
3. Update navigation in `components/Navigation.tsx`
4. Add types to `lib/types/index.ts`

### Working with Neo4j
1. Queries go in `lib/neo4j/queries.ts`
2. Use `getSession()` from `lib/neo4j/client.ts`
3. Always close sessions in `finally` blocks

### AI Integration
1. Embeddings: Use `generateEmbedding()` from `lib/ai/embeddings.ts`
2. Chat: Extend `answerQuestion()` in `lib/ai/chat.ts`
3. Normalization: Use `normalizeConceptName()` from `lib/ai/normalize.ts`

---

## Important Design Patterns

### API Routes
- Use `NextRequest` and `NextResponse`
- Validate inputs with Zod schemas
- Return consistent JSON: `{ success, data?, error? }`
- Handle errors gracefully

### Neo4j Sessions
```typescript
const session = getSession();
try {
  // queries
} finally {
  await session.close();
}
```

### Embedding Generation
- Check cache first (in-memory Map)
- Rate limit API calls (100ms delay)
- Handle failures gracefully
- Use batching for multiple items

---

## Scripts & Utilities

### Development
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
```

### Database
```bash
npm run db:migrate              # Create indexes
npx tsx scripts/backfill-embeddings.ts  # Generate embeddings
./reset_neo4j.sh               # Reset database (danger!)
```

### Docker
```bash
docker-compose up -d  # Start Neo4j
docker-compose down   # Stop Neo4j
```

---

## Data Files (Root Directory)

These are sample/test data files (not part of core codebase):
- `content_segments.json` - Example segment data
- `filtered_segments_with_transcript.json` - Processed segments
- `test_content_*.json` - Test data
- `*_prompt.txt` - AI prompt templates (experimental)

---

## Documentation Files

- `README.md` - Project overview
- `SETUP.md` - Setup instructions
- `AI_CONFIGURATION.md` - AI provider details
- `DEBUG_FLOW.md` - Debugging guide
- `SEGMENTATION_STRATEGY.md` - Content segmentation approach
- `PROMPT_*.md` - Prompt engineering docs

---

## Known Limitations & TODOs

1. **Embeddings:** Currently manual backfill needed for existing data
2. **Auth:** No authentication system yet
3. **Rate Limiting:** Basic delays, no formal rate limiter
4. **Error Handling:** Could be more comprehensive
5. **Testing:** No automated tests yet
6. **Caching:** Only in-memory, resets on restart

---

## Quick Reference

### Get All Concepts
```typescript
import { getSession } from '@/lib/neo4j/client';

const session = getSession();
const result = await session.run(`
  MATCH (c:Concept)
  RETURN c
  ORDER BY c.total_mentions DESC
`);
```

### Generate Embedding
```typescript
import { generateEmbedding } from '@/lib/ai/embeddings';

const embedding = await generateEmbedding("product-market fit");
// Returns: number[] (768 dimensions)
```

### Vector Search
```typescript
import { searchConceptsByEmbedding } from '@/lib/neo4j/vector';

const results = await searchConceptsByEmbedding(queryEmbedding, 5);
// Returns top 5 similar concepts
```

---

## Contact & Contributions

This is a personal project. For questions or contributions, refer to the main README.md.
