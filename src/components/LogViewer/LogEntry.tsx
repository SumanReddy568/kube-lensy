import { memo } from 'react';
import { LogEntry as LogEntryType } from '@/types/logs';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface LogEntryProps {
  log: LogEntryType;
  searchTerm: string;
}

function highlightText(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm) return text;
  
  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
  
  return parts.map((part, i) => 
    part.toLowerCase() === searchTerm.toLowerCase() ? (
      <mark key={i} className="bg-primary/40 text-foreground rounded px-0.5">{part}</mark>
    ) : part
  );
}

export const LogEntryComponent = memo(function LogEntryComponent({ log, searchTerm }: LogEntryProps) {
  const levelClass = {
    error: 'log-line-error',
    warn: 'log-line-warn',
    info: 'log-line-info',
    debug: 'log-line-debug',
  }[log.level];

  const levelBadgeClass = {
    error: 'text-log-error',
    warn: 'text-log-warn',
    info: 'text-log-info',
    debug: 'text-log-debug',
  }[log.level];

  return (
    <div className={cn("log-line group", levelClass)}>
      <div className="flex items-start gap-3">
        {/* Timestamp */}
        <span className="log-timestamp shrink-0 text-xs">
          {format(log.timestamp, 'HH:mm:ss.SSS')}
        </span>
        
        {/* Level Badge */}
        <span className={cn("shrink-0 w-12 text-xs font-semibold uppercase", levelBadgeClass)}>
          {log.level}
        </span>
        
        {/* Container & Namespace - shown on hover or always on larger screens */}
        <div className="hidden lg:flex items-center gap-2 shrink-0 text-xs">
          <span className="log-namespace">{log.namespace}</span>
          <span className="text-muted-foreground">/</span>
          <span className="log-container">{log.container}</span>
        </div>
        
        {/* Message */}
        <span className="flex-1 text-foreground break-all">
          {highlightText(log.message, searchTerm)}
        </span>
      </div>
      
      {/* Mobile metadata - shown below on smaller screens */}
      <div className="lg:hidden mt-1 ml-[88px] text-xs text-muted-foreground">
        <span className="log-namespace">{log.namespace}</span>
        <span className="mx-1">/</span>
        <span className="log-container">{log.container}</span>
      </div>
    </div>
  );
});
