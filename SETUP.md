# Quick Setup Guide

## 1. Start Neo4j with Docker

```bash
# Start Neo4j
docker-compose up -d

# Check if it's running
docker-compose ps
```

That's it! Neo4j is now running with:
- **Username**: `neo4j`
- **Password**: `password123`
- **Browser UI**: http://localhost:7474
- **Bolt Connection**: bolt://localhost:7687

## 2. Configure AI Provider

Edit `.env.local` and add your API key:

### Option A: Use Gemini (Free)
```env
AI_PROVIDER=gemini
GOOGLE_API_KEY=your_key_here
```
Get your key at: https://ai.google.dev/

### Option B: Use Claude
```env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=your_key_here
```
Get your key at: https://console.anthropic.com/

## 3. Start the Application

```bash
npm run dev
```

Open http://localhost:3000

## 4. Test with Sample Data

1. Go to http://localhost:3000/upload
2. Click "Choose File" and select `sample-segments.json`
3. Click "Ingest Segments"
4. Wait for processing to complete
5. Go to http://localhost:3000/concepts to see the results!

## Useful Docker Commands

```bash
# Stop Neo4j
docker-compose down

# Stop and remove all data (fresh start)
docker-compose down -v

# View Neo4j logs
docker-compose logs -f neo4j

# Restart Neo4j
docker-compose restart

# Access Neo4j Browser
# Open: http://localhost:7474
# Login with: neo4j / password123
```

## Verify Neo4j Connection

You can test the connection in Neo4j Browser (http://localhost:7474):

```cypher
// Check if database is working
RETURN "Hello, Neo4j!" as message

// After ingesting data, check concepts
MATCH (c:Concept)
RETURN c.canonical_name, c.total_mentions
ORDER BY c.total_mentions DESC
LIMIT 10
```

## Troubleshooting

### Port Already in Use
If ports 7474 or 7687 are already in use:
```bash
# Find what's using the port
lsof -i :7474
lsof -i :7687

# Stop the conflicting service or change ports in docker-compose.yml
```

### Neo4j Won't Start
```bash
# Check logs
docker-compose logs neo4j

# Try removing volumes and starting fresh
docker-compose down -v
docker-compose up -d
```

### Cannot Connect from App
- Make sure Neo4j is running: `docker-compose ps`
- Verify credentials in `.env.local` match docker-compose.yml
- Check Neo4j is accepting connections at bolt://localhost:7687

## Data Persistence

Your Neo4j data is stored in Docker volumes and will persist even if you stop the container. To completely reset:

```bash
docker-compose down -v
```

This removes all volumes (data will be lost).
