# Task 2: Shareable Chat URLs

**Status**: ⚪ Not Started
**Priority**: P0 (Critical)
**Estimated Time**: 4-6 hours

## Goal
Allow users to share chat conversations via URL. When someone opens the URL, they see the full conversation and can continue chatting from there.

## Use Cases
1. **Collaboration**: User researches a topic, shares URL with colleague
2. **Reference**: Bookmark interesting conversations
3. **Support**: Share conversation when asking for help
4. **Social**: Share interesting findings on Twitter/Slack

## Requirements
- ✅ Unique shareable URL per conversation
- ✅ Anyone with URL can view conversation
- ✅ Can continue chatting from shared conversation
- ✅ Privacy options (public/unlisted/private)
- ✅ Social media preview (OG tags)
- ⚠️ Optional: Require auth to continue chatting (Phase 2)

## Architecture

### URL Structure
```
/chat?c=abc123xyz              (short version)
/chat/abc123xyz                (clean version)
/conversations/abc123xyz        (explicit version)
```

Recommendation: Use `/chat?c={id}` for simplicity

### Privacy Levels
```sql
ALTER TABLE conversations ADD COLUMN visibility TEXT DEFAULT 'unlisted'
  CHECK (visibility IN ('public', 'unlisted', 'private'));
```

- **unlisted**: Anyone with link can view (default)
- **public**: Shows in public conversation list
- **private**: Only owner can view (requires auth - Phase 2)

## Implementation Steps

### Step 1: Update Database Schema (15 mins)
**File**: `scripts/migrations/add-conversation-visibility.sql`

```sql
ALTER TABLE conversations
ADD COLUMN visibility TEXT DEFAULT 'unlisted'
CHECK (visibility IN ('public', 'unlisted', 'private'));

-- Add slug for cleaner URLs (optional)
ALTER TABLE conversations ADD COLUMN slug TEXT UNIQUE;

-- Add metadata for social sharing
ALTER TABLE conversations
ADD COLUMN summary TEXT, -- Auto-generated summary
ADD COLUMN thumbnail_url TEXT; -- First video thumbnail

CREATE INDEX idx_conversations_visibility ON conversations(visibility, last_message_at DESC);
```

### Step 2: Generate Shareable Link (30 mins)
**File**: `lib/db/conversations.ts`

Add functions:
```typescript
export async function updateConversationVisibility(
  conversationId: string,
  visibility: 'public' | 'unlisted' | 'private'
) {
  await pool.query(
    'UPDATE conversations SET visibility = $1 WHERE id = $2',
    [visibility, conversationId]
  );
}

export async function getPublicConversation(conversationId: string) {
  const result = await pool.query(
    `SELECT c.*,
       (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
     FROM conversations c
     WHERE c.id = $1 AND c.visibility IN ('public', 'unlisted')`,
    [conversationId]
  );
  return result.rows[0];
}

export async function generateConversationSummary(conversationId: string) {
  const messages = await getMessages(conversationId);
  if (messages.length < 2) return;

  // Get first 3 exchanges for summary
  const excerpt = messages.slice(0, 6)
    .map(m => m.content.slice(0, 100))
    .join(' ');

  await pool.query(
    'UPDATE conversations SET summary = $1 WHERE id = $2',
    [excerpt, conversationId]
  );
}
```

### Step 3: Share Button UI (1 hour)
**File**: `components/ShareConversationButton.tsx`

```typescript
'use client';

import { useState } from 'react';

interface ShareConversationButtonProps {
  conversationId: string;
}

export function ShareConversationButton({ conversationId }: ShareConversationButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const shareUrl = `${window.location.origin}/chat?c=${conversationId}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this conversation',
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
        console.log('Share failed:', err);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleShare}
        className="btn-secondary inline-flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share
      </button>

      {/* Share Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-surface-dark border border-border-subtle rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-text-light mb-4">Share Conversation</h3>

            <div className="space-y-4">
              {/* URL Input */}
              <div>
                <label className="text-sm text-text-light/70 mb-2 block">Shareable Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-primary-dark border border-border-subtle rounded text-text-light text-sm"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 bg-accent-cool hover:bg-accent-cool/80 text-primary-dark rounded transition-all"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Social Share Buttons */}
              <div>
                <label className="text-sm text-text-light/70 mb-2 block">Share via</label>
                <div className="flex gap-2">
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=Check%20out%20this%20conversation`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded transition-all flex-1 text-center"
                  >
                    Twitter
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#0077B5] hover:bg-[#006399] text-white rounded transition-all flex-1 text-center"
                  >
                    LinkedIn
                  </a>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="mt-6 w-full px-4 py-2 bg-surface-dark hover:bg-primary-dark border border-border-subtle rounded transition-all text-text-light"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

### Step 4: Update Chat Page (1 hour)
**File**: `app/chat/page.tsx`

```typescript
import { ShareConversationButton } from '@/components/ShareConversationButton';

