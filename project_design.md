# Prompt for Claude Code: Build Video Transcript Knowledge Graph System

## Project Overview
Build a Next.js application that processes video transcript segments and creates a queryable Neo4j knowledge graph. The system should normalize concepts to avoid duplicates, track relationships, and provide a visual interface to explore the knowledge graph.

---

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database**: Neo4j (use Neo4j Aura free tier or Docker container)
- **API**: Next.js API routes
- **Data Validation**: Zod
- **Neo4j Client**: neo4j-driver
- **UI Components**: shadcn/ui (optional but nice)
- **LLM Integration**: OpenAI SDK (for concept normalization) or Google Generative AI (Gemini)

---

## Core Requirements

### 1. Data Models

#### Input Data Format (from existing DB)
```typescript
interface SegmentData {
  id: string | null;
  video_url: string;
  start_time: string;  // "00:03:54"
  end_time: string;    // "00:04:42"
  topic_hint: string;
  analysis_json: string; // JSON string, needs parsing
  created_at: string | null;
  updated_at: string | null;
}

interface AnalysisData {
  primary_concept: {
    name: string;
    coverage_depth: "comprehensive" | "partial" | "reference_only";
    explanation_type: "definition" | "case_study" | "how_to" | "comparison" | "metaphor" | "story";
  };
  supporting_concepts: Array<{
    name: string;
    role: string;
    coverage_depth: "comprehensive" | "partial" | "reference_only";
  }>;
  mentioned_concepts: Array<{
    name: string;
    context: string;
    coverage_depth: "comprehensive" | "partial" | "reference_only";
  }>;
  key_ideas: Array<{
    idea: string;
    type: "fact" | "advice" | "insight" | "metric" | "opinion";
    is_novel: boolean;
    confidence: "high" | "medium" | "low";
  }>;
  examples: Array<{
    example_text: string;
    type: "real_company" | "personal_story" | "metaphor" | "hypothetical" | "data_point";
    concept_illustrated: string;
  }>;
}
```

#### Neo4j Node Types
```typescript
// Define these as Zod schemas and TypeScript interfaces

Video {
  video_id: string;
  url: string;
  title?: string;
  channel?: string;
  upload_date?: Date;
  created_at: Date;
}

Segment {
  segment_id: string;
  video_id: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  topic_hint: string;
  created_at: Date;
}

Concept {
  concept_id: string;        // slug: "product_market_fit"
  canonical_name: string;     // "Product-Market Fit"
  aliases: string[];          // ["PMF", "Product Market Fit"]
  category: string;           // "Product", "Marketing", etc.
  first_mentioned: Date;
  last_mentioned: Date;
  total_mentions: number;
  importance_score: number;   // 0-1
}

ConceptInstance {
  instance_id: string;
  concept_id: string;
  segment_id: string;
  explanation_type: string;
  coverage_depth: string;
  novelty_score: number;      // 0-1
  is_canonical: boolean;
  created_at: Date;
}

Example {
  example_id: string;
  example_text: string;
  example_type: string;
  company_name?: string;      // extracted if real_company
  segment_id: string;
}

KeyIdea {
  idea_id: string;
  idea_text: string;
  idea_type: string;
  is_novel: boolean;
  confidence: string;
  segment_id: string;
}

Category {
  category_id: string;
  name: string;
  color: string;              // hex color for visualization
}
```

#### Neo4j Relationship Types
```
(Segment)-[:FROM_VIDEO]->(Video)
(Segment)-[:DISCUSSES {role: "primary" | "supporting" | "mentioned"}]->(Concept)
(ConceptInstance)-[:INSTANCE_OF]->(Concept)
(ConceptInstance)-[:APPEARS_IN]->(Segment)
(Example)-[:ILLUSTRATES]->(Concept)
(Example)-[:MENTIONED_IN]->(Segment)
(KeyIdea)-[:ABOUT]->(Concept)
(KeyIdea)-[:EXTRACTED_FROM]->(Segment)
(Concept)-[:PREREQUISITE_OF]->(Concept)
(Concept)-[:RELATED_TO {strength: number}]->(Concept)
(Concept)-[:IN_CATEGORY]->(Category)
```

