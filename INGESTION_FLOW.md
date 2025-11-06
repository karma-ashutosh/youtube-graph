# Ingestion Flow

## 1. Upload Batch

**Endpoint:** `POST /api/segments/batch`

**Input:**
```json
[
  {
    "video_url": "https://youtube.com/watch?v=abc123",
    "start_time": "00:03:54",
    "end_time": "00:04:42",
    "topic_hint": "Product-Market Fit",
    "transcript": "Full transcript text...",
    "analysis_json": {
      "primary_concept": {
        "name": "Product-Market Fit",
        "coverage_depth": "comprehensive",
        "explanation_type": "definition"
      },
      "supporting_concepts": [...],
      "mentioned_concepts": [...],
      "examples": [...],
      "key_ideas": [...]
    }
  }
]
```

**Flow:**
1. Validate with `SegmentBatchSchema`
2. Generate `batchId` (UUID)
3. Insert all segments into `batch_segments` table (status: `pending`)
4. Return `batchId` immediately
5. Start async processing in background

**Returns:**
```json
{
  "success": true,
  "batchId": "8a9c8733-02ff-4037-9d01-a74be8cad377",
  "totalSegments": 50,
  "message": "Batch created and processing started"
}
```

---

## 2. Async Processing

**Function:** `processSegmentsBatch(batchId)`

**Loop:**
```typescript
for each segment in batch_segments WHERE status='pending' {
  1. UPDATE status = 'processing'
  2. result = await ingestSegment(segment_data)
  3. if (!result.success) throw Error
  4. UPDATE status = 'completed'
  5. catch -> UPDATE status = 'failed', error = message
}
```

---

## 3. Segment Ingestion

**Function:** `ingestSegment(segment)` → `lib/utils/ingest.ts`

### 3.1 Parse & Extract
```typescript
const { segmentId, videoId, analysis, duration, topicHint, transcript } = processSegmentData(segment);
// segmentId = "abc123_000354_000442"
// videoId = "abc123"
```

### 3.2 Create Video Node
```cypher
MERGE (v:Video {video_id: "abc123"})
SET v.url = "https://youtube.com/watch?v=abc123"
```

### 3.3 Create Segment Node + Embedding
```typescript
const embedding = await generateEmbedding(`${topicHint}. ${transcript.slice(0,500)}`);
// embedding = [0.123, -0.456, ...] (1536 dimensions)
```

```cypher
CREATE (s:Segment {
  segment_id: "abc123_000354_000442",
  video_id: "abc123",
  start_time: 234,
  end_time: 282,
  duration_seconds: 48,
  topic_hint: "Product-Market Fit",
  transcript: "...",
  embedding: [...]
})
-[:PART_OF]-> (v:Video)
```

### 3.4 Normalize & Process Primary Concept
```typescript
const existingConcepts = await getAllConcepts(); // From Neo4j

const normalized = await normalizeConcept("Product-Market Fit", existingConcepts);
// Step 1: Fuzzy string matching (FREE, instant)
//   - Exact match on concept_id, canonical_name, aliases
//   - Levenshtein similarity > 85% threshold
//   - "Product Market Fit" → matches "Product-Market Fit" (0.92 similarity)
//
// Step 2a: If USE_LLM_NORMALIZATION=false (RECOMMENDED)
//   - Create new concept directly (no LLM call)
//   - Fast, zero cost, zero quota issues
//   - Tradeoff: May create semantic duplicates (e.g., "PMF" vs "Product-Market Fit")
//
// Step 2b: If USE_LLM_NORMALIZATION=true
//   - LLM call for semantic matching (EXPENSIVE, quota-limited)
//   - "PMF" → matches "Product-Market Fit"
//   - Fallback: Create new concept if LLM fails

// normalized = {
//   canonical_name: "Product-Market Fit",
//   concept_id: "product_market_fit",
//   is_new: false,
//   matched_existing_id: "product_market_fit",
//   confidence: "high"
// }
```

**Configuration:**
```bash
# .env.local
USE_LLM_NORMALIZATION=false  # Skip LLM (recommended for MVP)
USE_LLM_NORMALIZATION=true   # Use LLM for semantic matching
```

**LLM Call Reduction:**
- **USE_LLM_NORMALIZATION=false**: 0 LLM calls (100% reduction)
- **USE_LLM_NORMALIZATION=true**: ~1-3 LLM calls per segment (70-90% reduction vs no fuzzy matching)

**If new concept:**
```cypher
CREATE (c:Concept {
  concept_id: "product_market_fit",
  canonical_name: "Product-Market Fit",
  aliases: ["PMF", "product market fit"],
  embedding: [...]
})
```

