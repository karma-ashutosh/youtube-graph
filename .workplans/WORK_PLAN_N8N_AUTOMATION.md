# Work Plan: n8n Automation for YouTube Transcript Crawling

## Problem
Currently, ingesting YouTube video content requires manual work:
- Manually downloading transcripts
- Manually formatting data
- Manually calling the ingestion API
- No automated discovery of new videos
- Time-consuming batch processing

## Goal
Build automated n8n workflows to:
1. Discover new YouTube videos from channels/playlists
2. Extract transcripts automatically
3. Process and format data
4. Ingest into the knowledge graph via API
5. Schedule regular crawls
6. Handle errors and retries gracefully

**Benefit:** With auto-embeddings now working, new videos will be immediately searchable without any manual intervention.

---

## Architecture Overview

```
YouTube API → n8n Workflows → API Ingestion Endpoint → Neo4j + Embeddings
```

### Workflow Components
1. **Video Discovery** - Find new videos from sources
2. **Transcript Extraction** - Get transcript data
3. **Data Transformation** - Format for ingestion API
4. **Ingestion** - POST to `/api/segments/ingest`
5. **Status Tracking** - Track processed videos (avoid duplicates)
6. **Error Handling** - Retry logic and notifications

---

## Prerequisites

### 1. n8n Setup
**Installation Options:**

**Option A: Docker (Recommended)**
```yaml
# docker-compose.yml (add to existing)
services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=password
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://localhost:5678/
    volumes:
      - n8n_data:/home/node/.n8n
    restart: unless-stopped

volumes:
  n8n_data:
```

**Option B: npm**
```bash
npm install -g n8n
n8n start
```

### 2. YouTube API Setup
- Create Google Cloud Project
- Enable YouTube Data API v3
- Create API credentials (API Key or OAuth 2.0)
- Note: YouTube API has quota limits (10,000 units/day by default)

### 3. Required API Keys
```bash
# Add to .env.local
YOUTUBE_API_KEY=your_youtube_api_key_here
N8N_WEBHOOK_URL=http://localhost:5678
```

---

## Workflow Designs

### Workflow 1: Channel Monitor (New Video Discovery)

**Trigger:** Cron (runs every 6 hours)
**Purpose:** Find new videos from specific YouTube channels

```
┌─────────────┐
│ Cron Trigger│ (Every 6 hours)
└──────┬──────┘
       │
       v
┌─────────────────┐
│ HTTP Request    │ → YouTube API: Get channel uploads
│ (YouTube API)   │   /youtube/v3/search?channelId=...
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Code Node       │ → Filter videos, extract IDs
│ (Filter Logic)  │   Remove already-processed videos
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Postgres/SQLite │ → Check if video already processed
│ (Dedup Check)   │   SELECT * FROM processed_videos WHERE video_id = ?
└──────┬──────────┘
       │
       v (New videos only)
┌─────────────────┐
│ Split In Batches│ → Process one video at a time
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Trigger         │ → Workflow 2: Process Single Video
│ (Call Workflow) │
└─────────────────┘
```

**Implementation Details:**

**Node 1: Cron Trigger**
- Expression: `0 */6 * * *` (every 6 hours)
- Or use "Schedule Trigger" node

**Node 2: HTTP Request - Get Channel Videos**
```javascript
// URL
https://www.googleapis.com/youtube/v3/search

// Query Parameters
{
  "part": "snippet",
  "channelId": "{{$parameter['channelId']}}",
  "order": "date",
  "maxResults": 10,
  "type": "video",
  "key": "{{$credentials.youtubeApiKey}}"
}
```

**Node 3: Code Node - Extract Video IDs**
```javascript
const items = $input.all();
const videos = [];

for (const item of items) {
  const data = item.json;

  if (data.items) {
    for (const video of data.items) {
      videos.push({
        video_id: video.id.videoId,
        title: video.snippet.title,
        published_at: video.snippet.publishedAt,
        channel_id: video.snippet.channelId,
        channel_title: video.snippet.channelTitle
      });
    }
  }
}

return videos.map(v => ({ json: v }));
```

**Node 4: Postgres/SQLite - Deduplication**
```sql
-- Create table (one-time setup)
CREATE TABLE IF NOT EXISTS processed_videos (
  video_id VARCHAR(255) PRIMARY KEY,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50),
  workspace VARCHAR(100)
);

-- Query in n8n
SELECT video_id FROM processed_videos
WHERE video_id = $json["video_id"]
  AND workspace = $json["workspace"];
```

**Node 5: Filter Node**
- Continue if: `{{$json["video_id"]}} is empty` (not in database)

---

### Workflow 2: Process Single Video (Transcript Extraction + Ingestion)

