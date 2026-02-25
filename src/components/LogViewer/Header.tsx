import { useState, useEffect } from 'react';
import { Terminal, RefreshCw, Trash2, Info, Clock, Activity, CheckCircle, AlertTriangle, BarChart3, Bug, Brain } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { FilterState, Pod } from '@/types/logs';
import { ConnectionStatus } from './ConnectionStatus';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  filters: FilterState;
  onRefresh: () => void;
  onClear: () => void;
  onShowDetails?: () => void;
  isLive: boolean;
  connected: boolean;
  loading: boolean;
  error: string | null;
  onRetryConnection: () => void;
  lastUpdate?: number;
  selectedPod?: Pod;
  showErrorSummary?: boolean;
  onToggleErrorSummary?: () => void;
  errorCount?: number;
  showAIDiagnostics?: boolean;
  onToggleAIDiagnostics?: () => void;
  isStreamingPaused?: boolean;
}

export function Header({
  filters,
  onRefresh,
  onClear,
  onShowDetails,
  isLive,
  connected,
  loading,
  error,
  onRetryConnection,
  lastUpdate,
  selectedPod,
  showErrorSummary,
  onToggleErrorSummary,
  errorCount,
  showAIDiagnostics,
  onToggleAIDiagnostics,
  isStreamingPaused = false
}: HeaderProps) {
  const [pulseLive, setPulseLive] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (lastUpdate && lastUpdate > 0) {
      setPulseLive(true);
      const timer = setTimeout(() => setPulseLive(false), 500);
      return () => clearTimeout(timer);
    }
  }, [lastUpdate]);

  return (
    <header className="bg-card border-b border-border px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/20 rounded-lg" onClick={() => navigate('/debug-logs')} style={{ cursor: 'pointer' }} title="View Internal System Logs">
              <Terminal className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">KubeLensy</h1>
            </div>
          </div>

          <ConnectionStatus
            connected={connected}
            loading={loading}
            error={error}
            onRetry={onRetryConnection}
            lastUpdate={lastUpdate}
          />

          {isLive && connected && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-300",
              isStreamingPaused 
                ? "bg-orange-500/15 border-orange-500/30"
                : pulseLive 
                  ? "scale-105 bg-success/30 border-success/50" 
                  : "bg-success/15 border-success/30"
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]",
                isStreamingPaused 
                  ? "bg-orange-500 animate-pulse"
                  : pulseLive 
                    ? "bg-success animate-ping" 
                    : "bg-success animate-pulse"
              )} />
              <span className={cn(
                "text-[10px] uppercase tracking-wider font-bold",
                isStreamingPaused ? "text-orange-600" : "text-success"
              )}>
                {isStreamingPaused ? "Stream Paused" : "Live Source"}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {selectedPod && (
            <div className="hidden lg:flex items-center gap-4 mr-4 text-xs font-medium text-muted-foreground border-r border-border pr-4 bg-secondary/20 p-1.5 rounded-md">
              <div className="flex items-center gap-1.5" title="Ready Containers">
                <CheckCircle className="w-3.5 h-3.5 text-success" />
                <span>{selectedPod.ready || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5" title="Restart Count">
                <Activity className={cn("w-3.5 h-3.5", (selectedPod.restartCount || 0) > 0 ? "text-warning" : "text-muted-foreground")} />
                <span>{selectedPod.restartCount || 0} Restarts</span>
              </div>
              <div className="flex items-center gap-1.5" title="Age">
                <Clock className="w-3.5 h-3.5" />
                <span>{selectedPod.creationTimestamp ? formatDistanceToNow(new Date(selectedPod.creationTimestamp)) : 'Unknown'}</span>
              </div>
            </div>
          )}

          {filters.pod && (
            <button
              onClick={onShowDetails}
              className={cn(
                "px-3 py-1.5 flex items-center gap-2 rounded-lg transition-colors text-sm font-medium mr-2",
                "bg-secondary text-foreground hover:bg-secondary/80"
              )}
              title="Show pod details"
            >
              <Info className="w-4 h-4" />
              Pod Details
            </button>
          )}

          {filters.pod && filters.namespace && (
            <button
              onClick={() => navigate(`/metrics/${filters.namespace}/${filters.pod}`)}
              className={cn(
                "px-3 py-1.5 flex items-center gap-2 rounded-lg transition-colors text-sm font-medium mr-2",
                "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 shadow-sm"
              )}
              title="View CPU and Memory Metrics"
            >
              <Activity className="w-4 h-4" />
              Resources
            </button>
          )}

          <button
            onClick={onToggleErrorSummary}
            className={cn(
              "px-3 py-1.5 flex items-center gap-2 rounded-lg transition-colors text-sm font-medium mr-2 relative",
              showErrorSummary
                ? "bg-destructive/20 text-destructive border border-destructive/30"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            )}
            title="Show error summary"
          >
            <BarChart3 className="w-4 h-4" />
            Error Insights
            {errorCount !== undefined && errorCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white border-2 border-card">
                {errorCount > 99 ? '99+' : errorCount}
              </span>
            )}
          </button>
          <button
            onClick={onToggleAIDiagnostics}
            className={cn(
              "px-3 py-1.5 flex items-center gap-2 rounded-lg transition-colors text-sm font-medium mr-2",
              showAIDiagnostics
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            )}
            title="AI-Powered Diagnostics"
          >
            <Brain className="w-4 h-4" />
            K8s MCP
          </button>
          <button
            onClick={() => navigate('/debug-logs')}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="View Internal System Logs"
          >
            <Bug className="w-5 h-5" />
          </button>
          <button
            onClick={onRefresh}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            title="Refresh everything"
            disabled={loading}
          >
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin text-primary")} />
          </button>
          <button
            onClick={onClear}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
