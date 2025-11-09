# Task 4: Sitemap Generation

**Status**: ⚪ Not Started
**Priority**: P1
**Estimated Time**: 2-3 hours

## Goal
Generate XML sitemap for search engine crawlers to discover all pages on the site.

## What is a Sitemap?
A sitemap.xml file tells search engines about all URLs on your site, their update frequency, and priority. It helps with:
- Faster indexing of new content
- Better crawl efficiency
- Discovering deep pages

## Next.js Implementation

Next.js 13+ App Router provides built-in sitemap generation.

### Option A: Static Sitemap (Simple)
**File**: `app/sitemap.ts`

```typescript
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://yoursite.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://yoursite.com/videos',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: 'https://yoursite.com/concepts',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://yoursite.com/chat',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];
}
```

### Option B: Dynamic Sitemap (Recommended)
Fetch all videos, concepts, and blogs from database to generate comprehensive sitemap.

**File**: `app/sitemap.ts`

```typescript
import { MetadataRoute } from 'next';
import { apiGet } from '@/lib/api-client';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://yoursite.com';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/videos`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/concepts`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/chat`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  // Fetch all videos
  const videosData = await apiGet<{ videos: any[] }>('/api/videos');
  const videoPages: MetadataRoute.Sitemap = videosData.videos.map((video) => ({
    url: `${baseUrl}/videos/${video.video_id}`,
    lastModified: new Date(video.created_at || Date.now()),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Fetch all concepts
  const conceptsData = await apiGet<{ concepts: any[] }>('/api/concepts');
  const conceptPages: MetadataRoute.Sitemap = conceptsData.concepts
    .filter(c => c.has_primary && c.has_details) // Only include quality concepts
    .map((concept) => ({
      url: `${baseUrl}/concepts/${concept.concept_id}`,
      lastModified: new Date(concept.last_mentioned || Date.now()),
      changeFrequency: 'monthly',
      priority: 0.6,
    }));

  // Fetch blog posts (if implemented)
  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const blogsData = await apiGet<{ posts: any[] }>('/api/blog');
    blogPages = blogsData.posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.published_at),
      changeFrequency: 'monthly',
      priority: 0.7,
    }));
  } catch {
    // Blog not implemented yet, skip
  }

  return [...staticPages, ...videoPages, ...conceptPages, ...blogPages];
}
```

## Implementation Steps

### Step 1: Add Environment Variable (5 mins)
**File**: `.env.local`

```bash
NEXT_PUBLIC_BASE_URL=https://yoursite.com
```

### Step 2: Create Sitemap File (30 mins)
**File**: `app/sitemap.ts`

- Implement dynamic sitemap generation
- Fetch all entities from APIs
- Set appropriate priorities and change frequencies

### Step 3: Create robots.txt (15 mins)
**File**: `app/robots.ts`

```typescript
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://yoursite.com';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

### Step 4: Optimize for Large Sites (1 hour, optional)
If you have >50,000 URLs, implement sitemap index.

**File**: `app/sitemap/[type]/route.ts`

Create multiple sitemaps:
- `/sitemap/videos.xml`
- `/sitemap/concepts.xml`
- `/sitemap/blogs.xml`

Main sitemap references these.

### Step 5: Testing (30 mins)
1. Visit `http://localhost:3000/sitemap.xml`
2. Verify all URLs are present
3. Check formatting is valid XML
4. Use [XML Sitemap Validator](https://www.xml-sitemaps.com/validate-xml-sitemap.html)

### Step 6: Submit to Search Engines (30 mins)
1. **Google Search Console**
   - Add property
   - Submit sitemap URL
   - Monitor indexing status

2. **Bing Webmaster Tools**
   - Add site
   - Submit sitemap

## Priority Guidelines

| Page Type | Priority | Change Frequency | Reasoning |
|-----------|----------|------------------|-----------|
| Homepage | 1.0 | Daily | Most important page |
| Videos List | 0.9 | Daily | Frequently updated |
| Video Detail | 0.8 | Weekly | Core content |
| Concepts List | 0.8 | Weekly | Important discovery |
| Concept Detail | 0.6 | Monthly | Reference content |
| Blog Posts | 0.7 | Monthly | SEO content |
| Chat | 0.5 | Monthly | Tool, not discoverable |

## File Changes

### New Files
- `app/sitemap.ts`
- `app/robots.ts`

### Modified Files
- `.env.local` (add NEXT_PUBLIC_BASE_URL)

## Acceptance Criteria
- [ ] Sitemap accessible at `/sitemap.xml`
- [ ] Includes all videos, concepts, and blog posts
- [ ] robots.txt references sitemap
- [ ] Valid XML format
- [ ] Submitted to Google Search Console
- [ ] Submitted to Bing Webmaster Tools
- [ ] No crawl errors in search console

## Dependencies
- All APIs must return complete lists (videos, concepts, blogs)
- Base URL configured in environment

## Performance Considerations
- Sitemap is generated at build time (SSG)
- For very large sites (>10k URLs), use sitemap index
- Consider caching API responses during build
- Use ISR (Incremental Static Regeneration) if content updates frequently

## Testing Checklist
- [ ] Sitemap loads at `/sitemap.xml`
- [ ] robots.txt loads at `/robots.txt`
- [ ] All video URLs present
- [ ] All concept URLs present (filtered quality ones)
- [ ] Blog URLs present (if implemented)
- [ ] Valid XML syntax
- [ ] Correct base URL
- [ ] No 404 errors in URLs

## Post-Deployment
1. Monitor Google Search Console for indexing progress
2. Check for crawl errors weekly
3. Re-submit sitemap after major content updates
4. Track indexed pages vs total pages

## Resources
- [Next.js Sitemap Docs](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [Google Search Console](https://search.google.com/search-console)
- [Bing Webmaster Tools](https://www.bing.com/webmasters)
- [Sitemap Protocol](https://www.sitemaps.org/protocol.html)