**Trigger:** Called by Workflow 1 or manual execution
**Purpose:** Extract transcript and ingest a single video

```
┌─────────────────┐
│ Webhook/Trigger │ → Receives video_id, workspace
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ HTTP Request    │ → Get video details
│ (YouTube API)   │   /youtube/v3/videos?id=...
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ HTTP Request    │ → Get transcript (youtube-transcript-api)
│ (Transcript API)│   Or use youtube-transcript npm package
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Code Node       │ → Segment transcript (by time/topic)
│ (Segmentation)  │   Create segments (e.g., 5-minute chunks)
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Loop Over       │ → Process each segment
│ Segments        │
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ HTTP Request    │ → OpenAI/Gemini: Analyze segment
│ (AI Analysis)   │   Extract concepts, examples, key ideas
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Code Node       │ → Format for ingestion API
│ (Format Data)   │   Match SegmentData interface
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ HTTP Request    │ → POST /api/segments/ingest
│ (Ingest API)    │   With workspace header
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Postgres        │ → Mark video as processed
│ (Track Status)  │   INSERT INTO processed_videos ...
└──────┬──────────┘
       │
       v (on error)
┌─────────────────┐
│ Error Workflow  │ → Log error, send notification
│ (Error Handler) │
└─────────────────┘
```

**Implementation Details:**

**Node 1: Get Video Details**
```javascript
// URL
https://www.googleapis.com/youtube/v3/videos

// Parameters
{
  "part": "snippet,contentDetails",
  "id": "{{$json['video_id']}}",
  "key": "{{$credentials.youtubeApiKey}}"
}
```

**Node 2: Get Transcript**

**Option A: Use youtube-transcript-api (Python)**
```python
# Need to run external Python script or API
from youtube_transcript_api import YouTubeTranscriptApi

transcript = YouTubeTranscriptApi.get_transcript(video_id)
```

**Option B: Use npm package in Code Node**
```javascript
// Install in n8n: npm install youtube-transcript
const { YoutubeTranscript } = require('youtube-transcript');

const videoId = $json['video_id'];
const transcript = await YoutubeTranscript.fetchTranscript(videoId);

return [{ json: { video_id: videoId, transcript } }];
```

**Option C: Use external transcript service**
```javascript
// Call your own transcript extraction service
// POST to transcript-extractor API
```

**Node 3: Segment Transcript**
```javascript
const { video_id, transcript } = $json;

// Segment by time (e.g., 5-minute chunks)
const SEGMENT_DURATION = 300; // 5 minutes in seconds
const segments = [];
let currentSegment = [];
let segmentStart = 0;

for (let i = 0; i < transcript.length; i++) {
  const entry = transcript[i];
  currentSegment.push(entry);

  // Check if we've reached segment duration
  const duration = entry.offset - segmentStart;
  if (duration >= SEGMENT_DURATION || i === transcript.length - 1) {
    // Create segment
    segments.push({
      video_id,
      start_time: formatTime(segmentStart),
      end_time: formatTime(entry.offset + entry.duration),
      transcript: currentSegment.map(e => e.text).join(' '),
      duration: duration
    });

    // Reset for next segment
    currentSegment = [];
    segmentStart = entry.offset;
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

return segments.map(s => ({ json: s }));
```

**Node 4: AI Analysis (OpenAI/Gemini)**
```javascript
// HTTP Request to OpenAI
// POST https://api.openai.com/v1/chat/completions

{
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "You are an expert at analyzing video transcripts. Extract key concepts, examples, and ideas in JSON format."
    },
    {
      "role": "user",
      "content": `Analyze this video segment:\n\nTranscript: ${$json.transcript}\n\nProvide JSON with:\n- primary_concept: {name, coverage_depth, explanation_type}\n- supporting_concepts: [{name, coverage_depth}]\n- mentioned_concepts: [{name}]\n- examples: [{concept_illustrated, example_text, type}]\n- key_ideas: [{idea, type, is_novel, confidence}]`
    }
  ],
  "response_format": { "type": "json_object" }
}
```

**Node 5: Format for Ingestion**
```javascript
const segment = $json;
const analysis = $node["AI Analysis"].json; // Get AI analysis result

// Format according to SegmentData interface
const formatted = {
  id: `${segment.video_id}_${segment.start_time.replace(/:/g, '_')}`,
  video_url: `https://www.youtube.com/watch?v=${segment.video_id}`,
  start_time: segment.start_time,
  end_time: segment.end_time,
  duration: segment.duration,
  topic_hint: analysis.primary_concept?.name || "General Topic",
  transcript: segment.transcript,
  analysis: {
    primary_concept: analysis.primary_concept,
    supporting_concepts: analysis.supporting_concepts || [],
    mentioned_concepts: analysis.mentioned_concepts || [],
    examples: analysis.examples || [],
    key_ideas: analysis.key_ideas || []
  }
};

