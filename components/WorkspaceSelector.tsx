'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function WorkspaceSelectorInner() {
  const appMode = process.env.NEXT_PUBLIC_APP_MODE || 'internal';
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState('huberman_sleep_energy_optimize');
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for workspace in URL query parameter first
    const urlWorkspace = searchParams.get('workspace');

    if (urlWorkspace && /^[a-z0-9_]+$/.test(urlWorkspace)) {
      // Valid workspace in URL - use it and save to localStorage
      setCurrentWorkspace(urlWorkspace);
      localStorage.setItem('workspace', urlWorkspace);
    } else {
      // Load current workspace from localStorage
      const saved = localStorage.getItem('workspace');
      if (saved) {
        setCurrentWorkspace(saved);
      }
    }

    // Fetch available workspaces
    fetchWorkspaces();
  }, [searchParams]);

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces');
      const data = await response.json();
      setWorkspaces(data.workspaces || ['default']);
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
      setWorkspaces(['default']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkspaceChange = (workspace: string) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem('workspace', workspace);

    // Update URL with workspace query parameter
    const url = new URL(window.location.href);
    url.searchParams.set('workspace', workspace);
    window.location.href = url.toString();
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newWorkspaceName || !/^[a-z0-9_]+$/.test(newWorkspaceName)) {
      alert('Invalid workspace name. Only lowercase alphanumeric and underscores allowed.');
      return;
    }

    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace: newWorkspaceName }),
      });

      if (response.ok) {
        await fetchWorkspaces();
        setShowCreateForm(false);
        setNewWorkspaceName('');
        handleWorkspaceChange(newWorkspaceName);
      } else {
        const error = await response.json();
        alert(`Failed to create workspace: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create workspace:', error);
      alert('Failed to create workspace');
    }
  };

  if (isLoading) {
    return <div className="text-sm text-text-muted">Loading...</div>;
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="workspace-select" className="text-sm font-medium text-text-muted shrink-0">
        Workspace:
      </label>
      <select
        id="workspace-select"
        value={currentWorkspace}
        onChange={(e) => handleWorkspaceChange(e.target.value)}
        className="px-2 md:px-3 py-1.5 text-sm bg-surface-muted border border-border-subtle rounded-lg text-text-light focus:outline-none focus:ring-2 focus:ring-accent-cool/50 focus:border-accent-cool transition-all duration-200 hover:border-border-default"
      >
        {workspaces.map((ws) => (
          <option key={ws} value={ws} className="bg-surface-muted text-text-light">
            {ws}
          </option>
        ))}
      </select>

      {appMode === 'internal' && (
        !showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-3 py-1.5 text-sm bg-accent-cool/10 text-accent-cool rounded-lg hover:bg-accent-cool/20 transition-all duration-200 font-medium"
          >
            + New
          </button>
        ) : (
          <form onSubmit={handleCreateWorkspace} className="flex items-center gap-2">
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="workspace_name"
              className="px-3 py-1.5 text-sm bg-surface-elevated border border-border-subtle rounded-lg text-text-light placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cool/50 focus:border-accent-cool"
              pattern="[a-z0-9_]+"
              required
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-sm bg-accent-cool text-white rounded-lg hover:bg-accent-cool/80 transition-all duration-200 font-medium"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setNewWorkspaceName('');
              }}
              className="px-3 py-1.5 text-sm bg-surface-elevated border border-border-subtle text-text-light rounded-lg hover:bg-surface-muted transition-all duration-200"
            >
              Cancel
            </button>
          </form>
        )
      )}
    </div>
  );
}

export function WorkspaceSelector() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500">Loading...</div>}>
      <WorkspaceSelectorInner />
    </Suspense>
  );
}
