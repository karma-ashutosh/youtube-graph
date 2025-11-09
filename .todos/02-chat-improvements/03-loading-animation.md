# Task 3: Animated Loading with Visual Segments

**Status**: ⚪ Not Started
**Priority**: P1 (High)
**Estimated Time**: 4-6 hours

## Goal
Replace the current progress bar with an engaging animation showing segments flowing into a brain/professor/guru while keeping the timer intact.

## Current State
```
┌────────────────────────────────┐
│ • • • Thinking...    5.2s      │
│ ▓▓▓▓▓▓▓▓░░░░░░░░░░  26%        │
│ This may take up to 20 seconds │
└────────────────────────────────┘
```

## Proposed New State
```
┌────────────────────────────────────────┐
│          🧠 Processing...              │
│                                        │
│     [Segment] ─→                      │
│                  [Segment] ─→  🧠     │
│  [Segment] ─→                         │
│                                        │
│              5.2s / ~20s               │
└────────────────────────────────────────┘
```

## Design Options

### Option A: Brain with Flowing Segments (Recommended)
Visual elements:
- Central brain icon (animated pulse)
- 3-5 segment cards flowing toward brain
- Segments fade in from left, move right, fade out
- Smooth animations with staggered timing
- Keep timer at bottom

### Option B: Professor/Guru Character
Visual elements:
- Cartoon professor/guru character
- Segments fly in as "books" or "papers"
- Character "reads" each segment
- Speech bubble with thinking messages
- More playful, might be too casual

### Option C: Graph Visualization
Visual elements:
- Knowledge graph nodes
- Segments connect to form network
- Pulsing connections
- More technical, fits "knowledge graph" theme

**Recommendation**: Start with Option A (Brain), can experiment with others later

## Implementation Plan

### Step 1: Create Animated Component (2-3 hours)
**File**: `components/chat/LoadingAnimation.tsx`

