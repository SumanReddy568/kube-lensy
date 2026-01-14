import { useRef, useEffect, useState } from 'react';
import { LogEntry } from '@/types/logs';
import { LogEntryComponent } from './LogEntry';
import { ArrowDown, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogListProps {
  logs: LogEntry[];
  searchTerm: string;
}

export function LogList({ logs, searchTerm }: LogListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewLogs, setHasNewLogs] = useState(false);
  const prevLogsCount = useRef(logs.length);

  // Scroll to bottom whenever logs change, if autoScroll is on
  useEffect(() => {
    if (logs.length > prevLogsCount.current) {
      if (autoScroll && containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      } else if (!isAtBottom) {
        setHasNewLogs(true);
      }
    }
    prevLogsCount.current = logs.length;
  }, [logs, autoScroll, isAtBottom]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // Check if we're near the bottom (within 50px)
      const nearBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(nearBottom);

      if (nearBottom) {
        setHasNewLogs(false);
      }
    }
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setAutoScroll(true);
      setIsAtBottom(true);
      setHasNewLogs(false);
    }
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
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              autoScroll
                ? "bg-primary/20 text-primary"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {autoScroll ? (
              <>
                <Play className="w-3 h-3" />
                Auto-scroll On
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                Auto-scroll Off
              </>
            )}
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
            <LogEntryComponent key={log.id} log={log} searchTerm={searchTerm} />
          ))}
        </div>
      </div>

      {/* Scroll to Bottom Button */}
      {(!isAtBottom || hasNewLogs) && (
        <button
          onClick={scrollToBottom}
          className={cn(
            "absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg transition-all z-50 flex items-center gap-2 font-medium text-sm animate-in fade-in slide-in-from-bottom-4 duration-300",
            hasNewLogs
              ? "bg-primary text-primary-foreground scale-110 glow-primary"
              : "bg-secondary text-muted-foreground hover:text-foreground opacity-80"
          )}
        >
          {hasNewLogs ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-foreground"></span>
              </span>
              New logs below
              <ArrowDown className="w-4 h-4" />
            </>
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
