/**
 * Workspace Resource Naming Utility
 *
 * This module provides standardized naming conventions and resource identification
 * utilities to ensure proper segregation of resources (concepts, segments, videos, etc.)
 * across different workspaces.
 *
 * @module workspace-resource
 */

import { getCurrentWorkspace } from './workspace-context';

/**
 * Resource types that can be namespaced by workspace
 */
export type ResourceType = 'concept' | 'segment' | 'video' | 'example' | 'idea';

/**
 * Options for workspace-aware resource identification
 */
export interface WorkspaceResourceOptions {
  /** The workspace to use (defaults to current workspace) */
  workspace?: string;
  /** Whether to include workspace prefix in the ID */
  usePrefix?: boolean;
}

/**
 * Parse a workspace-prefixed resource ID
 *
 * @param resourceId - The resource ID (with or without workspace prefix)
 * @returns Object containing workspace and the unprefixed ID
 *
 * @example
 * parseWorkspaceResourceId('micro_conf:product_market_fit')
 * // Returns: { workspace: 'micro_conf', id: 'product_market_fit', hasPrefix: true }
 *
 * parseWorkspaceResourceId('product_market_fit')
 * // Returns: { workspace: null, id: 'product_market_fit', hasPrefix: false }
 */
export function parseWorkspaceResourceId(resourceId: string): {
  workspace: string | null;
  id: string;
  hasPrefix: boolean;
} {
  const parts = resourceId.split(':');

  if (parts.length === 2) {
    return {
      workspace: parts[0],
      id: parts[1],
      hasPrefix: true,
    };
  }

  return {
    workspace: null,
    id: resourceId,
    hasPrefix: false,
  };
}

/**
 * Create a workspace-prefixed resource ID
 *
 * @param resourceId - The base resource ID (without workspace)
 * @param workspace - The workspace (defaults to current workspace)
 * @returns Workspace-prefixed resource ID
 *
 * @example
 * // With current workspace 'micro_conf'
 * createWorkspaceResourceId('product_market_fit')
 * // Returns: 'micro_conf:product_market_fit'
 *
 * createWorkspaceResourceId('segment_123', 'my_workspace')
 * // Returns: 'my_workspace:segment_123'
 */
export function createWorkspaceResourceId(
  resourceId: string,
  workspace?: string
): string {
  const ws = workspace || getCurrentWorkspace();

  // If already prefixed, return as-is
  const parsed = parseWorkspaceResourceId(resourceId);
  if (parsed.hasPrefix) {
    return resourceId;
  }

  return `${ws}:${resourceId}`;
}

/**
 * Get the unprefixed resource ID (strip workspace prefix if present)
 *
 * @param resourceId - The resource ID (with or without workspace prefix)
 * @returns The resource ID without workspace prefix
 *
 * @example
 * getUnprefixedResourceId('micro_conf:product_market_fit')
 * // Returns: 'product_market_fit'
 *
 * getUnprefixedResourceId('product_market_fit')
 * // Returns: 'product_market_fit'
 */
export function getUnprefixedResourceId(resourceId: string): string {
  const parsed = parseWorkspaceResourceId(resourceId);
  return parsed.id;
}

/**
 * Validate that a resource belongs to the specified workspace
 *
 * @param resourceId - The resource ID to validate
 * @param expectedWorkspace - The expected workspace (defaults to current workspace)
 * @returns True if the resource belongs to the workspace
 *
 * @example
 * // With current workspace 'micro_conf'
 * validateResourceWorkspace('micro_conf:product_market_fit')
 * // Returns: true
 *
 * validateResourceWorkspace('other_workspace:product_market_fit')
 * // Returns: false
 *
 * // Without prefix, always returns true (assumes correct workspace context)
 * validateResourceWorkspace('product_market_fit')
 * // Returns: true
 */
export function validateResourceWorkspace(
  resourceId: string,
  expectedWorkspace?: string
): boolean {
  const parsed = parseWorkspaceResourceId(resourceId);

  // If no prefix, assume it's in the correct workspace context
  if (!parsed.hasPrefix) {
    return true;
  }

  const expected = expectedWorkspace || getCurrentWorkspace();
  return parsed.workspace === expected;
}