return [{ json: formatted }];
```

**Node 6: Ingest API Call**
```javascript
// HTTP Request
// POST http://localhost:3000/api/segments/ingest

// Headers
{
  "Content-Type": "application/json",
  "X-Workspace": "{{$json['workspace'] || 'default'}}"
}

// Body
{{$json}}
```

**Node 7: Track Status**
```sql
INSERT INTO processed_videos (video_id, status, workspace)
VALUES ($json["video_id"], 'completed', $json["workspace"])
ON CONFLICT (video_id)
DO UPDATE SET status = 'completed', processed_at = CURRENT_TIMESTAMP;
```

---

### Workflow 3: Playlist Processor

**Trigger:** Manual or scheduled
**Purpose:** Process all videos from a YouTube playlist

```
┌─────────────────┐
│ Manual Trigger  │ → Input: playlist_id, workspace
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ HTTP Request    │ → Get playlist items
│ (YouTube API)   │   /youtube/v3/playlistItems
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Code Node       │ → Extract all video IDs
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Split In Batches│ → Process N videos at a time
│ (Rate Limiting) │   E.g., 5 videos per batch
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Execute Workflow│ → Call Workflow 2 for each video
│ (Process Video) │   With 2-second delay between calls
└─────────────────┘
```

**Implementation:**

**Node 1: Get Playlist Items**
```javascript
// Recursive function to get all playlist items (max 50 per page)
let allVideos = [];
let nextPageToken = null;

