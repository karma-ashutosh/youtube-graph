# Debug Flow Guide - Tracing Data Through Your System

## Sample Data Point - Segment #10
**Video ID**: `wLoHNv9qMKw`
**Video URL**: https://www.youtube.com/watch?v=wLoHNv9qMKw
**Segment ID**: `10`
**Topic**: "Component 5: Sales Strategy. Differentiating through sales approaches (self-serve vs. high-touch enterprise) to find an advantage, exemplified by Bounce Exchange's managed service model."
**Time Range**: 00:04:44 - 00:05:58 (74 seconds)

### Original Input Data (from content_segments.json)
This segment contains:
- **2 Examples**:
  1. Real company: Bounce Exchange charging 100x more with managed service
  2. Metaphor: "Missing scale on the dragon's belly"
- **5 Key Ideas**:
  1. Sales strategy is 5th component of GTM (fact, not novel)
  2. Differentiate by choosing opposite approach (advice, not novel)
  3. High-touch justifies higher price (insight, not novel)
  4. Don't copy incumbents' strategies (advice, not novel)
  5. Find market vulnerabilities (advice, not novel)
- **1 Primary Concept**: "Sales Strategy (as a Go-To-Market component)"
- **4 Mentioned Concepts**: Optinmonster, Sumo.com, Marketing Strategy, Incumbents
- **6 Supporting Concepts**: GTM Strategy, Differentiation, Self-Serve Model, High-Touch Process, Pricing Strategy, Positioning

---

## Business Logic: How Data Flows Through the System

### Phase 1: Data Ingestion (JSON → Neo4j)

**Input**: `content_segments.json` - AI-analyzed video segments
**Endpoint**: `POST /api/segments/ingest`
**Code**: `lib/utils/ingest.ts:processSegmentsBatch()`

#### Step-by-Step Process:

1. **Create/Get Video Node**
   ```typescript
   createOrGetVideo(videoId, videoUrl)
   ```
   - Creates `Video` node if doesn't exist
   - Properties: `video_id`, `url`, `created_at`

2. **Create Segment Node**
   ```typescript
   createSegment({
     segmentId, videoId, startTime, endTime,
     durationSeconds, topicHint
   })
   ```
   - Creates `Segment` node
   - Links to Video via `FROM_VIDEO` relationship
   - Properties: `segment_id`, `start_time`, `end_time`, `duration_seconds`, `topic_hint`
   - **Note**: Original transcript is NOT stored (only in JSON file)

3. **Process Primary Concept**
   ```typescript
   // From: "Sales Strategy (as a Go-To-Market component)"
   // Normalized to ID: "sales-strategy-as-a-go-to-market-component"
   ```
   - Normalizes name to lowercase, spaces to hyphens for ID
   - Checks if concept exists (by normalized ID)
   - If exists: `updateConcept()` - increment mentions, add alias if new
   - If new: `createConcept()` - set initial mentions=1
   - Links to Segment via `DISCUSSES` relationship
   - Relationship properties: `role: "primary"`, `coverage_depth: "partial"`, `explanation_type: "how_to"`

4. **Process Supporting Concepts**
   ```typescript
   // Examples: "Differentiation", "Self-Serve Sales Model", etc.
   ```
   - Same normalization process
   - Links via `DISCUSSES` with `role: "supporting"`
   - Coverage depth from JSON: "partial" or "surface"

5. **Process Mentioned Concepts**
   ```typescript
   // Examples: "Optinmonster", "Sumo.com", "Marketing Strategy"
   ```
   - Same normalization process
   - Links via `DISCUSSES` with `role: "mentioned"`
   - Coverage depth: "reference_only"

6. **Create Examples**
   ```typescript
   createExample({
     exampleId: uuid(),
     exampleText: "Bounce Exchange charged 100x more...",
     exampleType: "real_company",
     conceptId, segmentId
   })
   ```
   - Creates `Example` node for each example
   - Links to Concept via `ILLUSTRATES` relationship
   - Links to Segment via `MENTIONED_IN` relationship
   - Properties: `example_id`, `example_text`, `example_type`, `company_name` (optional)