```typescript
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

export function LoadingAnimation({ elapsedTime, maxTime = 20 }: LoadingAnimationProps) {
  const [segments, setSegments] = useState<Segment[]>([]);

  // Sample segment topics (randomized)
  const segmentTopics = [
    'Sleep optimization',
    'Circadian rhythms',
    'Morning routines',
    'Light exposure',
    'Temperature control',
    'Sleep tracking',
    'Caffeine timing',
    'Exercise timing',
  ];

  // Generate new segments periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setSegments(prev => {
        // Remove segments that have completed their journey
        const active = prev.filter(s => s.position < 100);

        // Add new segment if less than 3 active
        if (active.length < 3) {
          const randomTopic = segmentTopics[Math.floor(Math.random() * segmentTopics.length)];
          active.push({
            id: Date.now(),
            text: randomTopic,
            position: 0,
            opacity: 1,
          });
        }

        // Update positions (move right)
        return active.map(s => ({
          ...s,
          position: s.position + 2, // Move 2% per frame
          opacity: s.position < 80 ? 1 : 1 - (s.position - 80) / 20, // Fade out near end
        }));
      });
    }, 50); // 20 fps

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-surface-dark border border-border-subtle rounded-lg p-6 min-w-[400px]">
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
            }}
          >
            <div className="bg-accent-cool/20 border border-accent-cool/50 rounded-lg px-3 py-2 whitespace-nowrap text-xs text-accent-cool font-medium">
              📄 {segment.text}
            </div>
          </div>
        ))}

        {/* Connection Lines (optional) */}
        <div className="absolute inset-0 pointer-events-none">
          {/* SVG animated lines connecting segments to brain */}
        </div>
      </div>

      {/* Status Text */}
      <div className="text-center mb-3">
        <p className="text-sm text-text-light/70">
          Searching knowledge base and generating answer...
        </p>
      </div>

      {/* Timer */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-text-light/60">
          Elapsed: <span className="font-mono text-accent-cool">{elapsedTime.toFixed(1)}s</span>
        </div>
        <div className="text-text-light/60">
          Typical: ~{maxTime}s
        </div>
      </div>

      {/* Progress Bar (subtle) */}
      <div className="mt-3 w-full h-1 bg-primary-dark rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent-cool to-accent-warm transition-all duration-100"
          style={{ width: `${Math.min((elapsedTime / maxTime) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
```

### Step 2: Add Custom Animations (1 hour)
**File**: `app/globals.css`

```css
@keyframes pulse-slow {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(99, 179, 237, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(99, 179, 237, 0.8);
  }
}

.animate-pulse-slow {
  animation: pulse-slow 2s ease-in-out infinite;
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}

.animate-glow {
  animation: glow 2s ease-in-out infinite;
}
```

### Step 3: Update Chat Page (30 mins)
**File**: `app/chat/page.tsx`

Replace the loading state:

```typescript
import { LoadingAnimation } from '@/components/chat/LoadingAnimation';

// In the messages area:
{loading && (
  <div className="flex justify-start">
    <LoadingAnimation elapsedTime={loadingTimer} maxTime={20} />
  </div>
)}
```

### Step 4: Enhanced Version with Real Segments (Optional, 2 hours)
Show actual segment titles being processed instead of random ones.

**Modified API Response**:
```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  // ... existing code ...

  // Stream progress updates (optional)
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial message
      controller.enqueue(JSON.stringify({ type: 'status', message: 'Searching segments...' }));

      // Do RAG search
      const segments = await performRAGSearch(query);

      // Send found segments
      controller.enqueue(JSON.stringify({
        type: 'segments',
        data: segments.map(s => ({ id: s.id, title: s.topic_hint }))
      }));

      // Generate answer
      controller.enqueue(JSON.stringify({ type: 'status', message: 'Generating answer...' }));
      const answer = await generateAnswer(query, segments);

      // Send final answer
      controller.enqueue(JSON.stringify({ type: 'answer', data: answer }));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

**Updated Component**:
```typescript
export function LoadingAnimation({ onSegmentsUpdate }: { onSegmentsUpdate?: (segments: string[]) => void }) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [realSegments, setRealSegments] = useState<string[]>([]);

  // Listen for real segment updates from API
  useEffect(() => {
    if (onSegmentsUpdate) {
      // This will be called when API sends segment data
    }
  }, [onSegmentsUpdate]);

  // Use realSegments if available, otherwise use mock data
  const segmentTopics = realSegments.length > 0 ? realSegments : defaultTopics;

  // ... rest of animation logic
}
```

## Alternative: Lottie Animation

For more polished animations, use Lottie:

**Install**:
```bash
npm install lottie-react
```

**File**: `components/chat/LoadingAnimation.tsx`
```typescript
import Lottie from 'lottie-react';
import brainAnimation from '@/public/animations/brain-loading.json';

export function LoadingAnimation({ elapsedTime, maxTime = 20 }: LoadingAnimationProps) {
  return (
    <div className="bg-surface-dark border border-border-subtle rounded-lg p-6">
      <Lottie
        animationData={brainAnimation}
        loop={true}
        style={{ width: 200, height: 200 }}
      />
      <div className="text-center mt-4">
        <p className="text-sm text-text-light/70 mb-2">Processing your question...</p>
        <div className="text-accent-cool font-mono">{elapsedTime.toFixed(1)}s</div>
      </div>
    </div>
  );
}
```

Find free Lottie animations at:
- https://lottiefiles.com/search?q=brain&category=animations
- https://lottiefiles.com/search?q=thinking&category=animations
- https://lottiefiles.com/search?q=ai&category=animations

## Design Variations

### Variation 1: Segment Cards with Icons
```
📄 Sleep optimization → 🧠
📄 Circadian rhythms → 🧠
📄 Light exposure   → 🧠
```

### Variation 2: Graph Nodes
```
    ●──●
   ╱    ╲
  ●  →  🧠
   ╲    ╱
    ●──●
```

### Variation 3: Book Stack
```
    📚
   ╱│╲
  📖📖📖 → 🧠
```

### Variation 4: Professor Character
```
     👨‍🏫
    ╱│╲
   📄 📄 📄
  "Hmm, interesting..."
```

## Testing

### Visual Testing
- [ ] Animation is smooth (no jank)
- [ ] Segments flow naturally
- [ ] Brain pulses gently
- [ ] Timer is clearly visible
- [ ] Works on mobile devices
- [ ] No performance issues (check FPS)
- [ ] Accessible (doesn't cause seizures)

### Performance Testing
- [ ] Animation doesn't lag on slower devices
- [ ] CPU usage is reasonable
- [ ] Works in all major browsers
- [ ] No memory leaks (check DevTools)

## Acceptance Criteria
- [ ] Loading animation replaces progress bar
- [ ] Segments flow from left to right
- [ ] Brain icon is central and animated
- [ ] Timer shows elapsed time
- [ ] Animation is smooth and performant
- [ ] Mobile responsive
- [ ] Accessible (reduced motion support)
- [ ] Keeps user engaged during wait

## Dependencies
None (independent of other tasks)

## Accessibility Considerations

Add support for `prefers-reduced-motion`:

```typescript
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

if (prefersReducedMotion) {
  // Show static version without animations
  return <StaticLoadingIndicator elapsedTime={elapsedTime} />;
}

// Otherwise show full animation
```

**File**: `components/chat/StaticLoadingIndicator.tsx`
```typescript
export function StaticLoadingIndicator({ elapsedTime }: { elapsedTime: number }) {
  return (
    <div className="bg-surface-dark border border-border-subtle rounded-lg p-6">
      <div className="text-center">
        <div className="text-4xl mb-4">🧠</div>
        <p className="text-text-light mb-2">Processing your question</p>
        <p className="text-accent-cool font-mono">{elapsedTime.toFixed(1)}s</p>
      </div>
    </div>
  );
}
```

## Future Enhancements
- Different animations for different question types
- Show actual segment titles being processed (requires streaming API)
- Character variations (brain, professor, robot)
- Sound effects (optional, user preference)
- Celebrate when answer arrives (confetti, tada)
- Easter eggs for long waits
- Progress milestones ("Found 5 segments", "Generating answer...")

## Resources
- [Framer Motion](https://www.framer.com/motion/) - React animation library
- [Lottie Files](https://lottiefiles.com/) - Free animations
- [CSS Tricks - Animation Performance](https://css-tricks.com/animations-performance/)
- [Accessibility - Reduced Motion](https://web.dev/prefers-reduced-motion/)
