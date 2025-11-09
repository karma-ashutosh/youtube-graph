# Task 3: Structured Data (JSON-LD)

**Status**: ⚪ Not Started
**Priority**: P1
**Estimated Time**: 3-4 hours

## Goal
Add Schema.org structured data to enable rich snippets in Google search results.

## What is JSON-LD?
JSON-LD is structured data that helps search engines understand your content. It enables:
- Video rich snippets with thumbnails and duration
- Breadcrumbs in search results
- Article/Blog post snippets
- FAQ sections

## Implementation Strategy

### 1. Video Pages (`app/videos/[id]/page.tsx`)

**Schema Type**: VideoObject
**Rich Snippet**: Video thumbnail, duration, upload date, description

```typescript
const videoSchema = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": video.title,
  "description": video.description || `Explore segments and concepts from ${video.title}`,
  "thumbnailUrl": `https://img.youtube.com/vi/${video.video_id}/maxresdefault.jpg`,
  "uploadDate": video.published_at,
  "duration": `PT${video.duration}S`, // ISO 8601 duration format
  "contentUrl": video.url,
  "embedUrl": `https://www.youtube.com/embed/${video.video_id}`,
  "interactionCount": video.segment_count,
};
```

Add to page:
```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema) }}
/>
```

### 2. Concept Pages (`app/concepts/[id]/page.tsx`)

**Schema Type**: Article or DefinedTerm
**Rich Snippet**: Concept definition, related content

```typescript
const conceptSchema = {
  "@context": "https://schema.org",
  "@type": "DefinedTerm",
  "name": concept.canonical_name,
  "description": `${concept.canonical_name} discussed across ${concept.total_mentions} video segments`,
  "inDefinedTermSet": concept.category,
  "termCode": concept.concept_id,
};
```

### 3. Blog Posts (`app/blog/[slug]/page.tsx`)

**Schema Type**: Article or BlogPosting
**Rich Snippet**: Author, publish date, featured image

```typescript
const blogSchema = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": post.title,
  "description": post.meta_description,
  "image": `https://img.youtube.com/vi/${post.video_id}/maxresdefault.jpg`,
  "datePublished": post.published_at,
  "dateModified": post.updated_at || post.published_at,
  "author": {
    "@type": "Organization",
    "name": "YouTube Knowledge Graph"
  },
  "publisher": {
    "@type": "Organization",
    "name": "YouTube Knowledge Graph",
    "logo": {
      "@type": "ImageObject",
      "url": "https://yoursite.com/logo.png"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": `https://yoursite.com/blog/${post.slug}`
  }
};
```

### 4. Homepage (`app/page.tsx`)

**Schema Type**: WebSite with SearchAction
**Rich Snippet**: Site search box in Google

```typescript
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "YouTube Knowledge Graph",
  "description": "Optimize learning from YouTube videos",
  "url": "https://yoursite.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://yoursite.com/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
};
```

### 5. Breadcrumbs (All pages)

**Schema Type**: BreadcrumbList
**Rich Snippet**: Breadcrumb trail in search results

```typescript
const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://yoursite.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Videos",
      "item": "https://yoursite.com/videos"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": video.title,
      "item": `https://yoursite.com/videos/${video.video_id}`
    }
  ]
};
```

## Implementation Steps

### Step 1: Create Helper Component (1 hour)
**File**: `components/StructuredData.tsx`

```typescript
export function StructuredData({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

### Step 2: Create Schema Generators (1 hour)
**File**: `lib/seo/schemas.ts`

```typescript
export function generateVideoSchema(video: Video) { ... }
export function generateConceptSchema(concept: Concept) { ... }
export function generateBlogSchema(post: BlogPost) { ... }
export function generateBreadcrumbs(items: BreadcrumbItem[]) { ... }
export function generateWebsiteSchema() { ... }
```

### Step 3: Add to Pages (1-2 hours)
Update each page to include structured data:
- Video pages
- Concept pages
- Blog pages (when implemented)
- Homepage

### Step 4: Testing (30 mins)
- Use [Google Rich Results Test](https://search.google.com/test/rich-results)
- Validate each page type
- Check for errors and warnings
- Use [Schema Markup Validator](https://validator.schema.org/)

## File Changes

### New Files
- `components/StructuredData.tsx`
- `lib/seo/schemas.ts`

### Modified Files
- `app/page.tsx` (add website schema)
- `app/videos/[id]/page.tsx` (add video schema + breadcrumbs)
- `app/concepts/[id]/page.tsx` (add concept schema + breadcrumbs)
- `app/blog/[slug]/page.tsx` (add article schema + breadcrumbs)

## Acceptance Criteria
- [ ] All page types have appropriate structured data
- [ ] Passes Google Rich Results Test
- [ ] No errors in Schema Validator
- [ ] Video thumbnails show in search results (can take weeks)
- [ ] Breadcrumbs render correctly in test tool

## Dependencies
- Task 2 (Blog System) should be completed first for blog schema
- Need site logo for publisher schema

## Testing Tools
- https://search.google.com/test/rich-results
- https://validator.schema.org/
- https://developers.facebook.com/tools/debug/ (for OG validation)

## Resources
- [Google Search Central - Structured Data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Schema.org](https://schema.org/)
- [VideoObject Schema](https://schema.org/VideoObject)
- [Article Schema](https://schema.org/Article)
