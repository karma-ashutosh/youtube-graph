'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiGet, apiPost } from '@/lib/api-client';

interface Concept {
  name: string;
  id: string;
  role: string;
}

interface Segment {
  segment_id: string;
  topic_hint: string;
  start_time: string;
  end_time: string;
  transcript: string;
  similarity: number;
  video_url: string;
  video_title?: string;
  concepts: Concept[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: {
    concepts: any[];
    segments: Segment[];
  };
}

function getYouTubeTimestamp(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  } else if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 0;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<{ concepts: number; segments: number; total: number } | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const appMode = process.env.NEXT_PUBLIC_APP_MODE || 'internal';

  // Helper function to categorize segments
  const categorizeSegments = (segments: Segment[]) => {
    const primary: Segment[] = [];
    const reference: Segment[] = [];

    segments.forEach(segment => {
      const hasPrimaryConcept = segment.concepts?.some(c => c.role === 'primary');
      if (hasPrimaryConcept) {
        primary.push(segment);
      } else {
        reference.push(segment);
      }
    });

    return { primary, reference };
  };

  const checkBackfillStatus = async () => {
    try {
      const data = await apiGet<{ success: boolean; status: { concepts: { needingEmbeddings: number }; segments: { needingEmbeddings: number }; total: number } }>('/api/backfill');

      if (data.success && data.status) {
        setBackfillStatus({
          concepts: data.status.concepts.needingEmbeddings,
          segments: data.status.segments.needingEmbeddings,
          total: data.status.total,
        });
      }
    } catch (error) {
      console.error('Failed to check backfill status:', error);
    }
  };

  const handleBackfill = async () => {
    if (backfilling) return;

    setBackfilling(true);

    try {
      const data = await apiPost<{ results: { concepts: { processed: number; total: number }; segments: { processed: number; total: number } } }>('/api/backfill', {});

      alert(`Backfill complete!\nConcepts: ${data.results.concepts.processed}/${data.results.concepts.total}\nSegments: ${data.results.segments.processed}/${data.results.segments.total}`);

      // Refresh status
      await checkBackfillStatus();
    } catch (error) {
      console.error('Backfill error:', error);
      alert('Failed to backfill embeddings. Check console for details.');
    } finally {
      setBackfilling(false);
    }
  };