/**
 * Build standardized Neo4j match parameters for workspace-aware queries
 *
 * @param resourceId - The resource ID (with or without workspace prefix)
 * @param resourceType - The type of resource (for error messages)
 * @returns Object with workspace and id for Neo4j query parameters
 *
 * @example
 * // With current workspace 'micro_conf'
 * buildResourceMatchParams('product_market_fit', 'concept')
 * // Returns: { workspace: 'micro_conf', id: 'product_market_fit' }
 *
 * buildResourceMatchParams('micro_conf:product_market_fit', 'concept')
 * // Returns: { workspace: 'micro_conf', id: 'product_market_fit' }
 *
 * // Throws error if workspace mismatch:
 * buildResourceMatchParams('other_workspace:product_market_fit', 'concept')
 * // Throws: Error('Resource other_workspace:product_market_fit does not belong to workspace micro_conf')
 */
export function buildResourceMatchParams(
  resourceId: string,
  resourceType: ResourceType
): {
  workspace: string;
  id: string;
} {
  const parsed = parseWorkspaceResourceId(resourceId);
  const currentWorkspace = getCurrentWorkspace();

  // If prefixed, validate it matches current workspace
  if (parsed.hasPrefix && parsed.workspace !== currentWorkspace) {
    throw new Error(
      `Resource ${resourceId} does not belong to workspace ${currentWorkspace}`
    );
  }

  return {
    workspace: currentWorkspace,
    id: parsed.id,
  };
}

/**
 * Create a scoped resource identifier for use in Neo4j queries
 * This is the recommended way to construct match clauses for workspace-aware queries
 *
 * @param resourceType - The type of resource
 * @param resourceId - The resource ID (with or without workspace prefix)
 * @returns Match parameters object for Neo4j query
 *
 * @example
 * const params = createScopedResourceId('concept', 'product_market_fit');
 * await session.run(`
 *   MATCH (c:Concept {workspace: $workspace, concept_id: $id})
 *   RETURN c
 * `, params);
 */
export function createScopedResourceId(
  resourceType: ResourceType,
  resourceId: string
): {
  workspace: string;
  id: string;
} {
  return buildResourceMatchParams(resourceId, resourceType);
}

/**
 * Utility to ensure consistent naming across the application
 * Converts a name to a valid slug format (lowercase, underscores, no special chars)
 *
 * @param name - The name to convert
 * @returns Slug-formatted string
 *
 * @example
 * toResourceSlug('Product-Market Fit')
 * // Returns: 'product_market_fit'
 *
 * toResourceSlug('Multi  Spaces!!!')
 * // Returns: 'multi_spaces'
 */
export function toResourceSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Generate a unique timestamped ID
 * Useful for creating IDs for examples, key ideas, etc.
 *
 * @param prefix - Optional prefix for the ID
 * @returns Unique ID string
 *
 * @example
 * generateUniqueId('example')
 * // Returns: 'example_1699123456789_abc123def'
 *
 * generateUniqueId()
 * // Returns: '1699123456789_abc123def'
 */
export function generateUniqueId(prefix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);

  if (prefix) {
    return `${prefix}_${timestamp}_${random}`;
  }

  return `${timestamp}_${random}`;
}

/**
 * Helper to create workspace-scoped Cypher query fragments
 *
 * @param nodeLabel - The Neo4j node label
 * @param idField - The field name for the ID
 * @returns Object with Cypher fragment and parameter names
 *
 * @example
 * const query = createWorkspaceMatchFragment('Concept', 'concept_id');
 * // Returns: {
 * //   fragment: 'workspace: $workspace, concept_id: $id',
 * //   paramNames: { workspace: 'workspace', id: 'id' }
 * // }
 *
 * // Usage in query:
 * `MATCH (c:Concept {${query.fragment}}) RETURN c`
 */
export function createWorkspaceMatchFragment(
  nodeLabel: string,
  idField: string
): {
  fragment: string;
  paramNames: { workspace: string; id: string };
} {
  return {
    fragment: `workspace: $workspace, ${idField}: $id`,
    paramNames: {
      workspace: 'workspace',
      id: 'id',
    },
  };
}