do {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?` +
    `part=snippet&maxResults=50&playlistId=${playlistId}` +
    `&pageToken=${nextPageToken || ''}&key=${apiKey}`
  );

  const data = await response.json();
  allVideos = allVideos.concat(data.items);
  nextPageToken = data.nextPageToken;
} while (nextPageToken);

return allVideos.map(item => ({
  json: {
    video_id: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    position: item.snippet.position
  }
}));
```

**Node 2: Split In Batches**
- Batch Size: 5
- To avoid rate limits and API quota exhaustion

---

### Workflow 4: Error Handler & Retry Logic

**Purpose:** Handle failed video processing with retry

```
┌─────────────────┐
│ Error Trigger   │ → Catches errors from other workflows
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Code Node       │ → Check retry count
│ (Retry Logic)   │   Max 3 retries
└──────┬──────────┘
       │
       ├─> Retry < 3
       │   ┌─────────────────┐
       │   │ Wait Node       │ → Wait 5 minutes
       │   └──────┬──────────┘
       │          v
       │   ┌─────────────────┐
       │   │ Execute Workflow│ → Retry processing
       │   └─────────────────┘
       │
       └─> Retry >= 3
           ┌─────────────────┐
           │ Postgres        │ → Mark as failed
           └──────┬──────────┘
                  v
           ┌─────────────────┐
           │ Email/Slack     │ → Notify admin
           └─────────────────┘
```

---

## Database Schema (For Tracking)

**Table: processed_videos**
```sql
CREATE TABLE processed_videos (
  video_id VARCHAR(255) PRIMARY KEY,
  video_title TEXT,
  channel_id VARCHAR(255),
  workspace VARCHAR(100),
  status VARCHAR(50), -- 'pending', 'processing', 'completed', 'failed'
  segments_count INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workspace ON processed_videos(workspace);
CREATE INDEX idx_status ON processed_videos(status);
```

**Table: processing_queue**
```sql
CREATE TABLE processing_queue (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(255) NOT NULL,
  workspace VARCHAR(100),
  priority INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  scheduled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_queue_status ON processing_queue(status, scheduled_at);
```

---

## Configuration Management

**File:** `n8n-config.json` (Store in n8n or external config)
```json
{
  "channels": [
    {
      "channel_id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      "name": "Google Developers",
      "workspace": "shopify",
      "enabled": true
    },
    {
      "channel_id": "UCsBjURrPoezykLs9EqgamOA",
      "name": "Fireship",
      "workspace": "default",
      "enabled": true
    }
  ],
  "playlists": [
    {
      "playlist_id": "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
      "name": "Web Development",
      "workspace": "shopify",
      "enabled": true
    }
  ],
  "settings": {
    "segment_duration": 300,
    "max_segments_per_video": 20,
    "ai_model": "gpt-4",
    "rate_limit_delay": 2000,
    "retry_attempts": 3
  }
}
```

---

## API Rate Limits & Quotas

### YouTube API Quotas
- **Default:** 10,000 units/day
- **search.list:** 100 units per request
- **videos.list:** 1 unit per request
- **playlistItems.list:** 1 unit per request

**Budget Example:**
- 50 channel searches/day = 5,000 units
- 50 video details = 50 units
- **Remaining:** 4,950 units for other operations

**Optimization:**
- Cache channel upload playlist IDs
- Use `playlistItems.list` instead of `search.list` when possible
- Batch video detail requests (max 50 video IDs per request)

### OpenAI/Gemini API
- Set reasonable rate limits in n8n (e.g., 10 requests/minute)
- Use retry with exponential backoff
- Monitor costs (GPT-4 is expensive for high volume)

---

## Deployment Checklist

### Phase 1: Setup (1-2 hours)
- [ ] Install and configure n8n (Docker or npm)
- [ ] Set up YouTube API credentials
- [ ] Set up Postgres/SQLite for tracking
- [ ] Create `processed_videos` table
- [ ] Test YouTube API connection
- [ ] Test ingestion API endpoint

### Phase 2: Build Workflows (4-6 hours)
- [ ] Create Workflow 1: Channel Monitor
- [ ] Create Workflow 2: Process Single Video
- [ ] Create Workflow 3: Playlist Processor
- [ ] Create Workflow 4: Error Handler
- [ ] Test each workflow individually
- [ ] Test end-to-end with sample video

### Phase 3: Integration (2-3 hours)
- [ ] Connect workflows together
- [ ] Set up cron schedules
- [ ] Configure workspace mapping
- [ ] Set up deduplication logic
- [ ] Test with multiple workspaces
- [ ] Verify embeddings are generated

### Phase 4: Monitoring (1-2 hours)
- [ ] Set up error notifications (email/Slack)
- [ ] Create workflow status dashboard
- [ ] Set up logging
- [ ] Monitor API quota usage
- [ ] Create manual retry workflow

### Phase 5: Production (1-2 hours)
- [ ] Add production channels/playlists
- [ ] Set production cron schedules
- [ ] Document workflow usage
- [ ] Create runbook for common issues
- [ ] Test failover scenarios

---

## Alternative: Simplified Approach

If n8n is too complex, consider a simpler approach:

**Option B: Node.js Script**
```typescript
// scripts/youtube-crawler.ts
import { ingestSegment } from '../lib/utils/ingest';
import { YoutubeTranscript } from 'youtube-transcript';

async function crawlChannel(channelId: string, workspace: string) {
  // 1. Get videos from channel
  // 2. For each video: get transcript
  // 3. Segment transcript
  // 4. Call AI for analysis
  // 5. Call ingestSegment()
}

// Run with cron
```

**Pros:** Simpler, more control, easier debugging
**Cons:** No visual workflow editor, need to handle scheduling separately

---

## Monitoring & Observability

### Metrics to Track
- Videos processed per day
- Average processing time per video
- API quota usage
- Error rate
- Segments created per video
- Embeddings generated

### Alerts
- API quota near limit (>80%)
- Multiple consecutive failures
- Processing queue backlog
- Workspace ingestion stopped

### Dashboard (Optional)
- Build simple Next.js page showing:
  - Processing status
  - Recent videos
  - Error log
  - Queue depth

---

## Cost Estimation

### YouTube API
- Free tier: 10,000 units/day
- Covers ~50-100 videos/day
- Additional quota: Request from Google or paid plan

### OpenAI API (for analysis)
- GPT-4: ~$0.03 per 1K tokens
- Average segment: ~500 tokens input + 200 output = $0.021
- 100 segments/day = ~$2/day = $60/month

### Gemini API (alternative)
- Free tier: 60 requests/minute
- Cheaper than GPT-4 for high volume

### Infrastructure
- n8n: Free (self-hosted)
- Postgres/SQLite: Free
- Server: ~$5-10/month (DigitalOcean Droplet)

**Total:** $65-75/month for 100 videos/day

---

## Next Steps

1. **Choose approach:** n8n workflows vs. Node.js scripts
2. **Set up infrastructure:** n8n + database
3. **Get API keys:** YouTube + OpenAI/Gemini
4. **Build first workflow:** Start with single video processing
5. **Test with real data:** Process 1-2 videos end-to-end
6. **Scale up:** Add channel monitoring and automation
7. **Monitor and optimize:** Track costs and performance

---

## Related Files
- `app/api/segments/ingest/route.ts` - Ingestion endpoint
- `lib/utils/ingest.ts` - Ingestion logic (with auto-embeddings!)
- `WORK_PLAN_AUTO_EMBEDDINGS.md` - Embedding generation (completed)
- `WORK_PLAN_SANDBOXING.md` - Workspace isolation (for multi-domain content)