---

### 2. Key Features to Implement

#### Feature 1: Data Ingestion Pipeline
Create an API endpoint and processing logic:
- **POST /api/segments/ingest** - Accept array of SegmentData
- Parse analysis_json for each segment
- Extract video_id from video_url (YouTube ID)
- Process each segment through the pipeline (see below)

#### Feature 2: Concept Normalization
**CRITICAL**: Use LLM to normalize concept names to avoid duplicates

```typescript
// Pseudo-logic for normalization
async function normalizeConcept(
  rawName: string, 
  existingConcepts: Concept[]
): Promise<{
  canonical_name: string;
  concept_id: string;
  is_new: boolean;
  matched_existing_id?: string;
}> {
  // Use LLM with prompt:
  // "Given existing concepts: [list], is '{rawName}' 
  //  the same as any existing concept or is it new?
  //  If same, return existing canonical_name.
  //  If new, create clear canonical name (2-4 words)."
  
  // Return normalized concept info
}
```

**Prompt Template for LLM**:
```
You are normalizing concept names for a knowledge graph.

EXISTING CONCEPTS (top 50 for context):
- Product-Market Fit (aliases: PMF, Product Market Fit)
- Marketing Tactics (aliases: Marketing Tactics Selection)
- Fundraising Strategy (aliases: Raising Capital, Funding Strategy)
[... more concepts ...]

NEW CONCEPT TO NORMALIZE:
"{raw_concept_name}"

TASK:
1. Check if this matches any existing concept (including aliases)
2. If YES: Return the existing canonical_name and concept_id
3. If NO: Create a new canonical_name (2-4 words, clear, concise)

RULES:
- Be conservative: prefer matching to existing over creating new
- "PMF" = "Product-Market Fit" (match variations)
- "Marketing Tactic Selection" = "Marketing Tactics" (match similar phrasing)

OUTPUT (JSON only, no explanation):
{
  "canonical_name": "Product-Market Fit",
  "concept_id": "product_market_fit",
  "is_new": false,
  "matched_existing_id": "product_market_fit",
  "confidence": "high"
}
```

#### Feature 3: Processing Pipeline
For each segment:
1. Create/get Video node
2. Create Segment node
3. Normalize primary concept → Create/update Concept node
4. Create ConceptInstance
5. Link Segment → Concept (role: "primary")
6. Normalize & process supporting concepts → Link with role: "supporting"
7. Normalize & process mentioned concepts → Link with role: "mentioned"
8. Create Example nodes → Link to Concept and Segment
9. Create KeyIdea nodes → Link to Concept and Segment
10. Update concept statistics (total_mentions, last_mentioned)

#### Feature 4: Web Interface

**Page 1: Upload/Ingest** (`/upload`)
- Upload JSON file with array of SegmentData
- Or paste JSON directly
- Show processing progress
- Display results: X segments processed, Y concepts created/updated

**Page 2: Graph Visualization** (`/graph`)
- Interactive visualization of the knowledge graph
- Use a library like:
  - `react-force-graph` (3D/2D force-directed graph)
  - `vis-network` (network visualization)
  - Or embed Neo4j Bloom (if using Aura)
- Filters:
  - By category
  - By importance score
  - Show only concepts with >N mentions
- Click on node → Show details panel with:
  - All instances
  - Related concepts
  - Examples
  - Key ideas

**Page 3: Explore Concepts** (`/concepts`)
- Table/list of all concepts
- Sort by: importance, mentions, recency
- Search/filter
- Click concept → Detail page

**Page 4: Concept Detail** (`/concepts/[id]`)
- Concept metadata (mentions, importance, category)
- Timeline of all instances
- All examples using this concept
- All key ideas about this concept
- Related concepts graph
- Links back to video segments (with timestamps)

