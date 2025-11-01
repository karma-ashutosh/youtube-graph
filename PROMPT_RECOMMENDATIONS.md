# Prompt Analysis & Recommendations

## Summary

Your current prompt (`test_content_prompt.txt`) is **good but incomplete** for playlist analysis. I've created two improved versions:

1. ✅ **`improved_content_prompt.txt`** - For single video analysis (use this NOW)
2. 🔄 **`playlist_content_prompt.txt`** - For playlist series analysis (future use)

---

## Key Issues with Current Prompt

### 🔴 **Critical Issues** (Fix Immediately)

1. **Missing enum values** - Your data has values not in the prompt:
   - `explanation_type`: Missing "metaphor", "story"
   - `key_ideas.type`: Missing "opinion", "definition"
   - `examples.type`: Missing "data_point"
   - `coverage_depth`: Missing "reference_only"

2. **Template syntax unclear** - Uses `{{25.segment_text}}` but unclear what "25" refers to

3. **No quote extraction** - "Mentioned concepts" need actual quotes from transcript

### 🟡 **Medium Priority** (For Better Results)

1. **Weak guidance on concept classification**
   - Doesn't clearly distinguish PRIMARY vs SUPPORTING vs MENTIONED
   - No examples of edge cases

2. **No cross-segment awareness**
   - For playlists, needs to know if concepts were covered before
   - Can't identify concept evolution across segments

3. **Missing structural guidance**
   - No guidance on how many of each type to extract
   - No instruction on handling ambiguous cases

---

## What I've Improved

### In `improved_content_prompt.txt`:

✅ **Complete enum values** - All types from your actual data
✅ **Clear guidelines** - Detailed instructions for each section
✅ **Better examples** - Shows all concept types with realistic content
✅ **Quote extraction** - Requires actual quotes for mentioned concepts
✅ **Coverage depth guide** - Explains when to use each level
✅ **Validation reminders** - Reminds to output valid JSON

### In `playlist_content_prompt.txt`:

🔄 **Cross-video context** - Includes previous video concepts
🔄 **Segment continuity** - Notes if concept was in previous segments
🔄 **Cross-references** - New field to capture callbacks/foreshadowing
🔄 **Evolution tracking** - Marks if concept is being revisited
🔄 **Playlist metadata** - Video position, series title, etc.

---

## Comparison Table

| Feature | Current | Improved | Playlist |
|---------|---------|----------|----------|
| Complete enum values | ❌ | ✅ | ✅ |
| Clear section guidelines | ⚠️ Weak | ✅ | ✅ |
| Quote extraction | ❌ | ✅ | ✅ |
| Coverage depth examples | ⚠️ Partial | ✅ | ✅ |
| Cross-segment awareness | ❌ | ❌ | ✅ |
| Cross-video context | ❌ | ❌ | ✅ |
| Concept evolution tracking | ❌ | ❌ | ✅ |
| Example continuity | ❌ | ❌ | ✅ |
| Callback detection | ❌ | ❌ | ✅ |

---

## Recommendations

### Immediate (Single Video Use Case)

1. **Replace** `test_content_prompt.txt` with `improved_content_prompt.txt`
2. **Update** your video outline template variable name (remove confusing "25." prefix)
3. **Test** with one of your segments (ID 14, 15, or 16) to validate output
4. **Verify** JSON schema matches your TypeScript types

### Short-term (Before Playlist Analysis)

1. **Add** concept normalization hints to prompt (e.g., "Product-Market Fit" vs "PMF")
2. **Include** examples of ambiguous cases in the prompt
3. **Test** with your `filtered_segments_with_transcript.json` file

### Long-term (Playlist Support)

1. **Switch** to `playlist_content_prompt.txt` when analyzing series
2. **Build** context accumulator to pass previous segments' concepts
3. **Create** cross-reference graph to visualize concept connections
4. **Add** concept evolution timeline visualization

---

## Testing Plan

### Phase 1: Validate Improved Prompt
```bash
# Test with segment 14 (has good transcript and analysis)
# Compare AI output with existing analysis in test_content_segment.json
# Check if all fields match your schema
```

### Phase 2: Process Filtered Segments
```bash
# Use improved_content_prompt.txt with filtered_segments_with_transcript.json
# Generate fresh analysis for all 3 segments
# Ingest into Neo4j
# Verify on segment detail page
```

### Phase 3: Playlist Mode (Future)
```bash
# When you have multiple videos in a series:
# - Use playlist_content_prompt.txt
# - Pass previous video concepts as context
# - Build cross-reference relationships in Neo4j
```

---

## Questions to Consider

1. **Concept normalization**: Should "PMF" and "Product-Market Fit" be the same concept?
   - Currently handled by your AI normalization
   - Prompt could hint at this

2. **Example granularity**: How detailed should example text be?
   - Current: 1-3 sentences (good)
   - Consider: Full quote vs. summary

3. **Cross-segment duplicates**: If same concept appears in segments 14 & 15:
   - Single video: Merge them
   - Playlist: Track evolution

4. **Mentioned concept threshold**: When is a concept "mentioned" vs "supporting"?
   - Improved prompt gives clearer guidance
   - May need iteration based on results

---

## Next Steps

1. ✅ Review `improved_content_prompt.txt`
2. ✅ Review `playlist_content_prompt.txt`
3. 🔲 Test improved prompt with your AI
4. 🔲 Compare output quality with existing analysis
5. 🔲 Decide if you need playlist features now or later
6. 🔲 Update your ingestion pipeline to use new prompt

Let me know if you'd like me to test the improved prompt against one of your segments!
