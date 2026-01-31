import { memo } from 'react';
import { LogEntry as LogEntryType } from '@/types/logs';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Brain, Copy, Check, Code, ChevronRight, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';

interface LogEntryProps {
  log: LogEntryType;
  searchTerm: string;
  onDiagnose?: (log: LogEntryType) => void;
}

function highlightText(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm) return text;

  // Split search term by spaces to support multi-word highlighting
  const terms = searchTerm.split(/\s+/).filter(t => t.length > 0);
  if (terms.length === 0) return text;

  const pattern = `(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
  const parts = text.split(new RegExp(pattern, 'gi'));

  return parts.map((part, i) => {
    const isMatch = terms.some(t => part.toLowerCase() === t.toLowerCase());
    return isMatch ? (
      <mark key={i} className="bg-primary/40 text-foreground rounded px-0.5 font-bold">{part}</mark>
    ) : part;
  });
}

export const LogEntryComponent = memo(function LogEntryComponent({ log, searchTerm, onDiagnose }: LogEntryProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const jsonContent = useMemo(() => {
    const trimmed = log.message.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(log.message);
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [log.message]);

  const levelBadgeClass = {
    error: 'text-log-error',
    warn: 'text-log-warn',
    info: 'text-log-info',
    debug: 'text-log-debug',
  }[log.level];

  const handleCopy = () => {
    navigator.clipboard.writeText(log.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const levelClassArr = {
    error: 'log-line-error',
    warn: 'log-line-warn',
    info: 'log-line-info',
    debug: 'log-line-debug',
  };
  const currentLevelClass = levelClassArr[log.level];

  return (
    <div className={cn("log-line group relative transition-colors hover:bg-muted/30", currentLevelClass, isExpanded && "bg-muted/20")}>
      <div className="flex items-start gap-3">
        {/* Timestamp */}
        <span className="log-timestamp shrink-0 text-xs opacity-70">
          {format(log.timestamp, 'HH:mm:ss.SSS')}
        </span>

        {/* Level Badge */}
        <span className={cn("shrink-0 w-12 text-xs font-semibold uppercase", levelBadgeClass)}>
          {log.level}
        </span>

        {/* Container & Namespace - hidden on very small screens */}
        <div className="hidden md:flex items-center gap-2 shrink-0 text-[10px] opacity-50 font-mono">
          <span className="log-namespace max-w-[80px] truncate">{log.namespace}</span>
          <span>/</span>
          <span className="log-container max-w-[80px] truncate">{log.container}</span>
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1">
            {jsonContent && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-1 p-0.5 hover:bg-muted rounded text-muted-foreground shrink-0"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
            <span className={cn(
              "text-foreground whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed",
              isExpanded ? "block" : "line-clamp-2 lg:line-clamp-none"
            )}>
              {highlightText(log.message, searchTerm)}
            </span>
          </div>

          {isExpanded && jsonContent && (
            <div className="mt-2 p-3 bg-card border border-border rounded-md overflow-x-auto">
              <pre className="text-xs font-mono text-foreground overflow-visible">
                {JSON.stringify(jsonContent, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Actions - visible on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1 bg-background/80 backdrop-blur-sm rounded px-1 border border-border shadow-sm">
          {jsonContent && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                "p-1 hover:bg-primary/10 rounded transition-colors",
                isExpanded ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"
              )}
              title="Pretty print JSON"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleCopy}
            className="p-1 hover:bg-primary/10 rounded transition-colors text-muted-foreground hover:text-primary"
            title="Copy log"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {log.level === 'error' && onDiagnose && (
            <button
              onClick={() => onDiagnose(log)}
              className="p-1 hover:bg-primary/10 rounded transition-colors text-muted-foreground hover:text-primary"
              title="AI Diagnose this error"
            >
              <Brain className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
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