7. **Create Key Ideas**
   ```typescript
   createKeyIdea({
     ideaId: uuid(),
     ideaText: "Sales strategy is the fifth...",
     ideaType: "fact", // or "advice", "insight"
     isNovel: false,
     confidence: "high",
     conceptId, segmentId
   })
   ```
   - Creates `KeyIdea` node for each idea
   - Links to Concept via `ABOUT` relationship
   - Links to Segment via `EXTRACTED_FROM` relationship
   - Properties: `idea_id`, `idea_text`, `idea_type`, `is_novel`, `confidence`

### Phase 2: Data Storage (Neo4j Graph Structure)

```
Video (wLoHNv9qMKw)
  ↑ FROM_VIDEO
Segment (10)
  ↓ DISCUSSES (role: "primary", coverage: "partial")
  Concept (Sales Strategy as GTM component)
    ↑ ABOUT
    KeyIdea (fact: "Sales strategy is 5th component")
    ↑ ILLUSTRATES
    Example (real_company: Bounce Exchange)
  ↓ DISCUSSES (role: "supporting")
  Concept (Differentiation)
  Concept (High-Touch Sales Process)
  ...
  ↓ DISCUSSES (role: "mentioned")
  Concept (Optinmonster)
  Concept (Sumo.com)
  ...
```

**Key Relationships**:
- `Segment -[FROM_VIDEO]-> Video`
- `Segment -[DISCUSSES]-> Concept` (with role: primary/supporting/mentioned)
- `Example -[ILLUSTRATES]-> Concept`
- `Example -[MENTIONED_IN]-> Segment`
- `KeyIdea -[ABOUT]-> Concept`
- `KeyIdea -[EXTRACTED_FROM]-> Segment`

### Phase 3: Data Retrieval (Neo4j → API → UI)

#### API Endpoint: `/api/segments/10`
**Code**: `lib/neo4j/queries.ts:getSegmentById()`

**Query Logic**:
```cypher
MATCH (s:Segment {segment_id: $segment_id})-[:FROM_VIDEO]->(v:Video)
OPTIONAL MATCH (s)-[d:DISCUSSES]->(c:Concept)
OPTIONAL MATCH (e:Example)-[:MENTIONED_IN]->(s)
OPTIONAL MATCH (ki:KeyIdea)-[:EXTRACTED_FROM]->(s)
RETURN s, v,
       collect(DISTINCT {concept: c, discusses: d}) as concepts,
       collect(DISTINCT e) as examples,
       collect(DISTINCT ki) as key_ideas
```

**Returned Data Structure**:
```json
{
  "segment": {
    "segment_id": "10",
    "topic_hint": "Component 5: Sales Strategy...",
    "start_time": "00:04:44",
    "end_time": "00:05:58",
    "duration_seconds": 74
  },
  "video": {
    "video_id": "wLoHNv9qMKw",
    "url": "https://www.youtube.com/watch?v=wLoHNv9qMKw"
  },
  "concepts": [
    {
      "concept": { "canonical_name": "Sales Strategy...", "category": "..." },
      "discusses": { "role": "primary", "coverage_depth": "partial" }
    },
    // ... 22 more concepts (6 supporting + 4 mentioned + duplicates)
  ],
  "examples": [
    // Note: Examples may be missing if not properly linked
  ],
  "keyIdeas": [
    {
      "idea_text": "Sales strategy is the fifth key component...",
      "idea_type": "fact",
      "is_novel": false,
      "confidence": "high"
    },
    // ... 19 more ideas (some may be duplicates)
  ]
}
```

### Phase 4: UI Rendering

**URL**: http://localhost:3000/segments/10
**Component**: `app/segments/[id]/page.tsx`

**Rendering Logic**:
1. Fetches data from `/api/segments/10`
2. Separates concepts by role:
   - `primaryConcepts` = where `discusses.role === "primary"`
   - `supportingConcepts` = where `discusses.role === "supporting"`
   - `mentionedConcepts` = where `discusses.role === "mentioned"`
