# Task 1: OG Images with YouTube Thumbnails

**Status**: ⚪ Not Started
**Priority**: P1
**Estimated Time**: 2-3 hours

## Goal
Use YouTube video thumbnails as OpenGraph images for better social media sharing.

## Context
- YouTube provides thumbnails at: `https://img.youtube.com/vi/{video_id}/maxresdefault.jpg`
- We already use `mqdefault.jpg` on homepage
- Need to add dynamic OG image meta tags to video pages

## Implementation Steps

### 1. Convert Video Page to Server Component
**File**: `app/videos/[id]/page.tsx`

- Remove `"use client"` directive
- Use `async` function and fetch data server-side
- Generate metadata using `generateMetadata` function

```typescript
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const videoData = await fetch(...);
  return {
    title: `${video.title} | YouTube Knowledge Graph`,
    description: `Explore segments and concepts from this video`,
    openGraph: {
      images: [`https://img.youtube.com/vi/${params.id}/maxresdefault.jpg`],
    },
  };
}
```

### 2. Test Social Sharing
- Use [OpenGraph.xyz](https://www.opengraph.xyz/) or Facebook debugger
- Verify thumbnail shows correctly
- Test on Twitter, LinkedIn, Slack

### 3. Add to Other Pages
Apply same pattern to:
- `app/concepts/[id]/page.tsx` (use default placeholder or first video thumbnail)
- `app/segments/[id]/page.tsx` (extract video_id and use thumbnail)

## Acceptance Criteria
- [ ] Video pages show YouTube thumbnail when shared on social media
- [ ] Thumbnails load quickly (use maxresdefault or sddefault as fallback)
- [ ] Meta tags validated with OG debugger
- [ ] No client-side errors from server component conversion

## Dependencies
None

## Notes
- Use `maxresdefault.jpg` (1280x720) for best quality
- Fallback to `sddefault.jpg` (640x480) if maxres doesn't exist
- Consider adding text overlay in future (Phase 2)
