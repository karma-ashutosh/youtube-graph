# Task 5: Search Prominence on Homepage

**Status**: ⚪ Not Started
**Priority**: P2
**Estimated Time**: 2-3 hours

## Goal
Make search/chat the primary entry point on the homepage for better UX and engagement.

## Current State
- Chat link is in the hero section CTAs
- Not prominent enough for discovery
- Users might not understand they can search/ask questions

## Proposed Changes

### Option A: Hero Search Bar (Recommended)
Add a prominent search input directly in the hero section.

**Visual**: Large search bar with example queries below

```
┌─────────────────────────────────────────────────┐
│    Dive Deeper Into Your Favorite Content      │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ 🔍 Ask anything about your videos...     │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  Try: "What is product-market fit?"            │
│       "Show me examples of growth strategies"  │
└─────────────────────────────────────────────────┘
```

### Option B: Chat Widget
Add a floating chat widget in the bottom-right corner (like Intercom).

### Option C: Combined Approach
- Search bar in hero
- Floating widget on all pages
- Auto-focus when clicking

## Implementation: Hero Search Bar

### Step 1: Create SearchBar Component (1 hour)
**File**: `components/SearchBar.tsx`

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SearchBarProps {
  placeholder?: string;
  autoFocus?: boolean;
  size?: "small" | "medium" | "large";
}

export function SearchBar({
  placeholder = "Ask anything about your videos...",
  autoFocus = false,
  size = "large"
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/chat?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const sizeClasses = {
    small: "text-sm py-2 px-4",
    medium: "text-base py-3 px-6",
    large: "text-lg py-4 px-8"
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
          <svg className="w-6 h-6 text-text-light/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`
            w-full ${sizeClasses[size]} pl-14 pr-4
            bg-surface-dark border-2 border-border-subtle
            rounded-2xl text-text-light
            placeholder:text-text-light/50
            focus:outline-none focus:border-accent-cool
            focus:ring-4 focus:ring-accent-cool/20
            transition-all duration-300
            hover:border-accent-cool/50
          `}
        />
      </div>

      {/* Submit button (optional, can submit on Enter) */}
      <button type="submit" className="sr-only">Search</button>
    </form>
  );
}
```

### Step 2: Add Example Queries Component (30 mins)
**File**: `components/ExampleQueries.tsx`

```typescript
"use client";

import { useRouter } from "next/navigation";

const EXAMPLE_QUERIES = [
  "What is product-market fit?",
  "Show me examples of growth strategies",
  "Explain the importance of user feedback",
  "Find videos about startup fundraising",
];

export function ExampleQueries() {
  const router = useRouter();

  const handleQueryClick = (query: string) => {
    router.push(`/chat?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4">
      <span className="text-sm text-text-light/60 mr-2">Try:</span>
      {EXAMPLE_QUERIES.map((query, i) => (
        <button
          key={i}
          onClick={() => handleQueryClick(query)}
          className="text-sm px-3 py-1 rounded-full border border-accent-cool/30 text-accent-cool hover:bg-accent-cool/10 hover:border-accent-cool/70 transition-all"
        >
          {query}
        </button>
      ))}
    </div>
  );
}
```

### Step 3: Update Homepage (30 mins)
**File**: `app/page.tsx`

Replace or enhance hero section:

```tsx
import { SearchBar } from "@/components/SearchBar";
import { ExampleQueries } from "@/components/ExampleQueries";

// In the hero section, after the tagline:
<div className="pt-8 space-y-4">
  <SearchBar size="large" />
  <ExampleQueries />
</div>

{/* Keep or remove existing CTA buttons based on design preference */}
```

### Step 4: Update Chat Page to Accept Query Param (30 mins)
**File**: `app/chat/page.tsx`

```typescript
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q');
  const [query, setQuery] = useState(initialQuery || '');

  useEffect(() => {
    if (initialQuery) {
      // Auto-submit query or pre-fill the input
      setQuery(initialQuery);
      // Optionally: auto-trigger the chat with this query
    }
  }, [initialQuery]);

  // Rest of chat implementation...
}
```

### Step 5: Add Search to Navigation (Optional, 15 mins)
**File**: `components/Navigation.tsx`

Add a small search icon that opens a modal or redirects to chat.

## Alternative: Floating Chat Widget

If you prefer a widget approach:

**File**: `components/ChatWidget.tsx`

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <Link
        href="/chat"
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-accent-cool to-accent-warm rounded-full shadow-glow-cool flex items-center justify-center hover:scale-110 transition-all z-50"
        aria-label="Open chat"
      >
        <svg className="w-6 h-6 text-primary-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </Link>
    </>
  );
}
```

Add to layout:
```tsx
// app/layout.tsx
import { ChatWidget } from "@/components/ChatWidget";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
```

## Design Considerations

### Search Bar Placement Options
1. **Hero Section** (Recommended)
   - Most prominent
   - Clear value prop
   - Immediate action

2. **Below Hero**
   - Less prominent but less intrusive
   - After user reads value props

3. **Sticky Header**
   - Available on all pages
   - Might clutter navigation

### UX Enhancements
- **Auto-complete**: Show suggested queries as user types
- **Recent searches**: Store in localStorage
- **Popular queries**: Show trending questions
- **Voice input**: Add mic icon for voice search

## Acceptance Criteria
- [ ] Search bar added to homepage hero section
- [ ] Example queries are clickable and work
- [ ] Clicking search redirects to `/chat` with query
- [ ] Chat page pre-fills with query param
- [ ] Mobile responsive design
- [ ] Keyboard navigation works (Enter to submit)
- [ ] Focus states are clear and accessible
- [ ] (Optional) Chat widget appears on all pages

## Dependencies
None (can implement independently)

## Files to Create/Modify

### New Files
- `components/SearchBar.tsx`
- `components/ExampleQueries.tsx`
- `components/ChatWidget.tsx` (if using widget)

### Modified Files
- `app/page.tsx` (add search bar to hero)
- `app/chat/page.tsx` (handle query param)
- `app/layout.tsx` (add widget if using that approach)

## Testing Checklist
- [ ] Search bar visible and prominent on homepage
- [ ] Typing and submitting works
- [ ] Query param passes to chat page correctly
- [ ] Example queries are clickable
- [ ] Mobile responsive (search bar fits on small screens)
- [ ] Keyboard accessible (Tab, Enter)
- [ ] Focus indicators visible
- [ ] Works on all browsers

## Analytics to Track
After implementation, track:
- Search bar usage vs button clicks
- Popular queries from homepage
- Conversion rate (search → actual chat interaction)
- Drop-off points

## Future Enhancements
- Auto-complete suggestions
- Search history
- Voice input
- Instant results preview
- Search within specific videos/concepts