3. Displays in themed sections with cybernetic colors
4. YouTube link includes timestamp: `&t=284s` (00:04:44 = 284 seconds)

---

## Data Validation: Segment #10

### ✅ Expected Data (from JSON):
- Primary concepts: 1
- Supporting concepts: 6
- Mentioned concepts: 4
- Examples: 2
- Key ideas: 5
- Total concepts in DISCUSSES relationships: 11

### ❓ Actual Data in Neo4j:
```bash
# Check concepts
docker exec youtube-graph-neo4j cypher-shell -u neo4j -p password123 \
  "MATCH (s:Segment {segment_id: '10'})-[d:DISCUSSES]->(c:Concept)
   RETURN d.role, count(*)
   ORDER BY d.role"
```

**Result**: 23 total DISCUSSES relationships (duplicates present!)
- Primary: ~2 (should be 1)
- Supporting: varies
- Mentioned: ~8 (should be 4)

### ⚠️ Issues Identified:

1. **Duplicate Concepts**: Same concept appears multiple times
   - "Sales Strategy (as a Go-To-Market component)" appears 2x as primary
   - "Marketing Strategy" appears 2x as mentioned
   - Likely cause: Normalization issue in `lib/utils/ingest.ts`

2. **Examples May Be Missing**:
   - JSON has 2 examples
   - Query returns 0 examples
   - Likely cause: `ILLUSTRATES` relationship not created or wrong direction

3. **Duplicate Key Ideas**:
   - JSON has 5 unique ideas
   - Neo4j returns 20 key ideas
   - Likely cause: Multiple ingestions or concept ID mismatch

---

## 1. Neo4j Database Layer

### Check Video Exists
```cypher
MATCH (v:Video {video_id: 'wLoHNv9qMKw'})
RETURN v
```

**Result**: Video exists with URL

### Check Segment Exists
```cypher
MATCH (s:Segment {segment_id: '10'})-[:FROM_VIDEO]->(v:Video)
RETURN s, v
```

**Result**: Segment exists and is linked to video

### Check Concepts
```cypher
MATCH (s:Segment {segment_id: '10'})-[d:DISCUSSES]->(c:Concept)
RETURN c.canonical_name, c.category, d.role, d.coverage_depth
ORDER BY d.role
```

**Results Found**:
- Primary Concept: "Sales Strategy (as a Go-To-Market component)"
- Mentioned Concepts: "Incumbents", "Sumo.com", "Marketing Strategy", "Optinmonster"

**Issue Noticed**: Some concepts appear duplicated!

### Check Key Ideas
```cypher
MATCH (ki:KeyIdea)-[:EXTRACTED_FROM]->(s:Segment {segment_id: '10'})
RETURN ki.idea_type, ki.idea_text, ki.is_novel
```

**Results Found**:
- ✅ Fact: "Sales strategy is the fifth key component..."
- ✅ Advice: "Find vulnerability or underserved area..."

### Check Examples
```cypher
MATCH (e:Example)-[:MENTIONED_IN]->(s:Segment {segment_id: '10'})
RETURN e.example_type, e.example_text
```

**Result**: No examples found for this segment

---

## 2. Backend API Layer

### Test Segment API Endpoint
```bash
curl http://localhost:3000/api/segments/10 | jq
```

**Expected Response**:
```json
{
  "segment": {
    "segment_id": "10",
    "topic_hint": "Component 5: Sales Strategy...",
    "start_time": "00:04:44",
    "end_time": "00:05:58",
    "duration_seconds": 74
  },
  "video": {
    "video_id": "wLoHNv9qMKw",
    "url": "https://www.youtube.com/watch?v=wLoHNv9qMKw"
  },
  "concepts": [...],
  "examples": [],
  "keyIdeas": [...]
}
```

**Code Path**:
- `app/api/segments/[id]/route.ts` → calls `getSegmentById()`
- `lib/neo4j/queries.ts:430` → `getSegmentById()` function

### Test Concepts API Endpoint
```bash
curl http://localhost:3000/api/concepts | jq
```

