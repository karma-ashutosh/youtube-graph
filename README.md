# YouTube Knowledge Graph

A Next.js application that processes video transcript segments and creates a queryable Neo4j knowledge graph. The system normalizes concepts using AI to avoid duplicates, tracks relationships, and provides an interactive visual interface to explore the knowledge graph.

## Features

- **Data Ingestion Pipeline**: Upload video transcript segments with AI-analyzed concepts
- **AI-Powered Concept Normalization**: Uses Claude or Gemini to intelligently merge similar concepts and avoid duplicates
- **Neo4j Knowledge Graph**: Stores and queries complex relationships between videos, segments, concepts, examples, and key ideas
- **Interactive Graph Visualization**: Explore concept relationships in a force-directed graph
- **Concept Explorer**: Browse, search, and filter all concepts with detailed information
- **Query Interface**: Execute Cypher queries against the knowledge graph

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **Database**: Neo4j (Aura cloud or local Docker)
- **API**: Next.js API routes
- **Data Validation**: Zod
- **Neo4j Client**: neo4j-driver
- **LLM Integration**: Anthropic Claude or Google Gemini (configurable via env, for concept normalization)
- **Visualization**: react-force-graph-2d

## Prerequisites

- Node.js 18+ and npm
- Neo4j database (either Neo4j Aura free tier or local Docker instance)
- AI API key: Either Anthropic Claude API key OR Google Gemini API key (for concept normalization)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd youtube-graph
npm install
```

### 2. Set Up Neo4j

#### Option A: Neo4j Aura (Cloud - Recommended for quick start)

1. Sign up at https://neo4j.com/cloud/aura/
2. Create a free instance
3. Save the connection URI, username, and password

#### Option B: Local Docker

```bash
docker run \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest
```

Access Neo4j Browser at http://localhost:7474

### 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password

# For Neo4j Aura (cloud):
# NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
# NEO4J_USER=neo4j
# NEO4J_PASSWORD=xxxxx

# AI Provider Configuration
# Choose "claude" or "gemini"
AI_PROVIDER=gemini

# Anthropic Claude API Key (if using AI_PROVIDER=claude)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Google Gemini API Key (if using AI_PROVIDER=gemini)
GOOGLE_API_KEY=xxxxx
```

### 4. Initialize Database Schema

Run the database migration script to create constraints and indexes:

```bash
npm run db:migrate
```

This will create:
- **Uniqueness constraints** on `concept_id`, `segment_id`, `video_id` (prevents duplicates)
- **Performance indexes** on `category`, `total_mentions`, `canonical_name`, `video_id`

These indexes are essential for query performance. The migration is idempotent and can be run multiple times safely.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### 1. Upload Segment Data

Navigate to the **Upload** page and either:
- Upload a JSON file with segment data
- Paste JSON data directly into the text area

A sample data file (`sample-segments.json`) is provided in the project root for testing.

### 2. Browse Concepts

Go to the **Concepts** page to:
- View all concepts in the knowledge graph
- Search by name or aliases
- Sort by mentions, recency, or alphabetically
- Click on any concept to view detailed information

### 3. Explore the Graph

Visit the **Graph** page to:
- Visualize the knowledge graph with an interactive force-directed layout
- Filter by minimum mentions or category
- Click on nodes to navigate to concept details
- See relationships between concepts, segments, and videos

### 4. Query the Database

Use the **Query** page to:
- View sample Cypher queries
- Learn basic Cypher syntax
- (In production: execute custom queries)

## Data Models

### Input Format

Segments should be provided as JSON with the following structure:

```json
[
  {
    "id": null,
    "video_url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "start_time": "00:03:54",
    "end_time": "00:04:42",
    "topic_hint": "Marketing tactics selection",
    "analysis_json": "{...}",
    "created_at": null,
    "updated_at": null
  }
]
```

The `analysis_json` field contains the AI analysis of the segment with the following structure:

```json
{
  "primary_concept": {
    "name": "Marketing Tactics",
    "coverage_depth": "comprehensive",
    "explanation_type": "how_to"
  },
  "supporting_concepts": [...],
  "mentioned_concepts": [...],
  "key_ideas": [...],
  "examples": [...]
}
```

See `sample-segments.json` for complete examples.

### Neo4j Schema

**Node Types:**
- `Video`: Represents a YouTube video
- `Segment`: A time-bounded section of a video
- `Concept`: A normalized concept (e.g., "Product-Market Fit")
- `Example`: An example or case study illustrating a concept
- `KeyIdea`: A key insight or takeaway from a segment

