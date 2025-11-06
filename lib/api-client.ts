/**
 * Client-side API wrapper that automatically includes workspace context
 * All API calls will use the workspace stored in localStorage
 */

/**
 * Get the current workspace from localStorage
 */
export function getWorkspace(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('workspace') || 'micro_conf';
  }
  return 'micro_conf';
}

/**
 * Set the current workspace in localStorage
 */
export function setWorkspace(workspace: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('workspace', workspace);
  }
}

/**
 * GET request with automatic workspace header
 */
export async function apiGet<T = any>(path: string): Promise<T> {
  const workspace = getWorkspace();
  const response = await fetch(path, {
    headers: {
      'X-Workspace': workspace,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * POST request with automatic workspace header
 */
export async function apiPost<T = any>(path: string, body: any): Promise<T> {
  const workspace = getWorkspace();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace': workspace,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * PUT request with automatic workspace header
 */
export async function apiPut<T = any>(path: string, body: any): Promise<T> {
  const workspace = getWorkspace();
  const response = await fetch(path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace': workspace,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * DELETE request with automatic workspace header
 */
export async function apiDelete<T = any>(path: string): Promise<T> {
  const workspace = getWorkspace();
  const response = await fetch(path, {
    method: 'DELETE',
    headers: {
      'X-Workspace': workspace,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Generic fetch with automatic workspace header
 * For custom requests that need more control
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const workspace = getWorkspace();
  const headers = new Headers(options.headers);
  headers.set('X-Workspace', workspace);

  return fetch(path, {
    ...options,
    headers,
  });
}
