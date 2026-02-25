import { useRef, useEffect, useState } from 'react';
import { LogEntry } from '@/types/logs';
import { LogEntryComponent } from './LogEntry';
import { ArrowDown, Pause, Play, Download, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogListProps {
  logs: LogEntry[];
  searchTerm: string;
  onDiagnoseLog?: (log: LogEntry) => void;
  isStreamingPaused?: boolean;
  onToggleStreaming?: (paused: boolean) => void;
}

export function LogList({ logs, searchTerm, onDiagnoseLog, isStreamingPaused = false, onToggleStreaming }: LogListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewLogs, setHasNewLogs] = useState(false);
  const prevLogsCount = useRef(logs.length);
  const scrollPositionRef = useRef(0);

  // Enhanced scroll handling with better position preservation
  useEffect(() => {
    if (autoScroll && !isStreamingPaused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setHasNewLogs(false);
    } else if (logs.length > prevLogsCount.current) {
      if (!isAtBottom) {
        setHasNewLogs(true);
      }
      // Preserve scroll position when streaming is paused
      if (isStreamingPaused && containerRef.current) {
        containerRef.current.scrollTop = scrollPositionRef.current;
      }
    }
    prevLogsCount.current = logs.length;
  }, [logs, autoScroll, isAtBottom, isStreamingPaused]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // Store current scroll position for preservation
      scrollPositionRef.current = scrollTop;
      
      // Check if we're near the bottom (within 50px)
      const nearBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(nearBottom);

      if (nearBottom) {
        setHasNewLogs(false);
      }

      // Auto-pause streaming when user scrolls up from bottom
      if (!nearBottom && !isStreamingPaused && onToggleStreaming) {
        onToggleStreaming(true);
      }
    }
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setAutoScroll(true);
      setIsAtBottom(true);
      setHasNewLogs(false);
      // Resume streaming when jumping to bottom
      if (isStreamingPaused && onToggleStreaming) {
        onToggleStreaming(false);
      }
    }
  };

  const toggleStreaming = () => {
    if (onToggleStreaming) {
      onToggleStreaming(!isStreamingPaused);
      // If resuming streaming and auto-scroll is on, scroll to bottom
      if (isStreamingPaused && autoScroll) {
        scrollToBottom();
      }
    }
  };

  const handleExport = () => {
    const text = logs.map(l => `[${l.timestamp}] ${l.level.toUpperCase()} ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${logs[0]?.pod || 'k8s'}-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (logs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No logs to display</p>
          <p className="text-sm mt-1">Adjust your filters or wait for new logs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Showing <span className="text-foreground font-medium">{logs.length}</span> logs
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Streaming Control */}
          <button
            onClick={toggleStreaming}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border",
              isStreamingPaused
                ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                : "bg-success/10 text-success border-success/30 hover:bg-success/20"
            )}
          >
            {isStreamingPaused ? (
              <>
                <WifiOff className="w-3 h-3" />
                Streaming Paused
              </>
            ) : (
              <>
                <Wifi className="w-3 h-3 animate-pulse" />
                Streaming Live
              </>
            )}
          </button>

          {/* Auto-scroll Control */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              autoScroll
                ? "bg-primary/20 text-primary"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
            disabled={isStreamingPaused}
          >
            {autoScroll ? (
              <>
                <Play className="w-3 h-3" />
                Auto-scroll
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                Auto-scroll Off
              </>
            )}
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Download visible logs"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Log Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin bg-background p-0"
      >
        <div className="flex flex-col">
          {logs.map((log) => (
            <LogEntryComponent
              key={log.id}
              log={log}
              searchTerm={searchTerm}
              onDiagnose={onDiagnoseLog}
            />
          ))}
        </div>
      </div>

      {/* Scroll to Bottom Button - enhanced with streaming state awareness */}
      {(!isAtBottom || hasNewLogs) && (
        <button
          onClick={scrollToBottom}
          className={cn(
            "absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg transition-all z-50 flex items-center gap-2 font-medium text-sm animate-in fade-in slide-in-from-bottom-4 duration-300",
            hasNewLogs
              ? (isStreamingPaused 
                  ? "bg-orange-500 text-white scale-110 border-orange-500"
                  : "bg-primary text-primary-foreground scale-110 glow-primary border-primary")
              : "bg-background/80 backdrop-blur-md text-primary border border-primary/50 hover:bg-primary/10 hover:border-primary"
          )}
          title={isStreamingPaused ? "Resume streaming and jump to bottom" : "Jump to latest logs"}
        >
          {hasNewLogs ? (
            isStreamingPaused ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Resume & View New Logs
                <ArrowDown className="w-4 h-4" />
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-foreground"></span>
                </span>
                New logs below
                <ArrowDown className="w-4 h-4" />
              </>
            )
          ) : (
            <>
              Jump to latest
              <ArrowDown className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