export default function ChatPage() {
  const searchParams = useSearchParams();
  const conversationIdFromUrl = searchParams.get('c');

  const [conversationId, setConversationId] = useState<string | null>(conversationIdFromUrl);

  // Load shared conversation on mount
  useEffect(() => {
    if (conversationIdFromUrl) {
      loadConversation(conversationIdFromUrl);
    }
  }, [conversationIdFromUrl]);

  const loadConversation = async (convId: string) => {
    try {
      setLoading(true);
      const data = await apiGet(`/api/conversations/${convId}`);

      if (!data.conversation) {
        // Conversation not found or private
        alert('Conversation not found or is private');
        return;
      }

      setConversationId(convId);
      setMessages(data.messages);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      alert('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header with Share Button */}
      <div className="flex items-center justify-between mb-6">
        <h1>Knowledge Graph Chat</h1>
        {conversationId && messages.length > 0 && (
          <ShareConversationButton conversationId={conversationId} />
        )}
      </div>

      {/* Rest of chat UI */}
    </div>
  );
}
```

### Step 5: Add Dynamic Metadata for Sharing (1-2 hours)
**File**: `app/chat/page.tsx` (if client component, create separate metadata route)

Or better: **File**: `app/conversations/[id]/page.tsx` (new dedicated page)

```typescript
import { getPublicConversation, getMessages } from '@/lib/db/conversations';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const conversation = await getPublicConversation(params.id);

  if (!conversation) {
    return {
      title: 'Conversation Not Found',
    };
  }

  const messages = await getMessages(params.id);
  const firstUserMessage = messages.find(m => m.role === 'user');

  return {
    title: conversation.title || 'Shared Conversation | YouTube Knowledge Graph',
    description: conversation.summary || firstUserMessage?.content.slice(0, 155) || 'View this conversation',
    openGraph: {
      title: conversation.title || 'Shared Conversation',
      description: conversation.summary || 'Check out this conversation',
      type: 'website',
      images: conversation.thumbnail_url ? [conversation.thumbnail_url] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: conversation.title || 'Shared Conversation',
      description: conversation.summary || 'Check out this conversation',
    },
  };
}

export default async function ConversationPage({ params }: { params: { id: string } }) {
  // Redirect to chat page with conversation ID
  redirect(`/chat?c=${params.id}`);
}
```

### Step 6: Update API to Check Visibility (30 mins)
**File**: `app/api/conversations/[id]/route.ts`

```typescript
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const conversation = await getPublicConversation(params.id); // Only public/unlisted

  if (!conversation) {
    return Response.json(
      { error: 'Conversation not found or is private' },
      { status: 404 }
    );
  }

  const messages = await getMessages(params.id);

  return Response.json({
    conversation,
    messages
  });
}
```

### Step 7: Add Conversation List (Optional, 1 hour)
Show public conversations for discovery.

**File**: `app/conversations/page.tsx`

```typescript
export default async function ConversationsPage() {
  const conversations = await getPublicConversations(); // Only visibility='public'

  return (
    <div>
      <h1>Public Conversations</h1>
      <div className="grid gap-4">
        {conversations.map(conv => (
          <Link
            key={conv.id}
            href={`/chat?c=${conv.id}`}
            className="card hover:border-accent-cool/50"
          >
            <h3>{conv.title}</h3>
            <p>{conv.summary}</p>
            <div className="text-sm text-text-light/60">
              {conv.message_count} messages • {formatDate(conv.last_message_at)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

## Testing Strategy

### Manual Tests
1. **Share Link**
   - Have conversation with 3+ messages
   - Click "Share" button
   - Copy link
   - Open in incognito window
   - Verify conversation loads

2. **Continue from Shared**
   - Open shared link
   - Ask new question
   - Verify context maintained

3. **Private Conversation**
   - Create conversation
   - Try to access with different user (Phase 2)
   - Verify blocked

4. **Social Sharing**
   - Share on Twitter
   - Verify preview card shows

### Edge Cases
- Invalid conversation ID
- Private conversation
- Empty conversation
- Very long conversation (>100 messages)

## Acceptance Criteria
- [ ] Share button appears after first message
- [ ] Clicking share opens modal with URL
- [ ] Copy button works
- [ ] URL format is clean and short
- [ ] Opening shared URL loads conversation
- [ ] Can continue chatting from shared conversation
- [ ] Visibility controls work (unlisted/public/private)
- [ ] OG tags generated for social sharing
- [ ] Private conversations are blocked
- [ ] (Optional) Public conversation list works

## Dependencies
- Task 1 (Conversation History) must be completed first
- Database schema from Task 1

## Privacy Considerations
- Default to "unlisted" (not indexed, but accessible via link)
- Add option to make "public" (show in public list)
- Phase 2: Add "private" with authentication
- No sensitive data should be in shareable conversations
- Consider adding "delete conversation" feature

## Future Enhancements
- Conversation forking (branch from any message)
- Embed conversations in other sites (iframe)
- Export as PDF/Markdown
- Comment on shared conversations
- Upvote/like conversations
- Report inappropriate content
- Conversation expiration (auto-delete after X days)
- Password-protected conversations