**Code Path**:
- `app/api/concepts/route.ts` → calls `getAllConcepts()`
- `lib/neo4j/queries.ts:8` → `getAllConcepts()` function

### Test Graph API Endpoint
```bash
curl "http://localhost:3000/api/graph?limit=50&minMentions=0" | jq
```

**Expected Response**:
```json
{
  "success": true,
  "nodes": [...],
  "links": [...]
}
```

**Code Path**:
- `app/api/graph/route.ts` → calls `getGraphData()`
- `lib/neo4j/queries.ts:486` → `getGraphData()` function

---

## 3. Frontend UI Layer

### Navigate Through UI

#### Option 1: View Segments List
1. Go to: http://localhost:3000/segments
2. Search for "Sales Strategy"
3. Should see segment #10
4. Click "View Details"

**Code Path**:
- `app/segments/page.tsx` → fetches from `/api/segments`
- Click triggers navigation to `/segments/10`

#### Option 2: View Specific Segment
1. Go directly to: http://localhost:3000/segments/10
2. Should see:
   - ✅ Video info with YouTube link
   - ✅ Time range (00:04:44 - 00:05:58)
   - ✅ Primary Concepts section
   - ✅ Mentioned Concepts section
   - ✅ Key Ideas section
   - ❓ Examples section (might be empty)

**Code Path**: `app/segments/[id]/page.tsx`

#### Option 3: View in Graph
1. Go to: http://localhost:3000/graph
2. Look for "Sales Strategy" node (should be cyan colored)
3. Click on it
4. Side panel should open with details

**Code Path**: `app/graph/page.tsx`

#### Option 4: View Concepts List
1. Go to: http://localhost:3000/concepts
2. Search for "Sales Strategy"
3. Click on it
4. Should show all segments where it's discussed

**Code Path**:
- `app/concepts/page.tsx` → lists concepts
- `app/concepts/[id]/page.tsx` → shows concept details

---

## 4. Data Flow Diagram

```
YouTube Video (wLoHNv9qMKw)
    ↓
[Transcript Analysis]
    ↓
JSON Segment Data
    ↓
POST /api/segments/ingest
    ↓
lib/utils/ingest.ts:processSegmentsBatch()
    ↓
├─ lib/neo4j/queries.ts:createOrGetVideo()
├─ lib/neo4j/queries.ts:createSegment()
├─ lib/neo4j/queries.ts:createConcept() or updateConcept()
├─ lib/neo4j/queries.ts:linkSegmentToConcept()
├─ lib/neo4j/queries.ts:createExample()
└─ lib/neo4j/queries.ts:createKeyIdea()
    ↓
Neo4j Database
    ↓
Query APIs
├─ GET /api/segments/[id]
├─ GET /api/concepts
├─ GET /api/concepts/[id]
└─ GET /api/graph
    ↓
Frontend UI
├─ /segments/[id]
├─ /concepts
├─ /concepts/[id]
└─ /graph
```

---

## 5. Common Issues to Check

### Issue 1: Duplicate Concepts
**Symptom**: Same concept appears multiple times in queries
**Where to Check**:
```cypher
MATCH (c:Concept)
WHERE c.canonical_name = 'Sales Strategy (as a Go-To-Market component)'
RETURN count(c)
```
**Expected**: Should return 1
**If > 1**: There's a normalization issue in `lib/utils/ingest.ts`

### Issue 2: Graph Not Showing Data
**Symptoms**: Empty graph or "No data to display"
**Where to Check**:
1. Browser console for errors
2. Network tab → check `/api/graph` response
3. Neo4j Browser: `MATCH (c:Concept) RETURN count(c)`

### Issue 3: Segment Details Not Loading
**Symptoms**: "Segment not found" or loading forever
**Where to Check**:
1. Browser console for errors
2. Network tab → check `/api/segments/10` response
3. Server logs for Neo4j connection errors

