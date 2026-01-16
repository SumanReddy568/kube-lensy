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

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const [desc, evts] = await Promise.all([
                    fetchPodDescribe(namespace, podName),
                    fetchPodEvents(namespace, podName)
                ]);
                setDescribe(desc);
                setEvents(evts);
            } catch (error) {
                console.error('Failed to load pod details:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [podName, namespace]);

    return (
        <div className="w-[500px] border-l border-border bg-card flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-primary" />
                    <h2 className="font-bold text-lg truncate max-w-[350px]">{podName}</h2>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-secondary rounded-md">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex border-b border-border">
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
                ) : activeTab === 'describe' ? (
                    <pre className="text-xs font-mono whitespace-pre-wrap text-foreground bg-secondary/30 p-4 rounded-lg">
                        {describe}
                    </pre>
                ) : (
                    <div className="space-y-4">
                        {events.length === 0 ? (
                            <p className="text-center text-muted-foreground mt-10">No events found for this pod.</p>
                        ) : (
                            events.map((event, i) => (
                                <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={cn(
                                            "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full",
                                            event.type === 'Warning' ? "bg-warning/20 text-warning" : "bg-info/20 text-info"
                                        )}>
                                            {event.reason}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {formatDistanceToNow(new Date(event.lastTimestamp))} ago
                                        </span>
                                    </div>
                                    <p className="text-xs text-foreground mt-1">{event.message}</p>
                                    {event.count > 1 && (
                                        <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                                            <AlertTriangle className="w-3 h-3" />
                                            Repeated {event.count} times
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
