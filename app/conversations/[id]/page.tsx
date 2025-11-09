'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiGet } from '@/lib/api-client';

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

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
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

  useEffect(() => {
    const loadConversation = async () => {
      try {
        setLoading(true);
        const { id } = await params;
        setConversationId(id);
        const data = await apiGet<{ conversation: any; messages: Message[] }>(`/api/conversations/${id}`);
        setConversation(data.conversation);
        setMessages(data.messages);
      } catch (err) {
        console.error('Failed to load conversation:', err);
        setError('Conversation not found or could not be loaded');
      } finally {
        setLoading(false);
      }
    };

    loadConversation();
  }, [params]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">⏳</div>
          <h3 className="text-xl font-semibold text-text-light mb-2">Loading conversation...</h3>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-xl font-semibold text-text-light mb-2">Conversation Not Found</h3>
          <p className="text-text-light/60 mb-4">{error || 'This conversation does not exist or has been deleted.'}</p>
          <Link href="/chat" className="btn-primary inline-block">
            Start New Chat
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool mb-2">
              {conversation.title || 'Shared Conversation'}
            </h1>
            <p className="text-text-light/70">
              Read-only view • Created {new Date(conversation.created_at).toLocaleDateString()}
            </p>
          </div>

          <Link
            href="/chat"
            className="px-4 py-2 bg-accent-cool hover:bg-accent-cool/80 text-primary-dark font-medium rounded-lg transition-all whitespace-nowrap"
          >
            Start Your Own Chat
          </Link>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-6 mb-6">
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
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="sticky bottom-0 bg-primary-dark border-t border-border-subtle pt-4 pb-8">
        <div className="text-center">
          <p className="text-text-light/70 mb-4">
            This is a read-only view. Start your own conversation to ask questions.
          </p>
          <Link
            href="/chat"
            className="inline-block px-6 py-3 bg-accent-cool hover:bg-accent-cool/80 text-primary-dark font-medium rounded-lg transition-all"
          >
            Start Your Own Chat
          </Link>
        </div>
      </div>
    </div>
  );
}
