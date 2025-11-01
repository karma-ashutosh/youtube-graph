# Video Segmentation Strategy for Knowledge Graphs

## Your Question: "Should I keep 10 min segments for 20-40 min videos?"

**Answer: YES, 5-12 minute segments are ideal!** ✅

Here's why:

---

## Optimal Segment Length

### For 20-40 Minute Educational Videos:

**Target: 5-12 minute segments**
- 20 min video → 3-4 segments (5-7 min each)
- 30 min video → 4-6 segments (5-8 min each)
- 40 min video → 5-8 segments (5-10 min each)

### Why This Length Works:

1. **Learning Psychology**
   - One concept can be taught thoroughly in 5-12 minutes
   - Attention span aligns well with this duration
   - Enough time for: definition + examples + nuance

2. **Knowledge Graph Quality**
   - Each segment = ONE primary concept (clear, focused)
   - 3-7 key ideas per segment (substantive learning)
   - 2-5 examples per segment (concrete illustrations)
   - Supporting concepts have room to be explained

3. **Analysis Quality**
   - Easier for AI to extract focused concepts
   - Less noise (not mixing multiple topics)
   - Better relationship identification

---

## Comparison of Approaches

### ❌ Too Short (1-3 min segments)

**Problems:**
- Not enough depth to fully explain a concept
- Will extract only 1-2 key ideas
- Concepts marked as "surface" or "partial" coverage
- Too many segment switches = fragmented learning
- Hard to find examples within short timeframe

**Example:**
```
Segment 1 (0:00-1:30): "Introduction to positioning"
  → Too short to actually teach what positioning IS
  → Maybe 1 key idea extracted
  → Coverage: surface
```

### ❌ Too Long (20+ min segments)

**Problems:**
- Covers multiple concepts (hard to identify primary)
- Extracts 15+ key ideas (overwhelming)
- Difficult to determine what segment is "about"
- Higher noise (mentioned concepts increase)
- Analysis takes longer, more errors

**Example:**
```
Segment 1 (0:00-25:00): "Overview of positioning"
  → Actually covers: definition, examples, applications, mistakes, tips
  → 5 different concepts mixed together
  → Unclear what the PRIMARY concept is
```

### ✅ Just Right (5-12 min segments)

**Sweet Spot:**
- ONE concept explained with depth
- 3-7 key ideas (learnable takeaways)
- 2-5 examples (concrete illustrations)
- Coverage: comprehensive or partial
- Clear primary concept identification

**Example:**
```
Segment 1 (0:00-6:30): "Definition of positioning and its three core questions"
  → Primary: "Positioning"
  → 5 key ideas about what it is and why it matters
  → 3 examples (Celsius, YouTube repositioning)
  → Coverage: comprehensive
  → Supporting: Mental Availability, Repositioning
```

---

## Updated Segmentation Prompt

I created `improved_summary_prompt.txt` which:

1. **Targets 5-12 minute segments** for 20-40 min videos
2. **Concept-driven boundaries** (break when concept changes)
3. **Natural transitions** (not mid-example or mid-story)
4. **Better topic hints** (specific about what's taught)

### Key Changes from Old Prompt:

| Old | New |
|-----|-----|
| "Do not overbreak" (vague) | "Target 5-12 minutes per segment" |
| No length guidance | "Minimum 3 min, Maximum 15 min" |
| Generic topic hints | "State WHAT concept + HOW it's taught" |
| No examples | Shows good vs bad segmentation |

---

## Expected Results for Your Videos

### For a 30-minute educational video:

**Old approach (your current data):**
- 3 segments: 25min, 68min, 89min ❌ (WRONG - these are cumulative times!)
- Too few segments
- Transcripts are snippets (incomplete)

**Improved approach:**
- 5 segments: ~6 min each ✅
- Each focused on one concept
- Full transcripts (not snippets)
- Clear learning outcomes

### Segmentation Example:

**Video: "Product Positioning" (30 minutes)**

```json
{
  "segments": [
    {
      "segment_id": 1,
      "start_time": "00:00",
      "end_time": "05:45",
      "topic_hint": "Personal story about confusion with software jargon leading to realization that companies have vague positioning"
    },
    {
      "segment_id": 2,
      "start_time": "05:45",
      "end_time": "12:20",
      "topic_hint": "Examples of bad positioning: analyzing vague homepage copy from companies like Clari, Slack, and others"
    },
    {
      "segment_id": 3,
      "start_time": "12:20",
      "end_time": "18:30",
      "topic_hint": "Root cause analysis: positioning problem vs. copywriting problem, and why large companies vs. startups struggle differently"
    },
    {
      "segment_id": 4,
      "start_time": "18:30",
      "end_time": "24:15",
      "topic_hint": "Definition of positioning: answering who, what, and why better to achieve mental availability"
    },
    {
      "segment_id": 5,
      "start_time": "24:15",
      "end_time": "30:00",
      "topic_hint": "Case studies of successful repositioning: Celsius energy drink and YouTube's pivot from dating to video sharing"
    }
  ]
}
```

Each segment = 5-6 minutes, ONE clear concept, ready for focused analysis.

---

## Action Items

1. ✅ Use `improved_summary_prompt.txt` for future segmentations
2. 🔲 Re-segment your current video with better boundaries
3. 🔲 Ensure you're getting FULL transcripts (not snippets)
4. 🔲 Test with one video to validate segment quality
5. 🔲 Adjust min/max duration based on your content style

---

## Quick Reference

**For 20-40 minute educational videos:**
- ✅ Target: 5-12 minute segments
- ✅ Expected: 3-6 segments per video
- ✅ Each segment = ONE concept thoroughly taught
- ✅ Full transcript text (not summary)
- ✅ Natural topic transitions as boundaries
