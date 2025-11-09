import pool from '@/lib/db';

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: any;
  created_at: Date;
  tokens_used?: number;
}

export interface Conversation {
  id: string;
  workspace: string;
  created_at: Date;
  updated_at: Date;
  title?: string;
  last_message_at: Date;
}

/**
 * Create a new conversation
 */
export async function createConversation(workspace: string = 'default'): Promise<string> {
  const result = await pool.query(
    'INSERT INTO conversations (workspace) VALUES ($1) RETURNING id',
    [workspace]
  );
  return result.rows[0].id;
}

/**
 * Get conversation by ID
 */
export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const result = await pool.query(
    'SELECT * FROM conversations WHERE id = $1',
    [conversationId]
  );
  return result.rows[0] || null;
}

/**
 * Get all messages for a conversation, ordered by creation time
 */
export async function getMessages(conversationId: string): Promise<Message[]> {
  const result = await pool.query(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );
  return result.rows;
}

/**
 * Add a message to a conversation
 */
export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  sources?: any,
  tokensUsed?: number
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO messages (conversation_id, role, content, sources, tokens_used)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [conversationId, role, content, sources ? JSON.stringify(sources) : null, tokensUsed]
  );

  // Update conversation's last_message_at
  await pool.query(
    'UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1',
    [conversationId]
  );

  return result.rows[0].id;
}

/**
 * Generate a title for the conversation based on the first user message
 */
export async function generateConversationTitle(conversationId: string): Promise<void> {
  const messages = await getMessages(conversationId);
  if (messages.length === 0) return;

  // Use first user message as base for title
  const firstMessage = messages.find(m => m.role === 'user');
  if (!firstMessage) return;

  // Generate short title (truncate at 60 characters)
  const title = firstMessage.content.slice(0, 60) + (firstMessage.content.length > 60 ? '...' : '');

  await pool.query(
    'UPDATE conversations SET title = $1 WHERE id = $2',
    [title, conversationId]
  );
}

/**
 * Get all conversations for a workspace, ordered by most recent activity
 */
export async function getConversationsForWorkspace(
  workspace: string = 'default',
  limit: number = 50
): Promise<Conversation[]> {
  const result = await pool.query(
    'SELECT * FROM conversations WHERE workspace = $1 ORDER BY last_message_at DESC LIMIT $2',
    [workspace, limit]
  );
  return result.rows;
}

/**
 * Delete a conversation and all its messages (cascade will handle messages)
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  await pool.query('DELETE FROM conversations WHERE id = $1', [conversationId]);
}

/**
 * Get message count for a conversation
 */
export async function getMessageCount(conversationId: string): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1',
    [conversationId]
  );
  return parseInt(result.rows[0].count);
}
