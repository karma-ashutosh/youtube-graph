import Anthropic from '@anthropic-ai/sdk';
import { Message } from '@/lib/db/conversations';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Rewrite a user query to be self-contained using conversation context
 * This helps RAG search understand ambiguous follow-up questions like "tell me more" or "how do I fix this?"
 */
export async function rewriteQueryWithContext(
  currentQuery: string,
  conversationHistory: Message[]
): Promise<string> {
  // No rewriting needed for first message
  if (conversationHistory.length === 0) {
    return currentQuery;
  }

  // Check if query seems self-contained already (heuristic)
  const wordsCount = currentQuery.trim().split(/\s+/).length;
  const hasPronouns = /\b(this|that|these|those|it|they)\b/i.test(currentQuery);
  const isVague = /\b(more|tell me more|explain|elaborate)\b/i.test(currentQuery) && wordsCount < 8;

  // If query looks self-contained, skip expensive LLM call
  if (wordsCount > 8 && !hasPronouns && !isVague) {
    console.log('[Query Rewriter] Query appears self-contained, skipping rewrite');
    return currentQuery;
  }

  // Take last 3-4 messages for context (don't overwhelm the model)
  const recentHistory = conversationHistory.slice(-4);

  const contextMessages = recentHistory.map(m =>
    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 300)}`
  ).join('\n\n');

  const prompt = `Given this conversation history:

${contextMessages}

The user now asks: "${currentQuery}"

Rewrite this as a standalone, self-contained question that includes necessary context from the conversation. Keep it concise and focused on the user's intent.

If the question is already standalone and clear, return it unchanged.

Examples:
- "How do I overcome this?" → "How do I overcome sleep deprivation?"
- "What about pricing?" → "What pricing strategies work for SaaS products?"
- "Tell me more" → "Tell me more about product-market fit strategies"
- "What is A/B testing?" → "What is A/B testing?" (already clear)

Return ONLY the rewritten question, nothing else.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Fast and cheap for rewriting
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const rewritten = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : currentQuery;

    console.log(`[Query Rewriter] "${currentQuery}" → "${rewritten}"`);

    return rewritten;
  } catch (error) {
    console.error('[Query Rewriter] Error rewriting query:', error);
    // Fallback to original query if rewriting fails
    return currentQuery;
  }
}