### Issue 4: Missing Relationships
**Symptoms**: Concepts shown but no connections in graph
**Where to Check**:
```cypher
MATCH (c1:Concept)<-[:DISCUSSES]-(s:Segment)-[:DISCUSSES]->(c2:Concept)
RETURN count(*) as connections
```
**Expected**: Should be > 0

---

## 6. Quick Debug Commands

### Check Neo4j Connection
```bash
docker exec youtube-graph-neo4j cypher-shell -u neo4j -p password123 "MATCH (n) RETURN count(n) as total_nodes"
```

### Count All Node Types
```bash
docker exec youtube-graph-neo4j cypher-shell -u neo4j -p password123 "MATCH (n) RETURN labels(n) as type, count(*) as count"
```

### Count All Relationship Types
```bash
docker exec youtube-graph-neo4j cypher-shell -u neo4j -p password123 "MATCH ()-[r]->() RETURN type(r) as type, count(*) as count"
```

### Test Full Segment Retrieval
```bash
curl -s http://localhost:3000/api/segments/10 | jq '{
  segment_id: .segment.segment_id,
  topic: .segment.topic_hint,
  concept_count: (.concepts | length),
  key_ideas_count: (.keyIdeas | length),
  examples_count: (.examples | length)
}'
```

### Test Graph Data
```bash
curl -s "http://localhost:3000/api/graph?limit=10" | jq '{
  node_count: (.nodes | length),
  link_count: (.links | length)
}'
```

---

## 7. Step-by-Step Manual Test

1. **Test Neo4j Connection**:
   ```bash
   docker ps | grep neo4j
   ```
   Should show: `youtube-graph-neo4j` running

2. **Test Backend APIs**:
   ```bash
   curl http://localhost:3000/api/segments/10
   curl http://localhost:3000/api/concepts
   curl "http://localhost:3000/api/graph?limit=10"
   ```
   All should return JSON (not errors)

3. **Test Frontend Pages**:
   - Open http://localhost:3000 (should show home with logo)
   - Click "Segments" → should show list
   - Click "Concepts" → should show list
   - Click "Graph" → should show visualization
   - Click on any node → side panel should open

4. **Test Specific Segment**:
   - Go to http://localhost:3000/segments/10
   - Should see "Sales Strategy" topic
   - Should see concepts listed
   - Click "Watch on YouTube" → should open video at timestamp

---

## 8. Expected Working State

✅ Neo4j running on port 7687
✅ Neo4j Browser accessible at http://localhost:7474
✅ Next.js dev server running on port 3000
✅ All API endpoints returning data
✅ All UI pages rendering with cybernetic theme
✅ Graph showing nodes with cyan/red/purple colors
✅ Clicking nodes opens side panel
✅ All links and navigation working

---

## Next Steps for Debugging

1. Start at Neo4j layer - verify data exists
2. Test API endpoints - verify data flows through
3. Check Frontend - verify UI renders correctly
4. Test interactions - verify clicks and navigation work
5. Check browser console for any JavaScript errors
6. Check server logs for any API errors

## Complete Business Logic Summary

### Data Transformation Pipeline

```
YouTube Video Transcript
    ↓ (AI Analysis - external)
JSON with AI-extracted concepts, examples, ideas
    ↓ (POST /api/segments/ingest)
Normalization & Graph Construction
    ↓ (Neo4j Cypher queries)
Graph Database Storage
    ↓ (GET /api/segments/[id])
API Response Assembly
    ↓ (React Component)
Cybernetic-themed UI Display
```

### Key Business Rules

1. **Concept Normalization**:
   - Concept names → lowercase, spaces → hyphens
   - Used as unique ID: "Sales Strategy" → "sales-strategy"
   - Canonical name stored separately for display
   - Aliases collected when same concept mentioned with different names

2. **Concept Categorization**:
   - Default: "Uncategorized"
   - Should be set during ingestion (not currently happening)
   - Used for color-coding in graph visualization

3. **Relationship Roles**:
   - **Primary**: Main topic of the segment (1 per segment typically)
   - **Supporting**: Concepts explained to support primary (multiple)
   - **Mentioned**: Briefly referenced concepts (multiple)
   - Role determines visual prominence in UI

