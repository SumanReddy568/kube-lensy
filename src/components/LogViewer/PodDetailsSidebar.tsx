import { useState, useEffect } from 'react';
import { X, Info, Activity, Clock, AlertTriangle } from 'lucide-react';
import { fetchPodDescribe, fetchPodEvents, PodEvent } from '@/services/kubernetesApi';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface PodDetailsSidebarProps {
    podName: string;
    namespace: string;
    onClose: () => void;
}

export function PodDetailsSidebar({ podName, namespace, onClose }: PodDetailsSidebarProps) {
    const [activeTab, setActiveTab] = useState<'describe' | 'events'>('events');
    const [describe, setDescribe] = useState<string>('');
    const [events, setEvents] = useState<PodEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            setError(null);
            try {
                const [desc, evts] = await Promise.all([
                    fetchPodDescribe(namespace, podName),
                    fetchPodEvents(namespace, podName)
                ]);
                setDescribe(desc);
                setEvents(evts);
            } catch (error) {
                console.error('Failed to load pod details:', error);
                setError('Failed to load details. The pod definitions or events might be unavailable.');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [podName, namespace]);

    return (
        <div className="w-[600px] md:w-[800px] max-w-full border-l border-border bg-card flex flex-col h-full animate-in slide-in-from-right duration-300 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2 overflow-hidden">
                    <Info className="w-5 h-5 text-primary flex-shrink-0" />
                    <h2 className="font-bold text-lg truncate" title={podName}>{podName}</h2>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-secondary rounded-md flex-shrink-0">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex border-b border-border shrink-0">
                <button
                    onClick={() => setActiveTab('events')}
                    className={cn(
                        "flex-1 py-2 text-sm font-medium transition-colors border-b-2",
                        activeTab === 'events' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Activity className="w-4 h-4" />
                        Events
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('describe')}
                    className={cn(
                        "flex-1 py-2 text-sm font-medium transition-colors border-b-2",
                        activeTab === 'describe' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        Describe
                    </div>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full text-destructive gap-2 text-center p-4">
                        <AlertTriangle className="w-8 h-8" />
                        <p className="font-medium">Error loading data</p>
                        <p className="text-sm opacity-80">{error}</p>
                    </div>
                ) : activeTab === 'describe' ? (
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground bg-secondary/30 p-4 rounded-lg overflow-x-hidden">
                        {describe || "No description available."}
                    </pre>
                ) : (
                    <div className="space-y-4">
                        {events.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                <Activity className="w-10 h-10 mb-2 opacity-20" />
                                <p>No events found for this pod.</p>
                            </div>
                        ) : (
                            events.map((event, i) => (
                                <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full",
                                                event.type === 'Warning' ? "bg-warning/20 text-warning" : "bg-info/20 text-info"
                                            )}>
                                                {event.reason}
                                            </span>
                                            {event.count > 1 && (
                                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    x{event.count}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                            {event.lastTimestamp
                                                ? `${formatDistanceToNow(new Date(event.lastTimestamp))} ago`
                                                : 'Recently'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-foreground mt-1 break-words leading-relaxed">{event.message}</p>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
