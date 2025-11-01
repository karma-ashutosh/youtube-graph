# Prompt Analysis for Playlist Video Analysis

## Current Prompt Evaluation

### ✅ **Strengths:**

1. **Clear Structure**: The prompt has well-defined sections (PRIMARY, SUPPORTING, MENTIONED concepts)
2. **Good Examples**: The JSON output format is clear with realistic examples
3. **Context Awareness**: Includes video outline and segment timestamps
4. **Proper Classification**: Distinguishes between different concept types and coverage depths

### ⚠️ **Issues for Playlist Use Case:**

#### 1. **Missing Context Fields**
The current output doesn't match your actual data model:
- ❌ Missing: `explanation_type` options incomplete (should include "metaphor", "story")
- ❌ Missing: `type` for key_ideas should include "opinion" and "definition" (as seen in your data)
- ❌ Missing: `data_point` type for examples

#### 2. **Coverage Depth Incomplete**
Your data has 4 coverage depths but prompt only shows 3:
- Prompt: `comprehensive | partial | surface`
- Your data: `comprehensive | partial | surface | reference_only`

#### 3. **No Cross-Segment Awareness**
For playlists, you need:
- ❌ No guidance on handling concepts mentioned in previous/future segments
- ❌ No instruction to identify if a concept is being revisited
- ❌ No mechanism to detect if examples span multiple segments

#### 4. **Weak "Mentioned Concepts" Guidance**
- Current: Just says "briefly REFERENCED"
- Better: Should specify to capture exact quotes or phrases where mentioned

#### 5. **Missing Video-Level Context**
For playlists:
- ❌ No video title or series context
- ❌ No previous segment summaries (only outline)
- ❌ No instruction on how concepts relate across the entire video/playlist

#### 6. **Example Classification Missing Type**
Your data shows `data_point` as an example type but prompt doesn't list it.

## Recommended Improvements

### For Single Video Analysis (Current Use Case):
1. ✅ Add missing enum values
2. ✅ Add guidance for mentioned concepts (capture quotes)
3. ✅ Add instruction to identify concept relationships
4. ✅ Specify when to mark concepts as "reference_only"

### For Playlist Analysis (Future Use Case):
1. 🔄 Add playlist/series context field
2. 🔄 Include previous segments' primary concepts as context
3. 🔄 Add `is_revisited` flag for concepts mentioned in prior segments
4. 🔄 Add `cross_segment_reference` field to link related discussions
5. 🔄 Include video metadata (title, description, position in playlist)

---

## Gaps Summary

| Gap | Impact | Priority | Fix Needed |
|-----|--------|----------|------------|
| Missing enum values | Data validation fails | 🔴 High | Update prompt immediately |
| No cross-segment awareness | Can't build concept continuity | 🟡 Medium | Add for playlist mode |
| Weak mentioned concepts | Loses context | 🟡 Medium | Add quote extraction |
| No video metadata | Missing structural info | 🟢 Low | Add for playlist mode |
| No concept relationship hints | Manual work to connect | 🟡 Medium | Add relationship field |

---

## Next Steps

1. **Immediate**: Update prompt with correct enum values
2. **Short-term**: Add quote extraction for mentioned concepts
3. **Future**: Create playlist-specific prompt variant with cross-video context
