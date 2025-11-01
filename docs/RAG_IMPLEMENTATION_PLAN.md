# RAG-Enhanced Concept Normalization Implementation Plan

## Problem Statement

Currently, concepts aren't being deduplicated across videos because:
1. `GOOGLE_API_KEY` is missing/empty in `.env.local`
2. Normalization falls back to creating unique concepts for every mention
3. Result: 13 videos from same channel have zero concept connectivity

## Solution: Hybrid RAG + LLM Approach

### Architecture Overview

**Use Neo4j vector indexes for semantic similarity search + LLM for final verification**

```
Ingestion Flow:
1. New concept arrives: "PMF"
2. Generate embedding using Gemini/OpenAI embeddings API
3. Vector similarity search in Neo4j (top 5 matches)
4. Pass 5 candidates to LLM for final decision
5. Create/merge concept in graph
```

### Current System (LLM-only)
```
New Concept: "Product Market Fit"
  ↓
Send ALL existing concepts to LLM (top 50)
  ↓
LLM decides: matches "Product-Market Fit" (concept_id: pmf)
```

**Problems:**
- Expensive (API call for every concept)
- Slow (network latency)
- Limited context (only top 50 concepts)
- Depends on external API availability

### RAG-Enhanced System
```
New Concept: "Product Market Fit"
  ↓
Generate embedding vector [0.234, -0.891, ...]
  ↓
Vector similarity search in DB
  ↓
Retrieve top 5 most similar concepts
  ↓
LLM final decision with only 5 candidates (instead of 50)
```

**Benefits:**
- **Faster**: Pre-filter with vector search
- **Cheaper**: Only send relevant concepts to LLM
- **Scalable**: Works with thousands of concepts
- **Smarter**: Finds semantic matches beyond text similarity
- **Single Database**: Uses Neo4j vector capabilities (no additional infrastructure)

## Implementation Plan

### Phase 1: Add Embedding Infrastructure (4-6 hours)

#### 1.1 Install Dependencies
```bash
npm install @google/generative-ai
# OR
npm install openai
```

#### 1.2 Create Embedding Service (`lib/ai/embeddings.ts`)
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = googleAI.getGenerativeModel({
    model: "text-embedding-004"
  });
  const result = await model.embedContent(text);
  return result.embedding.values; // 768 dimensions
}

// Cache to avoid redundant API calls
const embeddingCache = new Map<string, number[]>();

export async function getEmbedding(text: string): Promise<number[]> {
  const key = text.toLowerCase().trim();
  if (embeddingCache.has(key)) {
    return embeddingCache.get(key)!;
  }
  const embedding = await generateEmbedding(text);
  embeddingCache.set(key, embedding);
  return embedding;
}
```

#### 1.3 Update Concept Schema
Add to `lib/neo4j/client.ts`:
```typescript
// Create vector index for concept embeddings
await session.run(`
  CREATE VECTOR INDEX concept_embeddings IF NOT EXISTS
  FOR (c:Concept)
  ON c.embedding
  OPTIONS {indexConfig: {
    \`vector.dimensions\`: 768,
    \`vector.similarity_function\`: 'cosine'
  }}
`);
```

#### 1.4 Backfill Script (`scripts/backfill-embeddings.ts`)
```typescript
import { getSession } from "@/lib/neo4j/client";
import { getEmbedding } from "@/lib/ai/embeddings";

async function backfillEmbeddings() {
  const session = getSession();

  try {
    // Get all concepts without embeddings
    const result = await session.run(`
      MATCH (c:Concept)
      WHERE c.embedding IS NULL
      RETURN c.concept_id, c.canonical_name
    `);

    for (const record of result.records) {
      const conceptId = record.get("concept_id");
      const name = record.get("canonical_name");

      console.log(`Generating embedding for: ${name}`);
      const embedding = await getEmbedding(name);

      await session.run(`
        MATCH (c:Concept {concept_id: $conceptId})
        SET c.embedding = $embedding
      `, { conceptId, embedding });
    }

    console.log(`Backfilled ${result.records.length} concepts`);
  } finally {
    await session.close();
  }
}

