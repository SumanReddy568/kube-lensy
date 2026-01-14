import { Terminal, RefreshCw, Trash2, Download, Settings } from 'lucide-react';
import { FilterState } from '@/types/logs';
import { ConnectionStatus } from './ConnectionStatus';

interface HeaderProps {
  filters: FilterState;
  onRefresh: () => void;
  onClear: () => void;
  isLive: boolean;
  connected: boolean;
  loading: boolean;
  error: string | null;
  onRetryConnection: () => void;
}

export function Header({ 
  filters, 
  onRefresh, 
  onClear, 
  isLive, 
  connected, 
  loading, 
  error, 
  onRetryConnection 
}: HeaderProps) {
  const activeFilters = [
    filters.cluster,
    filters.namespace,
    filters.pod,
    filters.container,
  ].filter(Boolean);

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Terminal className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">KubeLog Viewer</h1>
              <p className="text-sm text-muted-foreground">Real-time Kubernetes log analysis</p>
            </div>
          </div>

          {/* Connection Status */}
          <ConnectionStatus 
            connected={connected}
            loading={loading}
            error={error}
            onRetry={onRetryConnection}
          />

          {/* Live indicator */}
          {isLive && connected && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-success/20 rounded-full">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-xs font-medium text-success">Streaming</span>
            </div>
          )}
        </div>

        {/* Active Filters Summary */}
        {activeFilters.length > 0 && (
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtered by:</span>
            {filters.cluster && (
              <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-md font-mono">
                {filters.cluster}
              </span>
            )}
            {filters.namespace && (
              <span className="px-2 py-1 bg-accent/20 text-accent text-xs rounded-md font-mono">
                {filters.namespace}
              </span>
            )}
            {filters.pod && (
              <span className="px-2 py-1 bg-info/20 text-info text-xs rounded-md font-mono truncate max-w-[200px]">
                {filters.pod}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={onClear}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            title="Export logs"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
