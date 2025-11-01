# Focused Knowledge Graph Approach

## Problem Identified

**Current state:** 53.2% of extracted concepts are "noise"
- 23 "mentioned concepts" with `reference_only` depth (just name-drops)
- 2 "supporting concepts" with `surface` depth (barely explained)
- These don't add value for learning or knowledge building

## Solution: Focus on Substantive Concepts Only

### What Changes

#### 1. Remove These Fields Entirely

**From Analysis Output:**
- ❌ Remove `mentioned_concepts` array entirely
- ❌ Remove `reference_only` coverage depth
- ❌ Remove `surface` coverage depth

**Rationale:** If a concept isn't explained with at least `partial` depth, it's not worth tracking in a knowledge graph for learning purposes.

#### 2. New Simplified Coverage Depths (2 options)

- ✅ `comprehensive` = Thoroughly explained with definitions, examples, nuance
- ✅ `partial` = Explained with some depth but not exhaustive

**Removed:**
- ❌ `surface` - Too shallow to be useful
- ❌ `reference_only` - Just noise

#### 3. Stricter Supporting Concepts Criteria

**Old approach:** Include anything mentioned that relates to primary
**New approach:** Only include if it's EXPLAINED to help understand primary

**Guideline:** 2-5 supporting concepts max (not 12!)

---

## Code Changes Needed

### 1. Update TypeScript Types (`lib/types/index.ts`)

```typescript
// OLD
export interface AnalysisData {
  // ... other fields
  mentioned_concepts: Array<{
    name: string;
    context: string;
    coverage_depth: "comprehensive" | "partial" | "reference_only" | "surface";
  }>;
  supporting_concepts: Array<{
    name: string;
    role: string;
    coverage_depth: "comprehensive" | "partial" | "reference_only" | "surface";
  }>;
  primary_concept: {
    name: string;
    coverage_depth: "comprehensive" | "partial" | "reference_only" | "surface";
    explanation_type: string;
  };
}

// NEW
export interface AnalysisData {
  // ... other fields
  // mentioned_concepts removed entirely
  supporting_concepts: Array<{
    name: string;
    role: string;
    coverage_depth: "comprehensive" | "partial";  // Only 2 options
  }>;
  primary_concept: {
    name: string;
    coverage_depth: "comprehensive" | "partial";  // Only 2 options
    explanation_type: "definition" | "case_study" | "how_to" | "comparison" | "metaphor" | "story";
  };
}
```

### 2. Update Validators (`lib/utils/validators.ts`)

```typescript
// OLD
mentioned_concepts: z.array(
  z.object({
    name: z.string(),
    context: z.string(),
    coverage_depth: z.enum(["comprehensive", "partial", "reference_only", "surface"]),
  })
),

// NEW - remove mentioned_concepts entirely
// Update coverage_depth enums:
coverage_depth: z.enum(["comprehensive", "partial"]),
```

### 3. Update Ingestion Logic (`lib/utils/ingest.ts`)

```typescript
// OLD
// Step 5: Process mentioned concepts
for (const mentionedConcept of analysis.mentioned_concepts) {
  // ... processing logic
}

// NEW - remove this entire section
// mentioned_concepts no longer exist
```

### 4. Update UI Components

**Segment Detail Page (`app/segments/[id]/page.tsx`):**
```typescript
// OLD - remove this section:
{mentionedConcepts.length > 0 && (
  <div className="card">
    <h2>Mentioned Concepts</h2>
    {/* ... */}
  </div>
)}
```

---

## Impact Analysis

### Storage Reduction
- **Before:** ~47 concepts per 3 segments (15.7 avg per segment)
- **After:** ~22 concepts per 3 segments (7.3 avg per segment)
- **Reduction:** 53% fewer concept nodes

### Neo4j Benefits
1. **Cleaner graph** - Only concepts that actually matter
2. **Better relationships** - Connections are more meaningful
3. **Faster queries** - Less noise to filter
4. **More useful visualization** - Graph shows actual knowledge structure

### User Benefits
1. **Better learning** - Only see concepts that were actually taught
2. **Clearer connections** - Relationships make sense
3. **Reduced cognitive load** - Not overwhelmed with references
4. **Higher quality** - Every concept is substantive

---

## Migration Strategy

### Option A: Clean Break (Recommended)
1. Update schema to remove mentioned_concepts
2. Use `focused_content_prompt.txt` for all future ingestion
3. Keep existing data as-is (it has mentioned_concepts but they won't break anything)
4. New data will be cleaner

### Option B: Data Migration
1. Delete all `mentioned_concepts` relationships from Neo4j
2. Delete all `surface` and `reference_only` supporting concepts
3. Re-process existing segments with new prompt
4. Cleaner graph but more work

**Recommendation:** Use Option A - the old data won't hurt, and new data will be better.

---

## Example Comparison

### OLD (Noisy):
```json
{
  "primary_concept": {"name": "Positioning", "coverage_depth": "comprehensive"},
  "supporting_concepts": [
    {"name": "Mental Availability", "coverage_depth": "partial"},
    {"name": "Copywriting", "coverage_depth": "surface"},  // ❌ Noise
    {"name": "Company Size", "coverage_depth": "partial"}
  ],
  "mentioned_concepts": [
    {"name": "B2B", "coverage_depth": "reference_only"},  // ❌ Noise
    {"name": "SaaS", "coverage_depth": "reference_only"}, // ❌ Noise
    {"name": "RevOps", "coverage_depth": "reference_only"}, // ❌ Noise
    {"name": "CS", "coverage_depth": "reference_only"}, // ❌ Noise
    // ... 19 more noise entries
  ]
}
```

### NEW (Focused):
```json
{
  "primary_concept": {"name": "Positioning", "coverage_depth": "comprehensive"},
  "supporting_concepts": [
    {"name": "Mental Availability", "coverage_depth": "partial"},
    {"name": "Repositioning", "coverage_depth": "partial"},
    {"name": "Company Size", "coverage_depth": "partial"}
  ]
  // No mentioned_concepts - they were all noise!
}
```

**Result:** 13 concepts → 4 concepts (70% reduction in noise!)

---

## Next Steps

1. ✅ Review `focused_content_prompt.txt`
2. 🔲 Decide: Option A (clean break) or Option B (migrate old data)
3. 🔲 Update TypeScript types and validators
4. 🔲 Update ingestion logic
5. 🔲 Update UI components
6. 🔲 Test with one segment
7. 🔲 Deploy and use for all future analysis

**Benefits:** Cleaner data, better learning experience, more useful knowledge graph.
