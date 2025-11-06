import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js middleware to extract workspace from requests
 * This runs before API routes and allows us to validate workspace names
 */
export function middleware(request: NextRequest) {
  // Only apply to API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    // Extract workspace from header or query param
    const headerWorkspace = request.headers.get('X-Workspace');
    const queryWorkspace = request.nextUrl.searchParams.get('workspace');
    const workspace = headerWorkspace || queryWorkspace || 'micro_conf';

    // Log workspace being used
    console.log(`[Middleware] ${request.method} ${request.nextUrl.pathname} → workspace: ${workspace} (header: ${headerWorkspace || 'none'}, query: ${queryWorkspace || 'none'})`);

    // Validate workspace name (alphanumeric and underscores only)
    if (!/^[a-z0-9_]+$/.test(workspace)) {
      return NextResponse.json(
        { error: `Invalid workspace name: ${workspace}` },
        { status: 400 }
      );
    }

    // Add workspace to request headers so it's available to API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('X-Workspace', workspace);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
