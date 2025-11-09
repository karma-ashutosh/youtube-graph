# Task 2: Segment-to-Blog Generation System

**Status**: ⚪ Not Started
**Priority**: P0 (Critical)
**Estimated Time**: 1-2 days

## Goal
Automatically generate SEO-friendly blog posts from segments and publish them to a CMS or database.

## Architecture Options

### Option A: Simple (Postgres + Next.js)
**Pros**: Keep everything in one place, no external dependencies
**Cons**: Manual SEO optimization

```
Segment URL → Fetch from Neo4j → Generate blog with LLM → Store in Postgres → Render at /blog/[slug]
```

### Option B: Headless CMS (Recommended)
**Options**: Ghost, Strapi, or Contentful
**Pros**: Built-in SEO, better editor, RSS feeds
**Cons**: Additional service to manage

## Implementation Plan

### Phase 1: Data Pipeline (2-4 hours)
1. **Create Blog Generation Service**
   - File: `lib/services/blog-generator.ts`
   - Function: `generateBlogFromSegment(segmentId: string)`
   - Fetch segment + video + concepts from Neo4j
   - Use Claude API to generate blog post

2. **LLM Prompt Template**
```
You are a technical writer. Create an SEO-optimized blog post from this video segment.

Segment: {topic_hint}
Transcript: {transcript}
Concepts: {concepts}
Video: {video_title}

Generate:
- SEO title (60 chars)
- Meta description (155 chars)
- Introduction paragraph
- Main content with headers (H2, H3)
- Key takeaways (bullet points)
- Conclusion with video timestamp link
- Tags/keywords

Format: Markdown
Tone: Educational, engaging
Length: 800-1200 words
```

3. **Database Schema** (if using Postgres)
```sql
CREATE TABLE blog_posts (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  meta_description TEXT,
  content TEXT NOT NULL,
  segment_id VARCHAR(255),
  video_id VARCHAR(255),
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  tags TEXT[]
);

CREATE INDEX idx_blog_slug ON blog_posts(slug);
CREATE INDEX idx_blog_published ON blog_posts(published_at);
```

### Phase 2: Publishing (2-3 hours)
1. **Create API Endpoint**
   - File: `app/api/blog/generate/route.ts`
   - POST endpoint: `/api/blog/generate`
   - Body: `{ segmentId, autoPublish: boolean }`

2. **Create Blog Pages**
   - File: `app/blog/page.tsx` (list all posts)
   - File: `app/blog/[slug]/page.tsx` (individual post)
   - Server-side rendering with metadata

3. **Admin Interface** (optional)
   - Add to `/upload` or create `/admin/blog`
   - List segments that don't have blog posts
   - "Generate Blog Post" button
   - Preview before publishing

### Phase 3: Automation (1-2 hours)
1. **Scheduled Generation**
   - Cron job or API route with cron trigger (Vercel Cron)
   - Generate blog post for new segments automatically
   - File: `app/api/cron/generate-blogs/route.ts`

2. **Webhook Integration**
   - Trigger blog generation when new segment is ingested
   - Add to existing ingestion flow

## CMS Recommendation: Ghost (Open Source)

**Why Ghost**:
- Self-hosted or Ghost(Pro) hosting
- Built-in SEO optimization
- REST API for publishing
- Free for self-hosted
- Clean markdown editor
- Automatic sitemap, RSS
- Newsletter integration

**Integration**:
```typescript
// lib/cms/ghost.ts
import GhostAdminAPI from '@tryghost/admin-api';

const api = new GhostAdminAPI({
  url: process.env.GHOST_URL,
  key: process.env.GHOST_ADMIN_KEY,
  version: 'v5.0'
});

export async function publishToGhost(post: BlogPost) {
  return await api.posts.add({
    title: post.title,
    html: markdownToHtml(post.content),
    tags: post.tags,
    meta_description: post.metaDescription,
    published_at: new Date(),
  });
}
```

## Acceptance Criteria
- [ ] Generate blog post from segment ID
- [ ] Store blog posts in database or CMS
- [ ] Render blog posts at `/blog/[slug]`
- [ ] Include video embed with timestamp
- [ ] Proper SEO meta tags
- [ ] Link back to segment and concepts
- [ ] List page showing all blog posts
- [ ] (Optional) Auto-generation on new segment ingestion

## Dependencies
- LLM API (Claude) for content generation
- Database schema changes OR Ghost setup
- Markdown to HTML converter

## Files to Create/Modify
- `lib/services/blog-generator.ts` (new)
- `lib/cms/ghost.ts` (new, if using Ghost)
- `app/api/blog/generate/route.ts` (new)
- `app/blog/page.tsx` (new)
- `app/blog/[slug]/page.tsx` (new)
- Database migration (if using Postgres)

## Decision Needed
**Choose between**:
- A) Simple Postgres solution (faster, less features)
- B) Ghost CMS (better SEO, more work to set up)

Recommendation: Start with Postgres (Option A), migrate to Ghost if needed later.