4. **Coverage Depth**:
   - **comprehensive**: Fully explained with examples
   - **partial**: Explained but not exhaustively
   - **surface**: Touched on briefly
   - **reference_only**: Just mentioned by name

5. **Example Types**:
   - **real_company**: Actual business case study
   - **personal_story**: Speaker's own experience
   - **metaphor**: Conceptual illustration
   - **hypothetical**: Made-up scenario

6. **Key Idea Types**:
   - **fact**: Objective statement
   - **advice**: Actionable recommendation
   - **insight**: Novel observation or connection

7. **Novelty & Confidence**:
   - `is_novel`: true/false - Is this a new/unique idea?
   - `confidence`: high/medium/low - How certain is the AI?

### Data Integrity Checks

**Run these queries to validate your data**:

1. **Check for duplicate concepts**:
```cypher
MATCH (c:Concept)
WITH c.canonical_name as name, collect(c) as concepts
WHERE size(concepts) > 1
RETURN name, size(concepts) as count
ORDER BY count DESC
```

2. **Check for orphaned nodes**:
```cypher
// Segments not linked to videos
MATCH (s:Segment)
WHERE NOT (s)-[:FROM_VIDEO]->(:Video)
RETURN count(s) as orphaned_segments

// Concepts not linked to segments
MATCH (c:Concept)
WHERE NOT (c)<-[:DISCUSSES]-(:Segment)
RETURN count(c) as orphaned_concepts
```

3. **Validate relationship counts**:
```cypher
// Each segment should have at least 1 DISCUSSES relationship
MATCH (s:Segment)
OPTIONAL MATCH (s)-[d:DISCUSSES]->()
WITH s, count(d) as concept_count
WHERE concept_count = 0
RETURN count(s) as segments_without_concepts
```

4. **Check data completeness**:
```cypher
// Expected structure for a complete segment
MATCH (v:Video)<-[:FROM_VIDEO]-(s:Segment)
OPTIONAL MATCH (s)-[:DISCUSSES]->(c:Concept)
OPTIONAL MATCH (e:Example)-[:MENTIONED_IN]->(s)
OPTIONAL MATCH (ki:KeyIdea)-[:EXTRACTED_FROM]->(s)
RETURN 
  s.segment_id,
  count(DISTINCT c) as concepts,
  count(DISTINCT e) as examples,
  count(DISTINCT ki) as key_ideas
ORDER BY s.segment_id
```

### Expected Performance Metrics

For a typical segment like #10:
- **Storage**: ~500 bytes per segment node + ~200 bytes per relationship
- **Ingestion time**: <100ms per segment
- **Query time**: <50ms for segment detail retrieval
- **Graph render time**: <500ms for 50 nodes

### Troubleshooting Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| Duplicates | Same concept appears multiple times | Check normalization in `lib/utils/ingest.ts` |
| Missing examples | Examples in JSON but not in Neo4j | Verify `createExample()` is called with correct concept_id |
| Graph shows no links | Nodes present but disconnected | Check `DISCUSSES` relationships were created |
| Slow queries | Page takes >2s to load | Add indexes on `concept_id`, `segment_id` |
| Wrong categories | All concepts "Uncategorized" | Category extraction not implemented in ingestion |

### Next Steps for Improvement

1. **Fix Duplication**: 
   - Ensure concept normalization is consistent
   - Add unique constraints in Neo4j schema
   - Prevent multiple ingestions of same data

2. **Add Category Detection**:
   - Extract categories from AI analysis
   - Map concepts to categories during ingestion
   - Use for better graph visualization

3. **Store Original Transcript**:
   - Add `transcript_text` property to Segment
   - Allows full-text search
   - Enables transcript display in UI

4. **Add Concept Relationships**:
   - Create `RELATED_TO` between co-occurring concepts
   - Calculate relationship strength by co-occurrence count
   - Enables concept-to-concept navigation

5. **Performance Optimization**:
   - Add more indexes for common queries
   - Implement caching for frequently accessed segments
   - Paginate large result sets