**Page 5: Query Interface** (`/query`)
- Natural language query: "Show me all content about fundraising"
- Execute Cypher queries (for advanced users)
- Display results as:
  - List of segments
  - Concept graph
  - Timeline view

---

### 3. Environment Setup

**.env.local**
```
# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password

# Or for Neo4j Aura
# NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
# NEO4J_USER=neo4j
# NEO4J_PASSWORD=xxxxx

# OpenAI (for concept normalization)
OPENAI_API_KEY=sk-xxxxx

# Or Gemini (cheaper/free)
GOOGLE_API_KEY=xxxxx
```

---

### 4. Project Structure

```
/app
  /upload
    page.tsx           # Upload interface
  /graph
    page.tsx           # Graph visualization
  /concepts
    page.tsx           # Concepts list
    /[id]
      page.tsx         # Concept detail
  /query
    page.tsx           # Query interface
  /api
    /segments
      /ingest
        route.ts       # POST endpoint for ingestion
    /concepts
      /route.ts        # GET all concepts
      /[id]
        route.ts       # GET concept by ID
    /graph
      route.ts         # GET graph data for visualization

/lib
  /neo4j
    client.ts          # Neo4j connection
    queries.ts         # Cypher query builders
  /ai
    normalize.ts       # LLM-based concept normalization
  /utils
    parsers.ts         # Parse segment data
    validators.ts      # Zod schemas
  /types
    index.ts           # TypeScript interfaces

/components
  /graph
    GraphVisualization.tsx
  /concepts
    ConceptCard.tsx
    ConceptDetail.tsx
  /upload
    UploadForm.tsx
```

---

### 5. Critical Implementation Details

#### Concept Normalization Strategy
```typescript
// When processing a segment:
const primaryConceptRaw = analysis.primary_concept.name;

// Get existing concepts from Neo4j (cache these!)
const existingConcepts = await getExistingConcepts();

// Normalize using LLM
const normalized = await normalizeConcept(
  primaryConceptRaw, 
  existingConcepts
);

if (normalized.is_new) {
  // Create new Concept node
  await createConcept(normalized);
} else {
  // Update existing Concept (add alias if new, increment mentions)
  await updateConcept(normalized.matched_existing_id, {
    aliases: [...existing.aliases, primaryConceptRaw],
    total_mentions: existing.total_mentions + 1,
    last_mentioned: new Date()
  });
}
```

#### Neo4j Queries Examples
```typescript
// Example: Create segment with relationships
const createSegmentQuery = `
  MERGE (v:Video {video_id: $video_id})
  ON CREATE SET v.url = $video_url, v.created_at = datetime()
  
  CREATE (s:Segment {
    segment_id: $segment_id,
    start_time: $start_time,
    end_time: $end_time,
    topic_hint: $topic_hint,
    created_at: datetime()
  })
  
  CREATE (s)-[:FROM_VIDEO]->(v)
  
  WITH s
  MATCH (c:Concept {concept_id: $concept_id})
  CREATE (s)-[:DISCUSSES {role: $role}]->(c)
  
  RETURN s
`;

// Example: Get concept with all relationships
const getConceptQuery = `
  MATCH (c:Concept {concept_id: $concept_id})
  
  OPTIONAL MATCH (c)<-[:DISCUSSES]-(s:Segment)
  OPTIONAL MATCH (c)<-[:ILLUSTRATES]-(e:Example)
  OPTIONAL MATCH (c)<-[:ABOUT]-(ki:KeyIdea)
  OPTIONAL MATCH (c)-[r:RELATED_TO]->(related:Concept)
  
  RETURN c,
         collect(DISTINCT s) as segments,
         collect(DISTINCT e) as examples,
         collect(DISTINCT ki) as key_ideas,
         collect(DISTINCT {concept: related, strength: r.strength}) as related_concepts
