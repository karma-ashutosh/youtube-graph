'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiGet, apiPost } from '@/lib/api-client';
import { LoadingAnimation } from '@/components/chat/LoadingAnimation';

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

interface RelatedTopic {
  segment_id: string;
  topic_hint: string;
  similarity_score: number;
  shared_concept_count: number;
  connecting_concepts: string[];
  preview?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: {
    concepts: any[];
    segments: Segment[];
  };
  relatedTopics?: RelatedTopic[];
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
  const [loadingTimer, setLoadingTimer] = useState(0);
  const [backfillStatus, setBackfillStatus] = useState<{ concepts: number; segments: number; total: number } | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [includedSegments, setIncludedSegments] = useState<Set<string>>(new Set());
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

  // Load conversation from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get('conversation');

    if (convId) {
      loadConversation(convId);
    }

    checkBackfillStatus();
  }, []);

  const loadConversation = async (convId: string) => {
    try {
      const data = await apiGet<{ conversation: any; messages: Message[] }>(`/api/conversations/${convId}`);
      setConversationId(convId);
      setMessages(data.messages);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  // Timer for loading state
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setLoadingTimer(0);
      interval = setInterval(() => {
        setLoadingTimer((prev) => prev + 0.1);
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  const handleIncludeTopic = (segmentId: string) => {
    setIncludedSegments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId);
      } else {
        newSet.add(segmentId);
      }
      return newSet;
    });
  };

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
      const data = await apiPost<{ answer: string; conversationId: string; sources: { concepts: any[]; segments: any[] }; relatedTopics?: RelatedTopic[] }>('/api/chat', {
        question: input,
        conversationId, // Pass conversation ID if exists
        includeSegments: includedSegments.size > 0 ? Array.from(includedSegments) : undefined,
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
        relatedTopics: data.relatedTopics,
        sources: data.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Clear included segments after successful response
      setIncludedSegments(new Set());
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

  // Start a new conversation
  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    window.history.pushState({}, '', '/chat');
  };

  // Share conversation
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/conversations/${conversationId}`;

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
      setShowShareModal(true);
    }
  };

  const handleCopy = async () => {
    const shareUrl = `${window.location.origin}/conversations/${conversationId}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

          <div className="flex gap-2">
            {/* Share Button */}
            {conversationId && messages.length > 0 && (
              <button
                onClick={handleShare}
                className="px-4 py-2 bg-surface-dark hover:bg-accent-cool/10 border border-border-subtle hover:border-accent-cool/50 rounded-lg text-sm text-text-light font-medium transition-all whitespace-nowrap inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
            )}

            {/* New Conversation Button */}
            {conversationId && (
              <button
                onClick={startNewConversation}
                className="px-4 py-2 bg-accent-cool/20 hover:bg-accent-cool/30 border border-accent-cool/50 hover:border-accent-cool rounded-lg text-sm text-accent-cool font-medium transition-all whitespace-nowrap"
              >
                + New Chat
              </button>
            )}

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
                                <div className="text-xs text-text-light/70 line-clamp-2 mb-3">
                                  {segment.transcript}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/segments/${segment.segment_id}`}
                                    className="text-xs text-accent-cool hover:text-accent-cool/80 underline transition-colors"
                                  >
                                    View Details
                                  </Link>
                                  <span className="text-text-light/40">•</span>
                                  <a
                                    href={`${segment.video_url}&t=${getYouTubeTimestamp(segment.start_time)}s`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-accent-cool/10 hover:bg-accent-cool/20 border border-accent-cool/30 hover:border-accent-cool/50 rounded text-xs text-accent-cool transition-all"
                                  >
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                                    </svg>
                                    Watch now
                                  </a>
                                </div>
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
                            {/* Segment Preview */}
                            <div className="text-xs text-text-light/70 line-clamp-2 mb-3">
                              {segment.transcript}
                            </div>
                            {/* Segment Direct URL and Watch Now Button */}
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/segments/${segment.segment_id}`}
                                className="text-xs text-accent-cool hover:text-accent-cool/80 underline transition-colors"
                              >
                                View Details
                              </Link>
                              <span className="text-text-light/40">•</span>
                              <a
                                href={`${segment.video_url}&t=${getYouTubeTimestamp(segment.start_time)}s`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1 bg-accent-cool/10 hover:bg-accent-cool/20 border border-accent-cool/30 hover:border-accent-cool/50 rounded text-xs text-accent-cool transition-all"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                                </svg>
                                Watch now
                              </a>
                            </div>
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
                                <div className="text-xs text-text-light/60 mb-2">Relevant Segments:</div>
                                <div className="space-y-2">
                                  {reference.map(renderSegment)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Concepts Section */}
                      {msg.sources.concepts.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs text-text-light/60 mb-2">Related Concepts:</div>
                          <div className="space-y-2">
                            {msg.sources.concepts.map((concept) => (
                              <div
                                key={concept.concept_id}
                                className="bg-primary-dark border border-border-subtle rounded-lg p-3"
                              >
                                {/* Concept Preview */}
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="font-medium text-sm text-text-light">
                                    {concept.canonical_name}
                                  </div>
                                  {concept.category && (
                                    <span className="text-xs px-2 py-0.5 bg-accent-cool/10 border border-accent-cool/30 rounded text-accent-cool">
                                      {concept.category}
                                    </span>
                                  )}
                                </div>
                                {concept.aliases && concept.aliases.length > 0 && (
                                  <div className="text-xs text-text-light/60 mb-2">
                                    Also known as: {concept.aliases.join(', ')}
                                  </div>
                                )}
                                {concept.total_mentions && (
                                  <div className="text-xs text-text-light/70 mb-2">
                                    Mentioned {concept.total_mentions} time{concept.total_mentions !== 1 ? 's' : ''}
                                  </div>
                                )}
                                {/* Concept Direct URL */}
                                <Link
                                  href={`/concepts/${concept.concept_id}`}
                                  className="text-xs text-accent-cool hover:text-accent-cool/80 underline transition-colors"
                                >
                                  View Concept Details
                                </Link>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Related Topics */}
              {msg.relatedTopics && msg.relatedTopics.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border-subtle">
                  <div className="text-xs font-semibold text-accent-warm mb-3">
                    💡 Related Topics You Might Explore
                  </div>
                  <div className="space-y-2">
                    {msg.relatedTopics.map((topic) => {
                      const isIncluded = includedSegments.has(topic.segment_id);
                      return (
                        <div
                          key={topic.segment_id}
                          className={`border rounded-lg p-3 transition-all ${
                            isIncluded
                              ? 'bg-accent-warm/20 border-accent-warm'
                              : 'bg-accent-warm/5 border-accent-warm/30 hover:bg-accent-warm/10'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="font-medium text-sm text-text-light">
                              {topic.topic_hint}
                            </div>
                            <div className="text-xs text-accent-warm/70 whitespace-nowrap">
                              {Math.round(topic.similarity_score * 100)}% related
                            </div>
                          </div>
                          {topic.preview && (
                            <div className="text-xs text-text-light/70 line-clamp-2 mb-2">
                              {topic.preview}...
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-xs text-text-light/60 mb-3">
                            <span>Connected via: {topic.connecting_concepts.slice(0, 2).join(', ')}</span>
                            {topic.connecting_concepts.length > 2 && (
                              <span>+{topic.connecting_concepts.length - 2} more</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleIncludeTopic(topic.segment_id)}
                              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                                isIncluded
                                  ? 'bg-accent-warm text-primary-dark hover:bg-accent-warm/90'
                                  : 'bg-accent-warm/20 text-accent-warm hover:bg-accent-warm/30 border border-accent-warm/50'
                              }`}
                            >
                              {isIncluded ? '✓ Included in next response' : '+ Include in next response'}
                            </button>
                            <Link
                              href={`/segments/${topic.segment_id}`}
                              className="text-xs text-accent-warm hover:text-accent-warm/80 underline transition-colors"
                            >
                              View details →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {includedSegments.size > 0 && (
                    <div className="mt-3 text-xs text-accent-warm bg-accent-warm/10 border border-accent-warm/30 rounded-lg p-2">
                      💡 {includedSegments.size} topic{includedSegments.size !== 1 ? 's' : ''} will be included in your next question
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <LoadingAnimation elapsedTime={loadingTimer} maxTime={20} />
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

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowShareModal(false)}>
          <div className="bg-surface-dark border border-border-subtle rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-text-light mb-4">Share Conversation</h3>

            <div className="space-y-4">
              {/* URL Input */}
              <div>
                <label className="text-sm text-text-light/70 mb-2 block">Shareable Link (Read-only)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/conversations/${conversationId}`}
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
                <p className="text-xs text-text-light/50 mt-2">
                  Anyone with this link can view the conversation but cannot continue chatting.
                </p>
              </div>

              {/* Social Share Buttons */}
              <div>
                <label className="text-sm text-text-light/70 mb-2 block">Share via</label>
                <div className="flex gap-2">
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(`${window.location.origin}/conversations/${conversationId}`)}&text=Check%20out%20this%20conversation`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded transition-all flex-1 text-center text-sm"
                  >
                    Twitter
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${window.location.origin}/conversations/${conversationId}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#0077B5] hover:bg-[#006399] text-white rounded transition-all flex-1 text-center text-sm"
                  >
                    LinkedIn
                  </a>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className="mt-6 w-full px-4 py-2 bg-surface-dark hover:bg-primary-dark border border-border-subtle rounded transition-all text-text-light"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
