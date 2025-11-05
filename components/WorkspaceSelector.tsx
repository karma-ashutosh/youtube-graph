'use client';

import { useState, useEffect } from 'react';

export function WorkspaceSelector() {
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState('default');
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  useEffect(() => {
    // Load current workspace from localStorage
    const saved = localStorage.getItem('workspace');
    if (saved) {
      setCurrentWorkspace(saved);
    }

    // Fetch available workspaces
    fetchWorkspaces();
  }, []);

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
    // Reload to fetch new workspace data
    window.location.reload();
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
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="workspace-select" className="text-sm font-medium text-gray-700">
        Workspace:
      </label>
      <select
        id="workspace-select"
        value={currentWorkspace}
        onChange={(e) => handleWorkspaceChange(e.target.value)}
        className="px-3 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {workspaces.map((ws) => (
          <option key={ws} value={ws}>
            {ws}
          </option>
        ))}
      </select>

      {!showCreateForm ? (
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
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
            className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            pattern="[a-z0-9_]+"
            required
          />
          <button
            type="submit"
            className="px-2 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreateForm(false);
              setNewWorkspaceName('');
            }}
            className="px-2 py-1 text-sm bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