`;
```

#### Caching Strategy
- Cache existing concepts list in memory (refresh every 10 segments)
- Use Redis if scaling beyond single instance
- Batch process segments (process 10 at a time, then refresh cache)

---

### 6. Neo4j Setup

#### Option A: Docker (for local development)
```bash
docker run \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest
```

#### Option B: Neo4j Aura (cloud, free tier)
- Sign up at https://neo4j.com/cloud/aura/
- Create free instance
- Get connection URI and credentials
- Use in .env.local

#### Initial Schema Setup
Create constraints and indexes:
```cypher
// Constraints (uniqueness)
CREATE CONSTRAINT video_id IF NOT EXISTS FOR (v:Video) REQUIRE v.video_id IS UNIQUE;
CREATE CONSTRAINT segment_id IF NOT EXISTS FOR (s:Segment) REQUIRE s.segment_id IS UNIQUE;
CREATE CONSTRAINT concept_id IF NOT EXISTS FOR (c:Concept) REQUIRE c.concept_id IS UNIQUE;

// Indexes (performance)
CREATE INDEX concept_name IF NOT EXISTS FOR (c:Concept) ON (c.canonical_name);
CREATE INDEX concept_category IF NOT EXISTS FOR (c:Concept) ON (c.category);
CREATE INDEX segment_video IF NOT EXISTS FOR (s:Segment) ON (s.video_id);
```

---

### 7. Example Usage Flow

#### Step 1: User uploads segment data
```json
POST /api/segments/ingest
[
  {
    "video_url": "https://www.youtube.com/watch?v=wLoHNv9qMKw",
    "start_time": "00:03:54",
    "end_time": "00:04:42",
    "topic_hint": "Marketing tactics selection",
    "analysis_json": "{...}"
  }
]
```

#### Step 2: System processes
1. Parse analysis_json
2. Extract video_id: "wLoHNv9qMKw"
3. Normalize "Marketing Tactics Selection" → "Marketing Tactics" (existing concept)
4. Create Segment node
5. Link to Video and Concept nodes
6. Create ConceptInstance
7. Process examples and key ideas

#### Step 3: User explores graph
- Go to `/graph` → See visual network of concepts
- Click "Marketing Tactics" → See all 12 instances across 8 videos
- Click instance → Jump to video timestamp
- See related concepts: "Pricing Strategy", "Competitive Advantage"

---

### 8. Testing Data

Provide a test endpoint:
```typescript
// POST /api/segments/test-data
// Generates 20 fake segments for testing the UI
```

---

### 9. Nice-to-Have Features (implement if time allows)

1. **Importance Score Calculation**: Auto-calculate based on mention frequency, recency, and relationships
2. **Relationship Detection**: Periodically run batch job to detect concept relationships (which concepts appear together frequently)
3. **Search**: Full-text search across all content
4. **Export**: Export concept data as JSON or PDF report
5. **Analytics Dashboard**: Show stats (total concepts, most mentioned, etc.)
6. **Video Player Integration**: Embed YouTube player that jumps to specific timestamp

---

## Instructions for Claude Code

Please build this project with:
1. Clean, well-documented TypeScript code
2. Proper error handling
3. Loading states in UI
4. Responsive design
5. Comments explaining complex logic (especially Neo4j queries and concept normalization)
6. README.md with setup instructions
7. Example data file (sample-segments.json) for testing

**Start with**:
1. Set up Next.js project with TypeScript and Tailwind
2. Install dependencies (neo4j-driver, openai/google-generativeai, zod, etc.)
3. Create basic Neo4j client and connection test
4. Implement concept normalization function
5. Build ingestion pipeline
6. Create basic UI pages
7. Add graph visualization

**Prioritize**:
- Working data ingestion pipeline
- Correct concept normalization (avoiding duplicates)
- Basic graph visualization
- Simple UI to test the system

Let me know if you need clarification on any part of this specification!
