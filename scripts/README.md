# Scripts Documentation

## Generate Suggested Questions

### Overview
The `generate-suggested-questions.ts` script automatically generates workspace-specific suggested questions and summaries based on the concepts and segments in your knowledge graph.

### Usage

```bash
# Using npm
npm run generate:questions

# Using yarn
yarn generate:questions

# Using tsx directly
npx tsx scripts/generate-suggested-questions.ts
```

### What it does

1. **Analyzes your graph**: Fetches top concepts (by mentions) from each workspace
2. **Generates questions**: Creates 3 suggested questions per workspace using either:
   - AI-powered generation (Claude Sonnet) if `ANTHROPIC_API_KEY` is set
   - Rule-based templates as fallback
3. **Creates summary**: Generates a one-sentence summary of what the workspace covers
4. **Writes static file**: Outputs to `lib/data/suggested-questions.json`

### Output Format

```json
{
  "workspace_name": {
    "workspace": "workspace_name",
    "totalConcepts": 207,
    "totalSegments": 49,
    "topConcepts": [...],
    "topCategories": [...],
    "suggestedQuestions": [
      "How do I apply Email Nurture Sequence effectively?",
      "What are the key principles of Zero-Click Content Creation Tactics?",
      "How does SaaS Plateau Equation work in practice?"
    ],
    "summary": "Discover insights about Email Nurture Sequence and Zero-Click Content Creation Tactics and more"
  }
}
```

### When to run

- After ingesting new video segments
- When you want to refresh the homepage suggested questions
- When setting up a new workspace
- Periodically to keep questions relevant as content evolves

### Configuration

**Optional**: Set `ANTHROPIC_API_KEY` in your `.env` file for AI-powered question generation:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Without the API key, the script will use rule-based templates (still produces good results).

### How it works

The script:
1. Queries Neo4j for concepts with at least 1 mention
2. Orders by total mentions and primary segment associations
3. Takes top 15 concepts per workspace
4. Generates contextual questions based on concept names and categories
5. Saves to a JSON file that's imported by the chat page

### Integration

The chat page (`app/chat/page.tsx`) automatically loads the generated questions based on the current workspace stored in localStorage. Questions are displayed on the initial chat screen before any conversation starts.
