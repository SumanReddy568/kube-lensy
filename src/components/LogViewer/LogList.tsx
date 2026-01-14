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

  // Scroll to bottom whenever logs change, if autoScroll is on
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // Check if we're near the bottom (within 20px)
      const nearBottom = scrollHeight - scrollTop - clientHeight < 20;
      setIsAtBottom(nearBottom);

      // If the user scrolls up, disable auto-scroll
      if (!nearBottom && autoScroll) {
        // We only disable if it was a manual scroll up
        // (Optional: you can keep it simple and just let users toggle it)
      }
    }
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setAutoScroll(true);
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
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-6 right-6 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all animate-fade-in glow-primary z-50"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
