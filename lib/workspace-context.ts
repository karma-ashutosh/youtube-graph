import { AsyncLocalStorage } from 'async_hooks';

/**
 * AsyncLocalStorage for maintaining workspace context across async operations
 * This allows us to set the workspace once and access it anywhere in the call chain
 * without passing it as a parameter to every function.
 */
const workspaceStorage = new AsyncLocalStorage<string>();

/**
 * Get the current workspace from the async context
 * Returns 'default' if no workspace is set in the context
 */
export function getCurrentWorkspace(): string {
  return workspaceStorage.getStore() || 'default';
}

/**
 * Run a function within a workspace context
 * All nested function calls will have access to this workspace via getCurrentWorkspace()
 */
export function runWithWorkspace<T>(workspace: string, callback: () => T): T {
  if (!isValidWorkspace(workspace)) {
    throw new Error(`Invalid workspace name: ${workspace}`);
  }
  return workspaceStorage.run(workspace, callback);
}

/**
 * Run an async function within a workspace context
 * All nested async operations will have access to this workspace
 */
export async function runWithWorkspaceAsync<T>(
  workspace: string,
  callback: () => Promise<T>
): Promise<T> {
  if (!isValidWorkspace(workspace)) {
    throw new Error(`Invalid workspace name: ${workspace}`);
  }
  return workspaceStorage.run(workspace, callback);
}

/**
 * Validate workspace name
 * Only alphanumeric characters and underscores allowed
 */
export function isValidWorkspace(workspace: string): boolean {
  return /^[a-z0-9_]+$/.test(workspace);
}

/**
 * Get workspace from request headers or query parameters
 * Priority: X-Workspace header > workspace query param > default
 */
export function getWorkspaceFromRequest(request: Request): string {
  // Try header first
  const headerWorkspace = request.headers.get('X-Workspace');
  if (headerWorkspace) {
    return headerWorkspace;
  }

  // Try query parameter
  const url = new URL(request.url);
  const queryWorkspace = url.searchParams.get('workspace');
  if (queryWorkspace) {
    return queryWorkspace;
  }

  // Default workspace
  return 'default';
}

/**
 * Higher-order function to wrap API route handlers with workspace context
 * This ensures all database operations within the handler use the correct workspace
 *
 * Usage:
 * export const GET = withWorkspace(async (request: NextRequest) => {
 *   const concepts = await getAllConcepts(); // Automatically uses correct workspace
 *   return NextResponse.json(concepts);
 * });
 */
export function withWorkspace<T extends any[]>(
  handler: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    // Extract request from arguments (first argument for Next.js API routes)
    const request = args[0] as Request;
    const workspace = getWorkspaceFromRequest(request);

    // Run the handler within the workspace context
    return runWithWorkspaceAsync(workspace, () => handler(...args));
  };
}
