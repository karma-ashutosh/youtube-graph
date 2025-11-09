'use client';

import { useEffect, useState } from 'react';

interface Segment {
  id: number;
  text: string;
  position: number; // 0-100%
  opacity: number;
}

interface LoadingAnimationProps {
  elapsedTime: number;
  maxTime?: number;
}

// Sample segment topics (randomized)
const segmentTopics = [
  'Product-market fit',
  'Customer discovery',
  'A/B testing',
  'Growth strategies',
  'Retention metrics',
  'User feedback',
  'Market validation',
  'Value proposition',
];

export function LoadingAnimation({ elapsedTime, maxTime = 20 }: LoadingAnimationProps) {
  const [segments, setSegments] = useState<Segment[]>([]);

  // Generate new segments periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setSegments(prev => {
        // Remove segments that have completed their journey
        const active = prev.filter(s => s.position < 100);

        // Add new segment if less than 3 active
        if (active.length < 3 && Math.random() > 0.3) {
          const randomTopic = segmentTopics[Math.floor(Math.random() * segmentTopics.length)];
          active.push({
            id: Date.now() + Math.random(),
            text: randomTopic,
            position: 0,
            opacity: 0,
          });
        }

        // Update positions (move right)
        return active.map(s => ({
          ...s,
          position: s.position + 1.5, // Move 1.5% per frame
          opacity: s.position < 10
            ? s.position / 10 // Fade in
            : s.position < 80
              ? 1 // Full opacity
              : 1 - (s.position - 80) / 20, // Fade out near end
        }));
      });
    }, 50); // 20 fps

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-surface-dark border border-border-subtle rounded-lg p-6 min-w-[400px] max-w-[500px]">
      {/* Header */}
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-text-light flex items-center justify-center gap-2">
          <span className="text-2xl animate-pulse">🧠</span>
          Processing Your Question
        </h3>
      </div>

      {/* Animation Area */}
      <div className="relative h-32 mb-4 bg-primary-dark rounded-lg overflow-hidden">
        {/* Animated Brain (destination) */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 z-10">
          <div className="text-5xl animate-pulse-slow">
            🧠
          </div>
        </div>

        {/* Flowing Segments */}
        {segments.map(segment => (
          <div
            key={segment.id}
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-50"
            style={{
              left: `${segment.position}%`,
              opacity: segment.opacity,
              transform: `translateY(${Math.sin(segment.position * 0.1) * 10 - 50}%)`, // Slight wave motion
            }}
          >
            <div className="bg-accent-cool/20 border border-accent-cool/50 rounded-lg px-3 py-2 whitespace-nowrap text-xs text-accent-cool font-medium shadow-lg">
              📄 {segment.text}
            </div>
          </div>
        ))}
      </div>

      {/* Status Text */}
      <div className="text-center mb-3">
        <p className="text-sm text-text-light/70">
          Searching knowledge base and generating answer...
        </p>
      </div>

      {/* Timer */}
      <div className="flex items-center justify-between text-sm mb-3">
        <div className="text-text-light/60">
          Elapsed: <span className="font-mono text-accent-cool">{elapsedTime.toFixed(1)}s</span>
        </div>
        <div className="text-text-light/60">
          Typical: ~{maxTime}s
        </div>
      </div>

      {/* Progress Bar (subtle) */}
      <div className="w-full h-1 bg-primary-dark rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent-cool to-accent-warm transition-all duration-100"
          style={{ width: `${Math.min((elapsedTime / maxTime) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
