# n8n Workflows for YouTube Knowledge Graph

This directory contains n8n workflows for automated YouTube video processing and knowledge graph ingestion.

## Migration from Make to n8n

These workflows have been migrated from Make (formerly Integromat) to n8n for better self-hosting capabilities and cost efficiency.

### What Changed

**From Make:**
- Proprietary cloud platform
- Limited to Make's infrastructure
- Cost per operation

**To n8n:**
- Self-hostable open-source platform
- Full control over infrastructure
- No per-operation costs

## Workflows

### 1. YouTube Link to Transcript (`1_youtube_link_to_transcript.json`)

**Purpose:** Monitors a Google Sheet for new YouTube URLs, extracts transcripts using Apify, and stores them in PostgreSQL.

**Trigger:** Polls Google Sheets every minute

**Flow:**
1. Watch Google Sheets for new URLs
2. Check if URL already exists in database
3. If new, run Apify transcript extraction actor
4. Wait for Apify to complete
5. Fetch transcript data from Apify dataset
6. Insert video and transcript into `youtube_videos` table

**Configuration Required:**
- Google Sheets OAuth credentials
- PostgreSQL connection (NeonDB)
- Apify API credentials
- Spreadsheet ID

### 2. YouTube Transcript to Content Segments (`2_youtube_transcript_to_segments.json`)

**Purpose:** Processes unprocessed videos, segments transcripts using Gemini AI, extracts concepts, and stores in the knowledge graph.

**Trigger:** Scheduled (daily at 2 AM)

**Flow:**
1. Query unprocessed videos from database (`segments_created = false`)
2. Use Gemini 2.5 Flash to segment transcript into topics
3. Process each segment with custom JavaScript
4. Loop through segments
5. For each segment, use Gemini to analyze and extract:
   - Primary concept
   - Supporting concepts
   - Key ideas
   - Examples
6. Clean JSON response
7. Insert segment into `content_segments` table
8. Mark video as processed

**Configuration Required:**
- Google Gemini API credentials (uses `GEMINI_MODEL` env variable)
- PostgreSQL connection

## Setup Instructions

### 1. Install n8n

**Option A: Docker (Recommended)**

Add to your `docker-compose.yml`:

```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=your_password
      - GEMINI_MODEL=gemini-2.5-flash
    volumes:
      - n8n_data:/home/node/.n8n
    restart: unless-stopped

volumes:
  n8n_data:
```

Start n8n:
```bash
docker-compose up -d n8n
```

**Option B: npm**
```bash
npm install -g n8n
n8n start
```

Access n8n at: `http://localhost:5678`

### 2. Configure Credentials

In n8n UI, add the following credentials:

#### Google Sheets OAuth2 API
1. Go to Credentials → Add Credential
2. Select "Google Sheets OAuth2 API"
3. Follow OAuth setup instructions
4. Authorize access to your Google account

#### PostgreSQL
1. Go to Credentials → Add Credential
2. Select "Postgres"
3. Enter your NeonDB connection details:
   - Host: `ep-purple-fire-ag5mwkps-pooler.c-2.eu-central-1.aws.neon.tech`
   - Port: `5432`
   - Database: `neondb`
   - User: `neondb_owner`
   - Password: (your password)
   - SSL: Enable

#### Apify API
1. Go to Credentials → Add Credential
2. Select "HTTP Header Auth"
3. Add header:
   - Name: `Authorization`
   - Value: `Bearer YOUR_APIFY_API_TOKEN`

#### Google Gemini API
1. Go to Credentials → Add Credential
2. Select "Google PaLM API" (used for Gemini)
3. Enter your Google API key from `.env` file

### 3. Import Workflows

1. In n8n UI, click "Add Workflow"
2. Click the three dots menu → "Import from File"
3. Select `1_youtube_link_to_transcript.json`
4. Repeat for `2_youtube_transcript_to_segments.json`

### 4. Update Configuration

For each workflow, update these values:

**Workflow 1:**
- Node "Watch Google Sheet URLs": Update `documentId` with your spreadsheet ID
- All nodes with credentials: Select your configured credentials

**Workflow 2:**
- All nodes with credentials: Select your configured credentials
- Gemini nodes: Will automatically use `GEMINI_MODEL` from environment

### 5. Test Workflows

**Test Workflow 1:**
1. Add a YouTube URL to your Google Sheet (column A with header "URL")
2. Click "Execute Workflow" in n8n
3. Check if video appears in `youtube_videos` table

**Test Workflow 2:**
1. Ensure at least one video exists with `segments_created = false`
2. Click "Execute Workflow" in n8n
3. Check if segments appear in `content_segments` table
4. Verify video is marked as processed