  // Check backfill status on page load
  useEffect(() => {
    checkBackfillStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const data = await apiPost<{ answer: string; sources: { concepts: any[]; segments: any[] } }>('/api/chat', { question: input });

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool mb-2">
              Knowledge Graph Chat
            </h1>
            <p className="text-text-light/70">
              Ask questions and get answers enhanced with insights from your video knowledge base
            </p>
          </div>

          {/* Backfill Button */}
          {backfillStatus && backfillStatus.total > 0 && (
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="px-4 py-2 bg-accent-warm/20 hover:bg-accent-warm/30 border border-accent-warm/50 hover:border-accent-warm rounded-lg text-sm text-accent-warm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {backfilling ? (
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-accent-warm border-t-transparent rounded-full animate-spin"></div>
                  Backfilling...
                </span>
              ) : (
                <span>⚡ Backfill {backfillStatus.total} Embeddings</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-6 mb-6 min-h-[400px]">
        {messages.length === 0 && (
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-xl font-semibold text-text-light mb-2">Start a conversation</h3>
            <p className="text-text-light/60 mb-4">
              Ask me anything! I&apos;ll provide answers using both general knowledge and specific insights from your videos.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => setInput('How do I do A/B testing?')}
                className="px-4 py-2 bg-surface-dark hover:bg-accent-cool/10 border border-border-subtle hover:border-accent-cool/50 rounded-lg text-sm text-text-light transition-all"
              >
                How do I do A/B testing?
              </button>
              <button
                onClick={() => setInput('What is product-market fit?')}
                className="px-4 py-2 bg-surface-dark hover:bg-accent-cool/10 border border-border-subtle hover:border-accent-cool/50 rounded-lg text-sm text-text-light transition-all"
              >
                What is product-market fit?
              </button>
              <button
                onClick={() => setInput('How to find my target customer?')}
                className="px-4 py-2 bg-surface-dark hover:bg-accent-cool/10 border border-border-subtle hover:border-accent-cool/50 rounded-lg text-sm text-text-light transition-all"
              >
                How to find my target customer?
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={`max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-accent-cool/20 border-accent-cool/50'
                  : 'bg-surface-dark border-border-subtle'
              } border rounded-lg p-4`}
            >
              <div className="prose prose-invert prose-sm max-w-none">
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap text-text-light">{msg.content}</div>
                ) : (
                  <div className="text-text-light">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="text-text-light">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-accent-cool">{children}</strong>,
                        em: ({ children }) => <em className="italic text-text-light/90">{children}</em>,
                        code: ({ children }) => <code className="bg-primary-dark px-1.5 py-0.5 rounded text-accent-cool text-sm">{children}</code>,
                        pre: ({ children }) => <pre className="bg-primary-dark p-3 rounded-lg overflow-x-auto mb-4">{children}</pre>,
                        h1: ({ children }) => <h1 className="text-2xl font-bold text-text-light mb-3">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-bold text-text-light mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-semibold text-text-light mb-2">{children}</h3>,
                        a: ({ href, children }) => <a href={href} className="text-accent-cool hover:text-accent-cool/80 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Sources */}
              {msg.sources && (msg.sources.concepts.length > 0 || msg.sources.segments.length > 0) && (
                <div className="mt-4 pt-4 border-t border-border-subtle">
                  <div className="text-xs font-semibold text-accent-cool mb-3">
                    📚 Sources from Knowledge Graph
                  </div>

                  {appMode === 'internal' ? (
                    // Internal mode: Show concepts + segments as before
                    <>
                      {/* Concepts */}
                      {msg.sources.concepts.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs text-text-light/60 mb-2">Related Concepts:</div>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.concepts.map((concept) => (
                              <Link
                                key={concept.concept_id}
                                href={`/concepts/${concept.concept_id}`}
                                className="px-3 py-1 bg-accent-cool/10 hover:bg-accent-cool/20 border border-accent-cool/30 hover:border-accent-cool/50 rounded-full text-xs text-accent-cool transition-all"
                              >
                                {concept.canonical_name}
                                <span className="ml-1 opacity-60">
                                  ({Math.round(concept.similarity * 100)}%)
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Segments */}
                      {msg.sources.segments.length > 0 && (
                        <div>
                          <div className="text-xs text-text-light/60 mb-2">Relevant Video Segments:</div>
                          <div className="space-y-2">
                            {msg.sources.segments.slice(0, 3).map((segment) => (
                              <div
                                key={segment.segment_id}
                                className="bg-primary-dark border border-border-subtle rounded-lg p-3"
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="font-medium text-sm text-text-light">
                                    {segment.topic_hint}
                                  </div>
                                  <div className="text-xs text-text-light/60 whitespace-nowrap">
                                    {Math.round(segment.similarity * 100)}% match
                                  </div>
                                </div>
                                {segment.video_title && (
                                  <div className="text-xs text-text-light/60 mb-2">
                                    {segment.video_title}
                                  </div>
                                )}
                                <div className="text-xs text-text-light/70 line-clamp-2 mb-2">
                                  {segment.transcript}
                                </div>
                                <a
                                  href={`${segment.video_url}&t=${getYouTubeTimestamp(segment.start_time)}s`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-accent-cool hover:text-accent-cool/80 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                                  </svg>
                                  Watch at {segment.start_time}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    // External mode: Show only video segments (primary first, then reference)
                    <>
                      {msg.sources.segments.length > 0 && (() => {
                        const { primary, reference } = categorizeSegments(msg.sources.segments);
                        const renderSegment = (segment: Segment) => (
                          <div
                            key={segment.segment_id}
                            className="bg-primary-dark border border-border-subtle rounded-lg p-3"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="font-medium text-sm text-text-light">
                                {segment.topic_hint}
                              </div>
                            </div>
                            {segment.video_title && (
                              <div className="text-xs text-text-light/60 mb-2">
                                {segment.video_title}
                              </div>
                            )}
                            <div className="text-xs text-text-light/70 line-clamp-2 mb-2">
                              {segment.transcript}
                            </div>
                            <a
                              href={`${segment.video_url}&t=${getYouTubeTimestamp(segment.start_time)}s`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-accent-cool hover:text-accent-cool/80 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                              </svg>
                              Watch at {segment.start_time}
                            </a>
                          </div>
                        );

                        return (
                          <div className="space-y-3">
                            {primary.length > 0 && (
                              <div>
                                <div className="text-xs text-text-light/60 mb-2">Primary Sources:</div>
                                <div className="space-y-2">
                                  {primary.map(renderSegment)}
                                </div>
                              </div>
                            )}
                            {reference.length > 0 && (
                              <div>
                                <div className="text-xs text-text-light/60 mb-2">Additional References:</div>
                                <div className="space-y-2">
                                  {reference.map(renderSegment)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-dark border border-border-subtle rounded-lg p-4">
              <div className="flex items-center gap-2 text-text-light/60">
                <div className="w-2 h-2 bg-accent-cool rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-accent-cool rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-accent-cool rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                <span className="ml-2 text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-primary-dark border-t border-border-subtle pt-4 pb-8">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={loading}
            className="flex-1 px-4 py-3 bg-surface-dark border border-border-subtle rounded-lg text-text-light placeholder-text-light/40 focus:outline-none focus:border-accent-cool/50 focus:ring-1 focus:ring-accent-cool/50 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-accent-cool hover:bg-accent-cool/80 disabled:bg-accent-cool/20 text-primary-dark font-medium rounded-lg transition-all disabled:cursor-not-allowed"
          >
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </form>
      </div>
    </div>
  );
}
