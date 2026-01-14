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

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0; // Scroll to top since logs are newest first
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop } = containerRef.current;
      setIsAtBottom(scrollTop < 10);
    }
  };

  const scrollToTop = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="flex-1 flex flex-col overflow-hidden">
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
                Live
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                Paused
              </>
            )}
          </button>
        </div>
      </div>

      {/* Log Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin bg-background"
      >
        {logs.map((log) => (
          <LogEntryComponent key={log.id} log={log} searchTerm={searchTerm} />
        ))}
      </div>

      {/* Scroll to Top Button */}
      {!isAtBottom && (
        <button
          onClick={scrollToTop}
          className="absolute bottom-6 right-6 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all animate-fade-in glow-primary"
        >
          <ArrowDown className="w-5 h-5 rotate-180" />
        </button>
      )}
    </div>
  );
}