**Relationships:**
- `(Segment)-[:FROM_VIDEO]->(Video)`
- `(Segment)-[:DISCUSSES {role}]->(Concept)`
- `(Example)-[:ILLUSTRATES]->(Concept)`
- `(Example)-[:MENTIONED_IN]->(Segment)`
- `(KeyIdea)-[:ABOUT]->(Concept)`
- `(KeyIdea)-[:EXTRACTED_FROM]->(Segment)`

## Key Features Explained

### AI Provider Configuration

The system supports two AI providers for concept normalization, controlled via the `AI_PROVIDER` environment variable:

**Gemini (Google)** - Default, recommended for cost-effectiveness
- Set `AI_PROVIDER=gemini`
- Uses `gemini-1.5-flash` model
- Free tier available with generous limits
- Get your API key at: https://ai.google.dev/

**Claude (Anthropic)** - Alternative option
- Set `AI_PROVIDER=claude`
- Uses `claude-3-5-haiku-20241022` model (fast and efficient)
- Get your API key at: https://console.anthropic.com/

### Concept Normalization

The AI provider intelligently normalizes concept names to:

- Match variations (e.g., "PMF" → "Product-Market Fit")
- Avoid creating duplicate concepts for similar terms
- Maintain aliases for all variations
- Update statistics (mentions, timestamps) automatically

### Ingestion Pipeline

For each uploaded segment:

1. Parse and validate the data
2. Extract video ID from URL
3. Create or retrieve the Video node
4. Create a Segment node
5. Normalize the primary concept using AI
6. Process supporting and mentioned concepts
7. Create Example and KeyIdea nodes
8. Link everything with appropriate relationships
9. Update concept statistics

### Caching Strategy

- Concept list is cached during batch processing
- Cache refreshes every 10 segments to balance performance and freshness
- For production, consider using Redis for distributed caching

## API Endpoints

- `POST /api/segments/ingest` - Ingest batch of segments
- `GET /api/concepts` - Get all concepts
- `GET /api/concepts/[id]` - Get concept details
- `GET /api/graph` - Get graph data for visualization (with filters)

## Development Notes

### Project Structure

```
/app
  /upload          # Upload interface
  /graph           # Graph visualization
  /concepts        # Concepts list and detail pages
  /query           # Query interface
  /api             # API routes
/lib
  /neo4j           # Neo4j client and queries
  /ai              # LLM-based concept normalization
  /utils           # Parsers, validators, ingestion logic
  /types           # TypeScript interfaces
/components        # React components (for future expansion)
```

### Error Handling

- All API endpoints include proper error handling and validation
- Zod schemas validate input data
- Failed segments are reported with detailed error messages
- Batch processing continues even if individual segments fail

### Performance Considerations

- Batch processing limits parallel LLM calls to avoid rate limits
- Neo4j queries use indexes for optimal performance
- Graph visualization limits nodes by default
- Consider pagination for large datasets

## Future Enhancements

Potential improvements for production use:

1. **Relationship Detection**: Analyze which concepts appear together frequently
2. **Importance Scoring**: Auto-calculate based on mentions, recency, and relationships
3. **Full-Text Search**: Index all content for advanced searching
4. **Video Player Integration**: Embed YouTube player with timestamp navigation
5. **Analytics Dashboard**: Statistics and insights about the knowledge graph
6. **Export Functionality**: Generate reports or export data
7. **User Authentication**: Multi-user support with permissions
8. **Query API**: Safe Cypher query execution with validation
9. **Real-time Updates**: WebSocket integration for live graph updates
10. **Model Selection**: Allow users to choose specific models (e.g., Claude Opus, Gemini Pro)

## Troubleshooting

### Connection Issues

If you can't connect to Neo4j:
- Verify your credentials in `.env.local`
- Check that Neo4j is running (Docker or Aura)
- Try the connection test in Neo4j Browser

### Import Errors

If segments fail to import:
- Check the JSON format matches the expected schema
- Verify `analysis_json` is valid JSON (escaped properly)
- Check the error messages returned by the API

### Graph Visualization Issues

If the graph doesn't render:
- Check browser console for errors
- Ensure you have concepts in the database
- Try reducing the `minMentions` filter

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For questions or issues, please check the Neo4j and Next.js documentation or open an issue in this repository.
