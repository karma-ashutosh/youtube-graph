# Task 1: Conversation History & RAG Context

**Status**: ⚪ Not Started
**Priority**: P0 (Critical)
**Estimated Time**: 1-2 days

## Goal
Maintain conversation history so follow-up questions retain context. Fix the issue where asking "how do I overcome this?" loses context from previous messages.

## Problem
Currently:
- Each question is sent independently to the API
- No conversation history is maintained
- RAG retrieval doesn't consider previous messages
- Follow-up questions fail without context

Example failure:
```
User: "Tell me about sleep optimization"
Assistant: [Provides info about sleep]
User: "How do I overcome this?"
Assistant: [Doesn't know what "this" refers to]
```

## Solution Architecture

### Database Schema
Store conversations in Postgres:

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  title TEXT, -- Auto-generated from first message
  last_message_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sources JSONB, -- Store RAG sources
  created_at TIMESTAMP DEFAULT NOW(),
  tokens_used INTEGER
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_conversations_workspace ON conversations(workspace, last_message_at DESC);
```

### Flow Changes

#### Current Flow:
```
User Question → API → RAG Search → LLM (single question) → Response
```

#### New Flow:
```
User Question →
  Load Conversation History →
  Rewrite Query with Context →
  RAG Search (with rewritten query) →
  LLM (with full conversation history) →
  Save to DB →
  Response
```

### Query Rewriting for RAG
Before doing RAG retrieval, rewrite the user's query to include context:

```typescript
async function rewriteQueryWithContext(
  currentQuery: string,
  conversationHistory: Message[]
): Promise<string> {
  if (conversationHistory.length === 0) {
    return currentQuery; // No context needed
  }

  // Use LLM to rewrite query with context
  const prompt = `
Given this conversation history:
${conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

The user now asks: "${currentQuery}"

Rewrite this as a standalone question that includes necessary context. Be concise.

Examples:
- "How do I overcome this?" → "How do I overcome sleep deprivation?"
- "What about pricing?" → "What pricing strategies work for SaaS products?"

Rewritten question:`;

  const rewritten = await callLLM(prompt);
  return rewritten.trim();
}
```

## Implementation Steps

### Step 1: Database Setup (30 mins)
**File**: `scripts/migrations/add-conversations.sql`

Create migration file with schema above.

**File**: `lib/db/conversations.ts`

```typescript
import { pool } from './neo4j'; // Or postgres client

export async function createConversation(workspace: string): Promise<string> {
  const result = await pool.query(
    'INSERT INTO conversations (workspace) VALUES ($1) RETURNING id',
    [workspace]
  );
  return result.rows[0].id;
}

export async function getConversation(conversationId: string) {
  const result = await pool.query(
    'SELECT * FROM conversations WHERE id = $1',
    [conversationId]
  );
  return result.rows[0];
}

export async function getMessages(conversationId: string) {
  const result = await pool.query(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );
  return result.rows;
}

export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  sources?: any
) {
  await pool.query(
    `INSERT INTO messages (conversation_id, role, content, sources)
     VALUES ($1, $2, $3, $4)`,
    [conversationId, role, content, sources ? JSON.stringify(sources) : null]
  );

  // Update conversation's last_message_at
  await pool.query(
    'UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1',
    [conversationId]
  );
}

export async function generateConversationTitle(conversationId: string) {
  const messages = await getMessages(conversationId);
  if (messages.length === 0) return;

  // Use first user message as base for title
  const firstMessage = messages.find(m => m.role === 'user');
  if (!firstMessage) return;

  // Generate short title (can use LLM or just truncate)
  const title = firstMessage.content.slice(0, 50) + (firstMessage.content.length > 50 ? '...' : '');

  await pool.query(
    'UPDATE conversations SET title = $1 WHERE id = $2',
    [title, conversationId]
  );
}
```

### Step 2: Update API Route (2-3 hours)
**File**: `app/api/chat/route.ts`

```typescript
import { rewriteQueryWithContext } from '@/lib/rag/query-rewriter';
import { createConversation, addMessage, getMessages } from '@/lib/db/conversations';

