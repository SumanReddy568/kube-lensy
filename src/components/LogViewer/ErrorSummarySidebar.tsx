import { useMemo } from 'react';
import { X, AlertCircle, Clock, ChevronRight, BarChart3 } from 'lucide-react';
import { LogEntry } from '@/types/logs';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ErrorSummarySidebarProps {
    logs: LogEntry[];
    appErrors?: Array<{ message: string; count: number; lastSeen: Date }>;
    onClose: () => void;
    onSelectError: (message: string) => void;
}

interface AggregatedError {
    message: string;
    count: number;
    lastSeen: Date;
    level: string;
}

export function ErrorSummarySidebar({ logs, appErrors, onClose, onSelectError }: ErrorSummarySidebarProps) {
    const aggregatedErrors = useMemo(() => {
        const errorMap = new Map<string, AggregatedError>();

        logs.forEach(log => {
            if (log.level === 'error' || log.level === 'warn') {
                // Simple normalization: truncate very long messages for the key
                const key = log.message.slice(0, 500);
                const existing = errorMap.get(key);

                if (existing) {
                    existing.count += 1;
                    if (log.timestamp > existing.lastSeen) {
                        existing.lastSeen = log.timestamp;
                    }
                } else {
                    errorMap.set(key, {
                        message: log.message,
                        count: 1,
                        lastSeen: log.timestamp,
                        level: log.level
                    });
                }
            }
        });

        return Array.from(errorMap.values())
            .sort((a, b) => b.count - a.count);
    }, [logs]);

    return (
        <div className="w-[450px] max-w-full border-l border-border bg-card flex flex-col h-full animate-in slide-in-from-right duration-300 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-destructive" />
                    <h2 className="font-bold text-lg">Error Insights</h2>
                    <span className="bg-destructive/10 text-destructive text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                        {aggregatedErrors.filter(e => e.level === 'error').length} Issues
                    </span>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-secondary rounded-md">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                {aggregatedErrors.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-3">
                        <AlertCircle className="w-12 h-12" />
                        <p className="text-sm font-medium">No errors detected in current logs.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-4 flex items-center gap-2">
                            <span>Frequency Analysis</span>
                            <div className="h-px flex-1 bg-border/50" />
                        </div>

                        {aggregatedErrors.map((error, idx) => (
                            <button
                                key={idx}
                                onClick={() => onSelectError(error.message)}
                                className="w-full text-left group p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 border border-border/50 transition-all active:scale-[0.98]"
                            >
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0",
                                        error.level === 'error' ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"
                                    )}>
                                        {error.level}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-foreground bg-background rounded px-2 py-0.5 border border-border/50 shadow-sm">
                                        <span className="text-muted-foreground">COUNT:</span>
                                        {error.count}
                                    </div>
                                </div>

                                <p className="text-xs font-mono text-foreground line-clamp-3 break-all mb-3 leading-relaxed">
                                    {error.message}
                                </p>

                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Last: {formatDistanceToNow(error.lastSeen)} ago
                                    </div>
                                    <div className="flex items-center gap-1 text-primary group-hover:translate-x-1 transition-transform">
                                        View in logs <ChevronRight className="w-3 h-3" />
                                    </div>
                                </div>
                            </button>
                        ))}

                        {appErrors && appErrors.length > 0 && (
                            <div className="mt-8 space-y-3">
                                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-4 flex items-center gap-2">
                                    <span>Application Events</span>
                                    <div className="h-px flex-1 bg-border/50" />
                                </div>
                                {appErrors.map((error, idx) => (
                                    <div key={idx} className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-destructive uppercase">System Error</span>
                                            <span className="text-[10px] font-mono font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                                                x{error.count}
                                            </span>
                                        </div>
                                        <p className="text-xs text-foreground font-medium mb-2">{error.message}</p>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Latest: {formatDistanceToNow(error.lastSeen)} ago
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
