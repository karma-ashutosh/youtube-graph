# YouTube Graph Project Context

## Project Overview
A knowledge graph system that ingests YouTube videos, extracts concepts and segments, and provides RAG-powered chat with conversation history.

## Tech Stack
- **Frontend**: Next.js 15, React, TailwindCSS
- **Backend**: Next.js API routes
- **Databases**:
  - Neo4j (knowledge graph, vector search)
  - PostgreSQL/Neon (conversation history)
- **AI/ML**:
  - Google Gemini 2.5 Flash (main chat)
  - Claude Haiku (query rewriting)
  - Embeddings for semantic search

## Key Features
1. **Video Ingestion**: Process YouTube videos → extract concepts & segments
2. **Knowledge Graph**: Neo4j graph with concepts, segments, videos
3. **Semantic Search**: Vector embeddings for concept/segment retrieval
4. **RAG Chat**: Q&A with knowledge graph context
5. **Conversation History**: Multi-turn conversations with context retention (✅ implemented)

## Project Structure
```
youtube-graph/
├── app/
│   ├── api/           # API routes
│   │   ├── chat/      # Chat with RAG
│   │   ├── conversations/  # Conversation management
│   │   ├── videos/    # Video endpoints
│   │   └── concepts/  # Concept endpoints
│   ├── chat/          # Chat UI
│   ├── videos/        # Video browsing
│   └── concepts/      # Concept browsing
├── lib/
│   ├── ai/            # AI logic (chat, embeddings)
│   ├── db/            # Database operations
│   ├── neo4j/         # Neo4j client & queries
│   └── rag/           # RAG components (query rewriting)
├── scripts/
│   └── migrations/    # Database migrations
└── .todos/            # Task tracking (markdown files)
```

## Active Tasks
See `.todos/` directory for detailed breakdowns:
- `.todos/01-discoverability-improvements/` - Homepage & navigation
- `.todos/02-chat-improvements/` - Chat enhancements
  - ✅ `01-conversation-history.md` - COMPLETED (2025-11-09)
  - ⚪ `02-shareable-chats.md` - Next up
  - ⚪ `03-loading-animation.md` - Future

## Development Workflow
1. Check `.todos/` for current tasks
2. When starting a task, update status to 🟡
3. When completing, update to ✅ and add completion summary
4. Run migrations: `npx tsx scripts/run-migration.ts <path>`
5. Test locally: `npm run dev`

## Environment Variables
Required in `.env.local`:
- `GOOGLE_API_KEY` - Gemini API (main chat)
- `ANTHROPIC_API_KEY` - Claude API (query rewriting)
- `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` - Neo4j connection
- `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` - PostgreSQL connection

## Code Conventions
- Use TypeScript strict mode
- API routes use `withWorkspace()` wrapper for multi-tenancy
- All database queries are workspace-scoped
- Use `debugLogger` for structured logging in AI operations

## Recent Changes
- **2025-11-09**: Implemented conversation history with PostgreSQL, query rewriting with Claude Haiku, and multi-turn context retention
