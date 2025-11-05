'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';

interface WorkspaceInfo {
  name: string;
  isCurrent: boolean;
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState('default');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspaces();
    const saved = localStorage.getItem('workspace') || 'default';
    setCurrentWorkspace(saved);
  }, []);

  const loadWorkspaces = async () => {
    try {
      setIsLoading(true);
      const data = await fetch('/api/workspaces').then(r => r.json());
      const workspaceList: WorkspaceInfo[] = (data.workspaces || ['default']).map((name: string) => ({
        name,
        isCurrent: name === (localStorage.getItem('workspace') || 'default'),
      }));
      setWorkspaces(workspaceList);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newWorkspaceName || !/^[a-z0-9_]+$/.test(newWorkspaceName)) {
      setError('Invalid workspace name. Only lowercase alphanumeric and underscores allowed.');
      return;
    }

    try {
      setError(null);
      await apiPost('/api/workspaces', { workspace: newWorkspaceName });
      setNewWorkspaceName('');
      await loadWorkspaces();
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace');
    }
  };

  const handleDeleteWorkspace = async (workspace: string) => {
    if (workspace === 'default') {
      setError('Cannot delete the default workspace');
      return;
    }

    if (workspace === currentWorkspace) {
      setError('Cannot delete the currently active workspace. Switch to another workspace first.');
      return;
    }

    if (!confirm(`Are you sure you want to delete workspace "${workspace}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      await apiDelete(`/api/workspaces/${workspace}`);
      await loadWorkspaces();
    } catch (err: any) {
      setError(err.message || 'Failed to delete workspace');
    }
  };

  const handleSwitchWorkspace = (workspace: string) => {
    localStorage.setItem('workspace', workspace);
    setCurrentWorkspace(workspace);
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-text-light">Loading workspaces...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-text-light mb-8">Workspace Management</h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Create New Workspace */}
      <div className="bg-surface-dark border border-border-subtle rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-text-light mb-4">Create New Workspace</h2>
        <form onSubmit={handleCreateWorkspace} className="flex gap-3">
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="workspace_name"
            pattern="[a-z0-9_]+"
            className="flex-1 px-4 py-2 bg-primary-dark border border-border-subtle rounded-lg text-text-light focus:outline-none focus:ring-2 focus:ring-accent-cool"
            required
          />
          <button
            type="submit"
            className="px-6 py-2 bg-accent-cool text-white rounded-lg hover:bg-accent-cool/80 transition-colors"
          >
            Create
          </button>
        </form>
        <p className="text-sm text-text-muted mt-2">
          Workspace names can only contain lowercase letters, numbers, and underscores.
        </p>
      </div>

      {/* Existing Workspaces */}
      <div className="bg-surface-dark border border-border-subtle rounded-lg p-6">
        <h2 className="text-xl font-semibold text-text-light mb-4">Existing Workspaces</h2>
        <div className="space-y-3">
          {workspaces.map((workspace) => (
            <div
              key={workspace.name}
              className="flex items-center justify-between p-4 bg-primary-dark border border-border-subtle rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-text-light font-medium">{workspace.name}</span>
                {workspace.name === currentWorkspace && (
                  <span className="px-2 py-1 text-xs bg-accent-cool/20 text-accent-cool rounded-full border border-accent-cool">
                    Current
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {workspace.name !== currentWorkspace && (
                  <button
                    onClick={() => handleSwitchWorkspace(workspace.name)}
                    className="px-4 py-2 text-sm bg-accent-cool/10 text-accent-cool rounded-lg hover:bg-accent-cool/20 transition-colors"
                  >
                    Switch
                  </button>
                )}
                {workspace.name !== 'default' && workspace.name !== currentWorkspace && (
                  <button
                    onClick={() => handleDeleteWorkspace(workspace.name)}
                    className="px-4 py-2 text-sm bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-8 bg-surface-dark border border-border-subtle rounded-lg p-6">
        <h2 className="text-xl font-semibold text-text-light mb-4">About Workspaces</h2>
        <div className="text-text-muted space-y-2">
          <p>
            Workspaces provide complete data isolation for different knowledge domains. Each workspace maintains its own:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Videos, segments, and concepts</li>
            <li>Vector embeddings and search indices</li>
            <li>Relationships and graph structure</li>
          </ul>
          <p className="mt-4">
            Use workspaces to separate content from different domains (e.g., "health", "ecommerce", "finance")
            to prevent concept collisions and ensure accurate search results.
          </p>
        </div>
      </div>
    </div>
  );
}