**If existing:**
```cypher
MATCH (c:Concept {concept_id: "product_market_fit"})
SET c.aliases = c.aliases + ["new alias"] // if not exists
```

**Link to segment:**
```cypher
MATCH (s:Segment {segment_id: "abc123_000354_000442"})
MATCH (c:Concept {concept_id: "product_market_fit"})
CREATE (s)-[:DISCUSSES {
  role: "primary",
  coverage_depth: "comprehensive",
  explanation_type: "definition"
}]->(c)
```

### 3.5 Process Supporting Concepts
Same normalization flow as primary, but:
```cypher
CREATE (s)-[:DISCUSSES {role: "supporting", coverage_depth: "brief"}]->(c)
```

### 3.6 Process Mentioned Concepts
```cypher
CREATE (s)-[:DISCUSSES {role: "mentioned"}]->(c)
```

### 3.7 Create Examples
```typescript
for (const example of analysis.examples) {
  const concept = await normalizeConcept(example.concept_illustrated);

  await createExample({
    exampleId: generateId(),
    exampleText: "Airbnb achieved PMF when...",
    exampleType: "real_company",
    conceptId: concept.concept_id,
    segmentId,
    companyName: "Airbnb" // extracted for real_company type
  });
}
```

```cypher
CREATE (e:Example {
  example_id: "ex_abc123",
  example_text: "Airbnb achieved PMF when...",
  example_type: "real_company",
  company_name: "Airbnb"
})
-[:ILLUSTRATES]->(c:Concept)
-[:FROM_SEGMENT]->(s:Segment)
```

### 3.8 Create Key Ideas
```cypher
CREATE (i:KeyIdea {
  idea_id: "idea_xyz789",
  idea_text: "PMF is when customers pull product from you",
  idea_type: "principle",
  is_novel: true,
  confidence: "high"
})
-[:EXPLAINS]->(c:Concept)
-[:FROM_SEGMENT]->(s:Segment)
```

---

## 4. Error Handling

**Normalization fails (e.g., Gemini quota exceeded):**
```typescript
try {
  const normalized = await normalizeConcept(name, existingConcepts);
} catch (error) {
  // ingestSegment returns { success: false, error: "..." }
  // Batch processor catches this and marks segment as 'failed'
}
```

**Embedding generation fails:**
```typescript
try {
  embedding = await generateEmbedding(text);
} catch (error) {
  console.error("Failed to generate embedding");
  // Continue without embedding (can backfill later)
  embedding = undefined;
}
```

---

## 5. Status Polling

**Endpoint:** `GET /api/segments/batch/:batchId`

**Returns:**
```json
{
  "batchId": "8a9c8733-...",
  "total": 50,
  "completed": 45,
  "failed": 3,
  "pending": 2,
  "processing": 0,
  "progress": 90,
  "isDone": false,
  "errors": [
    {"segment_index": 12, "error": "Gemini quota exceeded"},
    {"segment_index": 23, "error": "Invalid analysis JSON"}
  ]
}
```

**UI polls every 2 seconds** until `isDone: true`

---

## 6. Manual Operations

### View All Segments
**Endpoint:** `GET /api/segments/batch/:batchId/segments`

Returns array of segments with `status`, `error`, `segment_data`

### Process Single Segment
**Endpoint:** `POST /api/segments/batch/:batchId/segments/:segmentId`

Triggers `ingestSegment()` for one specific segment

### Retry Failed Segments
**Endpoint:** `POST /api/segments/batch/:batchId/retry`

Resets all `failed` → `pending`, then reprocesses

---

## Database Schema

### PostgreSQL (Checkpoint)
```sql
CREATE TABLE batch_segments (
    id BIGSERIAL PRIMARY KEY,
    batch_id UUID NOT NULL,
    segment_index INTEGER NOT NULL,
    segment_data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);
```

### Neo4j (Knowledge Graph)
```
(Video)
  ← [:PART_OF]
(Segment)
  → [:DISCUSSES {role, coverage_depth}]
(Concept {embedding})
  ← [:ILLUSTRATES]
(Example {company_name})

(Concept)
  ← [:EXPLAINS]
(KeyIdea {is_novel, confidence})
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/api/segments/batch/route.ts` | Batch creation + async processing |
| `lib/utils/ingest.ts` | Core ingestion logic |
| `lib/ai/normalize.ts` | LLM concept normalization |
| `lib/ai/embeddings.ts` | Gemini embedding generation |
| `lib/neo4j/queries.ts` | All Neo4j CRUD operations |
| `lib/utils/validators.ts` | Zod schemas |
| `migrations/001_batch_checkpoints.sql` | Postgres table |