export async function POST(req: Request) {
  const { question, conversationId } = await req.json();
  const workspace = req.headers.get('X-Workspace') || 'default';

  // Get or create conversation
  let convId = conversationId;
  let conversationHistory: Message[] = [];

  if (!convId) {
    convId = await createConversation(workspace);
  } else {
    conversationHistory = await getMessages(convId);
  }

  // Save user message
  await addMessage(convId, 'user', question);

  // Rewrite query with context if needed
  const searchQuery = await rewriteQueryWithContext(question, conversationHistory);

  // Do RAG search with rewritten query
  const ragResults = await performRAGSearch(searchQuery, workspace);

  // Build full context for LLM
  const conversationContext = conversationHistory.map(m => ({
    role: m.role,
    content: m.content
  }));

  // Add current user message
  conversationContext.push({
    role: 'user',
    content: question
  });

  // Call LLM with full history + RAG context
  const answer = await generateAnswer(conversationContext, ragResults);

  // Save assistant message
  await addMessage(convId, 'assistant', answer, {
    concepts: ragResults.concepts,
    segments: ragResults.segments
  });

  // Generate title after first exchange
  if (conversationHistory.length === 0) {
    await generateConversationTitle(convId);
  }

  return Response.json({
    answer,
    conversationId: convId,
    sources: {
      concepts: ragResults.concepts,
      segments: ragResults.segments
    }
  });
}
```

### Step 3: Update Frontend (2-3 hours)
**File**: `app/chat/page.tsx`

```typescript
export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Load conversation from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get('conversation');

    if (convId) {
      loadConversation(convId);
    }
  }, []);

  const loadConversation = async (convId: string) => {
    try {
      const data = await apiGet(`/api/conversations/${convId}`);
      setConversationId(convId);
      setMessages(data.messages);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const data = await apiPost('/api/chat', {
        question: input,
        conversationId // Pass conversation ID
      });

      // Update conversation ID if new
      if (!conversationId) {
        setConversationId(data.conversationId);
        // Update URL without reload
        window.history.pushState(
          {},
          '',
          `/chat?conversation=${data.conversationId}`
        );
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      // Handle error...
    } finally {
      setLoading(false);
    }
  };

  // New conversation button
  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    window.history.pushState({}, '', '/chat');
  };

  return (
    <div>
      {/* New Conversation Button */}
      {conversationId && (
        <button onClick={startNewConversation} className="btn-secondary">
          + New Conversation
        </button>
      )}

      {/* Rest of chat UI */}
    </div>
  );
}
```

### Step 4: Create Query Rewriter (1 hour)
**File**: `lib/rag/query-rewriter.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function rewriteQueryWithContext(
  currentQuery: string,
  conversationHistory: Message[]
): Promise<string> {
  // No rewriting needed for first message
  if (conversationHistory.length === 0) {
    return currentQuery;
  }

  // Take last 3 messages for context (don't overwhelm)
  const recentHistory = conversationHistory.slice(-3);

  const prompt = `Given this conversation history:

${recentHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')}

The user now asks: "${currentQuery}"

Rewrite this as a standalone, self-contained question that includes necessary context from the conversation. Keep it concise and focused on the user's intent.

If the question is already standalone, return it unchanged.

Examples:
- "How do I overcome this?" → "How do I overcome sleep deprivation?"
- "What about pricing?" → "What pricing strategies work for SaaS products?"
- "Tell me more" → "Tell me more about product-market fit"

Return ONLY the rewritten question, nothing else.`;

  const message = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307', // Fast and cheap for rewriting
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  const rewritten = message.content[0].type === 'text'
    ? message.content[0].text.trim()
    : currentQuery;

  console.log(`Query rewrite: "${currentQuery}" → "${rewritten}"`);

  return rewritten;
}
```

### Step 5: Add Conversation List API (1 hour)
**File**: `app/api/conversations/route.ts`

```typescript
import { getConversationsForWorkspace } from '@/lib/db/conversations';

export async function GET(req: Request) {
  const workspace = req.headers.get('X-Workspace') || 'default';

  const conversations = await getConversationsForWorkspace(workspace);

  return Response.json({ conversations });
}
```

**File**: `app/api/conversations/[id]/route.ts`

```typescript
import { getConversation, getMessages } from '@/lib/db/conversations';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const conversation = await getConversation(params.id);
  const messages = await getMessages(params.id);

  if (!conversation) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({
    conversation,
    messages
  });
}
```

## Testing Strategy

### Test Cases
1. **Basic Context Retention**
   - Ask: "What is sleep optimization?"
   - Follow up: "How do I implement this?" (should understand "this" = sleep optimization)

2. **Multi-Turn Context**
   - Ask: "Tell me about product-market fit"
   - Ask: "What are some examples?"
   - Ask: "How do I measure it?" (should understand "it" = PMF)

3. **New Conversation**
   - Click "New Conversation"
   - Verify old context doesn't leak

4. **Load Existing Conversation**
   - Share conversation URL
   - Verify all messages load correctly

## Acceptance Criteria
- [ ] Conversations stored in database
- [ ] Each message linked to conversation
- [ ] Follow-up questions maintain context
- [ ] Query rewriting works for ambiguous questions
- [ ] Conversation history passed to LLM
- [ ] Conversation ID in URL
- [ ] Can load existing conversation from URL
- [ ] "New Conversation" button works
- [ ] Title auto-generated from first message
- [ ] RAG search uses rewritten query

## Dependencies
- Postgres database (or use existing if available)
- Anthropic API for query rewriting
- Existing chat API

## Performance Considerations
- Limit conversation history to last 10 messages for LLM (avoid token limits)
- Use Haiku for query rewriting (fast + cheap)
- Index database properly for fast message retrieval
- Consider caching frequent rewrites

## Privacy & Security
- Conversations are workspace-scoped
- No authentication yet (add later)
- Consider adding conversation deletion
- Add expiration for old conversations (optional)

## Future Enhancements
- Conversation search
- Export conversation as PDF/Markdown
- Regenerate response
- Edit previous message
- Branch conversations
- Conversation folders/tags