backfillEmbeddings();
```

### Phase 2: RAG-Enhanced Normalization (3-4 hours)

#### 2.1 Add Vector Search to Queries (`lib/neo4j/queries.ts`)
```typescript
export async function findSimilarConcepts(
  embedding: number[],
  limit: number = 5
): Promise<Concept[]> {
  const session = getSession();

  try {
    const result = await session.run(`
      CALL db.index.vector.queryNodes(
        'concept_embeddings',
        $limit,
        $embedding
      ) YIELD node, score
      WHERE score > 0.7  // Similarity threshold
      RETURN node {
        .concept_id,
        .canonical_name,
        .aliases,
        .category,
        .total_mentions,
        similarity: score
      } as concept
      ORDER BY score DESC
    `, { limit, embedding });

    return result.records.map(r => r.get("concept"));
  } finally {
    await session.close();
  }
}
```

#### 2.2 Update Normalization Logic (`lib/ai/normalize.ts`)
```typescript
export async function normalizeConcept(
  rawName: string,
  existingConcepts: Concept[] = [] // No longer used directly
): Promise<NormalizedConcept> {
  try {
    // 1. Generate embedding for new concept
    const embedding = await getEmbedding(rawName);

    // 2. Vector search for similar concepts
    const candidates = await findSimilarConcepts(embedding, 5);

    // 3. If very high similarity, auto-match
    if (candidates.length > 0 && candidates[0].similarity > 0.95) {
      return {
        canonical_name: candidates[0].canonical_name,
        concept_id: candidates[0].concept_id,
        is_new: false,
        matched_existing_id: candidates[0].concept_id,
        confidence: "high",
      };
    }

    // 4. LLM decision with only relevant candidates
    if (AI_PROVIDER === "gemini") {
      return await normalizeWithGemini(rawName, candidates);
    } else if (AI_PROVIDER === "claude") {
      return await normalizeWithClaude(rawName, candidates);
    }
  } catch (error) {
    console.error("Error normalizing concept with RAG:", error);

    // Fallback: create new concept
    return {
      canonical_name: rawName,
      concept_id: nameToSlug(rawName),
      is_new: true,
      confidence: "low",
    };
  }
}
```

#### 2.3 Update Concept Creation (`lib/neo4j/queries.ts`)
```typescript
export async function createConcept(
  conceptData: {
    concept_id: string;
    canonical_name: string;
    aliases: string[];
    category: string;
    embedding: number[]; // NEW
  }
): Promise<void> {
  const session = getSession();

  try {
    await session.run(`
      CREATE (c:Concept {
        concept_id: $concept_id,
        canonical_name: $canonical_name,
        aliases: $aliases,
        category: $category,
        embedding: $embedding,
        first_mentioned: datetime(),
        last_mentioned: datetime(),
        total_mentions: 1,
        importance_score: 0.5
      })
    `, conceptData);
  } finally {
    await session.close();
  }
}
```

### Phase 3: Optimization (2-3 hours)

#### 3.1 Caching Layer
- Cache concept embeddings in memory
- Redis cache for frequently normalized concepts

#### 3.2 Monitoring
```typescript
// Log normalization decisions
console.log(`Normalized "${rawName}" → "${result.canonical_name}"`, {
  matched: !result.is_new,
  confidence: result.confidence,
  candidates: candidates.length,
  topSimilarity: candidates[0]?.similarity
});
```

#### 3.3 Admin Dashboard
- Endpoint to review normalization decisions
- Ability to manually merge concepts
- View embedding similarity scores

## Technical Specifications

### Neo4j Vector Index Setup
```cypher
CREATE VECTOR INDEX concept_embeddings IF NOT EXISTS
FOR (c:Concept)
ON c.embedding
OPTIONS {indexConfig: {
  `vector.dimensions`: 768,  // Gemini text-embedding-004
  `vector.similarity_function`: 'cosine'
}}
```

### Embedding APIs

**Gemini (Recommended):**
- Model: `text-embedding-004`
- Dimensions: 768
- Cost: Free tier available
- Rate limits: 1500 requests/min

**OpenAI:**
- Model: `text-embedding-3-small`
- Dimensions: 1536
- Cost: $0.00002 per 1K tokens

### Similarity Thresholds
- `> 0.95`: Auto-match (very high confidence)
- `0.70 - 0.95`: Send to LLM for verification
- `< 0.70`: Likely new concept

## Migration Strategy

### Step 1: Enable API Key
```bash
# .env.local
GOOGLE_API_KEY=your_actual_api_key_here
```

### Step 2: Add Vector Index
```bash
npm run db:migrate  # Add this script
```

### Step 3: Backfill Embeddings
```bash
npm run backfill:embeddings
```

### Step 4: Test with New Ingestions
- Upload a test segment
- Verify normalization logs
- Check concept deduplication

### Step 5: Monitor and Refine
- Adjust similarity thresholds
- Review false positives/negatives
- Fine-tune LLM prompts

## Files to Create/Modify

### New Files
- `lib/ai/embeddings.ts` - Embedding generation service
- `scripts/backfill-embeddings.ts` - Backfill existing concepts
- `scripts/db-migrate.ts` - Database migrations
- `app/api/admin/normalize/route.ts` - Manual normalization endpoint

### Modified Files
- `lib/ai/normalize.ts` - Update normalization logic
- `lib/neo4j/queries.ts` - Add vector search queries
- `lib/neo4j/client.ts` - Create vector index on startup
- `lib/utils/ingest.ts` - Pass embeddings during ingestion
- `package.json` - Add new dependencies

## Estimated Effort

| Phase | Task | Time |
|-------|------|------|
| Phase 1 | Embedding infrastructure | 4-6 hours |
| Phase 2 | RAG integration | 3-4 hours |
| Phase 3 | Optimization | 2-3 hours |
| Testing | Testing + refinement | 2-3 hours |
| **Total** | | **12-16 hours** |

## Benefits Summary

1. **Cost Reduction**: 90% fewer LLM calls (5 candidates vs 50)
2. **Speed Improvement**: Vector search is ~10x faster than LLM calls
3. **Better Accuracy**: Semantic similarity finds matches text search misses
4. **Scalability**: Works with 10k+ concepts (current: limited to top 50)
5. **Offline Capability**: Can use top vector match if LLM API is down
6. **Single Database**: No additional infrastructure needed

## Prerequisites

- Neo4j 5.11+ (Community or Enterprise)
- Google API key for embeddings (or OpenAI key)
- Node.js 18+

## Next Steps

1. ✅ Configure `GOOGLE_API_KEY` in `.env.local`
2. ⬜ Implement embedding service
3. ⬜ Create Neo4j vector index
4. ⬜ Update normalization function
5. ⬜ Backfill existing concepts
6. ⬜ Test with new ingestions
7. ⬜ Monitor and refine

## References

- [Neo4j Vector Indexes](https://neo4j.com/docs/cypher-manual/current/indexes-for-vector-search/)
- [Gemini Embeddings API](https://ai.google.dev/gemini-api/docs/embeddings)
- [RAG Architecture Patterns](https://www.pinecone.io/learn/retrieval-augmented-generation/)