## Database Schema

Ensure these tables exist in your PostgreSQL database:

### youtube_videos
```sql
CREATE TABLE IF NOT EXISTS youtube_videos (
  id SERIAL PRIMARY KEY,
  channel_name TEXT,
  channel_subscription TEXT,
  video_title TEXT,
  url TEXT UNIQUE,
  views TEXT,
  video_post_date TEXT,
  transcript TEXT,
  segments_created BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### content_segments
```sql
CREATE TABLE IF NOT EXISTS content_segments (
  id SERIAL PRIMARY KEY,
  video_url TEXT,
  start_time TIME,
  end_time TIME,
  topic_hint TEXT,
  transcript TEXT,
  analysis_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Environment Variables

The workflows use these environment variables:

- `GEMINI_MODEL` - Gemini model name (default: `gemini-2.5-flash`)

Set in n8n Docker environment or in n8n Settings → Environment Variables.

## Monitoring

### Check Processing Status

```sql
-- Videos waiting to be processed
SELECT COUNT(*) FROM youtube_videos WHERE segments_created = false;

-- Total segments created
SELECT COUNT(*) FROM content_segments;

-- Recent errors (check n8n execution history)
```

### n8n Execution History

- Go to Executions tab in n8n
- Filter by workflow
- Check for failed executions
- View error details and logs

## Troubleshooting

### Workflow 1 Issues

**Problem:** "Apify actor timeout"
- Increase timeout in "Run Apify YouTube Transcript Actor" node
- Check Apify actor status at apify.com

**Problem:** "URL already exists"
- This is expected behavior (deduplication)
- Check PostgreSQL connection if all URLs are being skipped

### Workflow 2 Issues

**Problem:** "Invalid JSON from Gemini"
- Gemini sometimes returns markdown code blocks
- "Clean JSON Response" node should handle this
- Check Gemini API quota/limits

**Problem:** "No videos to process"
- Check if videos have `segments_created = false`
- Verify Workflow 1 completed successfully

**Problem:** "Gemini rate limiting"
- Add "Wait" nodes between Gemini calls
- Reduce batch size in "Get Unprocessed Videos" (currently 6)

## Cost Optimization

### Gemini API
- Using `gemini-2.5-flash` (from `.env`) is more cost-effective than `gemini-2.0-flash`
- Free tier: 60 requests/minute
- Monitor usage at Google AI Studio

### Apify
- Free tier: Limited actor runs per month
- Consider self-hosting transcript extraction
- Alternative: Use `youtube-transcript` npm package

### Schedule Optimization
- Workflow 1: Poll Google Sheets every 15 minutes instead of every minute
- Workflow 2: Run once daily during off-peak hours

## Next Steps

1. **Enable Automatic Embedding Generation:**
   - Segments inserted will automatically generate embeddings (see `lib/utils/ingest.ts`)
   - No additional workflow needed

2. **Add More Video Sources:**
   - Create additional workflow for YouTube channel monitoring
   - See `.workplans/WORK_PLAN_N8N_AUTOMATION.md` for channel monitor design

3. **Add Error Notifications:**
   - Add email/Slack nodes to workflows
   - Notify on persistent failures

4. **Implement Workspace Support:**
   - Add workspace header to API calls
   - Enable multi-tenant content isolation

## Migration Notes

### Differences from Make Workflows

1. **Custom JS Functions:**
   - Make used "Custom JS V2" module with stored functions
   - n8n uses inline Code nodes with full Node.js access

2. **Apify Integration:**
   - Make had native Apify nodes
   - n8n uses HTTP Request nodes with Apify API

3. **Gemini Integration:**
   - Make had native Gemini AI module
   - n8n uses LangChain Gemini nodes

4. **Data Flow:**
   - Make used "aggregator" modules
   - n8n uses "Split in Batches" with loop logic

### Features Not Yet Implemented

These features from the work plan are not in the current workflows but can be added:

- [ ] Channel monitoring (auto-discovery of new videos)
- [ ] Playlist processing
- [ ] Error handling with retry logic
- [ ] Status tracking table
- [ ] Rate limiting for API calls
- [ ] Batch processing optimization

See `.workplans/WORK_PLAN_N8N_AUTOMATION.md` for complete automation architecture.

## Support

For issues or questions:
1. Check n8n execution logs
2. Review PostgreSQL query logs
3. Verify API credentials and quotas
4. Consult `.workplans/WORK_PLAN_N8N_AUTOMATION.md` for architecture details
