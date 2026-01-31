import { useState, useEffect } from 'react';
import { X, Info, Activity, Clock, AlertTriangle, ChevronDown, ChevronRight, Box, Shield, Zap, Layout, FileText, Database, Tag } from 'lucide-react';
import { fetchPodDescribe, fetchPodEvents, PodEvent } from '@/services/kubernetesApi';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { parseK8sDescribe, DescribeSection } from '@/lib/k8s-parser';
import { Badge } from '@/components/ui/badge';

interface PodDetailsSidebarProps {
    podName: string;
    namespace: string;
    onClose: () => void;
}

export function PodDetailsSidebar({ podName, namespace, onClose }: PodDetailsSidebarProps) {
    const [activeTab, setActiveTab] = useState<'describe' | 'events'>('describe');
    const [describe, setDescribe] = useState<string>('');
    const [describeSections, setDescribeSections] = useState<DescribeSection[]>([]);
    const [events, setEvents] = useState<PodEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'Common Metadata': true,
        'Labels': true,
        'Status': true,
        'Containers': true,
        'Conditions': true
    });

    const toggleSection = (title: string) => {
        setExpandedSections(prev => ({ ...prev, [title]: !prev[title] }));
    };

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            setError(null);
            try {
                const [desc, evts] = await Promise.all([
                    fetchPodDescribe(namespace, podName),
                    fetchPodEvents(namespace, podName)
                ]);
                setDescribe(desc || '');
                setDescribeSections(parseK8sDescribe(desc || ''));
                setEvents(evts || []);
            } catch (error) {
                console.error('Failed to load pod details:', error);
                setError('Failed to load details. The pod definitions or events might be unavailable.');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [podName, namespace]);

    const getSectionIcon = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes('metadata')) return <Info className="w-3.5 h-3.5" />;
        if (t.includes('container')) return <Box className="w-3.5 h-3.5" />;
        if (t.includes('condition')) return <Activity className="w-3.5 h-3.5" />;
        if (t.includes('label') || t.includes('annotation') || t.includes('tag')) return <Tag className="w-3.5 h-3.5" />;
        if (t.includes('volume')) return <Database className="w-3.5 h-3.5" />;
        if (t.includes('event')) return <FileText className="w-3.5 h-3.5" />;
        if (t.includes('status')) return <Zap className="w-3.5 h-3.5" />;
        if (t.includes('toleration') || t.includes('selector')) return <Shield className="w-3.5 h-3.5" />;
        return <Layout className="w-3.5 h-3.5" />;
    };

    const renderValue = (key: string, value: string) => {
        const lowerKey = key.toLowerCase();
        const lowerValue = value.toLowerCase();

        if (lowerKey === 'status' || lowerKey.includes('phase')) {
            const isRunning = lowerValue.includes('running') || lowerValue.includes('succeeded');
            const isError = lowerValue.includes('error') || lowerValue.includes('fail') || lowerValue.includes('crash');
            return (
                <Badge variant={isRunning ? "default" : isError ? "destructive" : "secondary"} className="font-mono text-[10px] uppercase">
                    {value}
                </Badge>
            );
        }

        if (lowerKey === 'node' && value.includes('/')) {
            const [nodeName, nodeIp] = value.split('/');
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{nodeName}</span>
                    <span className="text-[10px] opacity-60 italic">{nodeIp}</span>
                </div>
            );
        }

        return value;
    };

    const renderLabels = (content: string) => {
        const lines = content.split('\n').filter(l => l.trim());
        return (
            <div className="flex flex-wrap gap-1.5 p-3">
                {lines.map((line, idx) => {
                    const [k, v] = line.split('=');
                    return (
                        <div key={idx} className="flex items-center rounded-md border border-border bg-secondary/20 overflow-hidden text-[10px]">
                            <span className="px-1.5 py-0.5 bg-secondary/40 border-r border-border font-medium">{k}</span>
                            <span className="px-1.5 py-0.5 font-mono">{v || '(none)'}</span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="w-[600px] md:w-[800px] max-w-full border-l border-border bg-card flex flex-col h-full animate-in slide-in-from-right duration-300 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Box className="w-5 h-5 text-primary flex-shrink-0" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h2 className="font-bold text-lg truncate leading-tight" title={podName}>{podName}</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground font-mono bg-secondary/50 px-1.5 py-0.5 rounded leading-none">{namespace}</span>
                            <span className="text-[10px] text-muted-foreground italic leading-none">Pod Details</span>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors flex-shrink-0">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex border-b border-border shrink-0 bg-background/30 backdrop-blur-sm">
                <button
                    onClick={() => setActiveTab('describe')}
                    className={cn(
                        "flex-1 py-3 text-sm font-semibold transition-all border-b-2 relative",
                        activeTab === 'describe' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/10"
                    )}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Info className="w-4 h-4" />
                        Details
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('events')}
                    className={cn(
                        "flex-1 py-3 text-sm font-semibold transition-all border-b-2 relative",
                        activeTab === 'events' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/10"
                    )}
                >
                    <div className="flex items-center justify-center gap-2 relative">
                        <Activity className="w-4 h-4" />
                        Events
                        {events.length > 0 && (
                            <span className="absolute -top-1 -right-4 w-4 h-4 rounded-full bg-primary text-[8px] flex items-center justify-center text-primary-foreground">
                                {events.length}
                            </span>
                        )}
                    </div>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        <p className="text-sm text-muted-foreground animate-pulse">Fetching resource data...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full text-destructive gap-3 text-center p-8">
                        <div className="p-4 bg-destructive/10 rounded-full">
                            <AlertTriangle className="w-10 h-10" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">Failed to load details</p>
                            <p className="text-sm opacity-80 mt-1">{error}</p>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md text-sm font-medium transition-colors"
                        >
                            Retry Request
                        </button>
                    </div>
                ) : activeTab === 'describe' ? (
                    <div className="p-4 space-y-4 pb-12">
                        {describeSections.length === 0 ? (
                            <div className="bg-secondary/20 rounded-xl p-6 border border-border flex flex-col items-center text-center">
                                <FileText className="w-10 h-10 text-muted-foreground opacity-20 mb-4" />
                                <h3 className="font-medium text-foreground">No Details Available</h3>
                                <p className="text-sm text-muted-foreground mt-1">We couldn't parse the description for this pod.</p>
                                <pre className="mt-6 text-left text-[10px] font-mono whitespace-pre-wrap break-words text-foreground bg-background/50 p-4 rounded-lg w-full border border-border/50">
                                    {describe}
                                </pre>
                            </div>
                        ) : (
                            describeSections.map((section, idx) => (
                                <div key={idx} className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm transition-all hover:shadow-md hover:border-border">
                                    <button
                                        onClick={() => toggleSection(section.title)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3 transition-colors",
                                            expandedSections[section.title] ? "bg-secondary/20" : "bg-background"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-background rounded-md shadow-sm text-primary">
                                                {getSectionIcon(section.title)}
                                            </div>
                                            <span className="text-xs font-bold uppercase tracking-wider text-foreground">{section.title}</span>
                                        </div>
                                        <div className="p-1 rounded-full hover:bg-secondary transition-colors">
                                            {expandedSections[section.title] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                        </div>
                                    </button>

                                    {expandedSections[section.title] && (
                                        <div className="border-t border-border/30">
                                            {section.isTable ? (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-[11px]">
                                                        <tbody>
                                                            {(section.content as Record<string, string>[]).map((row, rIdx) => (
                                                                <tr key={rIdx} className="border-b border-border/20 last:border-0 hover:bg-secondary/5 transition-colors">
                                                                    <td className="p-3 font-semibold text-muted-foreground w-[180px] align-top bg-secondary/5">{row.key}</td>
                                                                    <td className="p-3 font-mono break-all text-foreground">{renderValue(row.key, row.value)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : section.title.toLowerCase().includes('label') ? (
                                                renderLabels(section.content as string)
                                            ) : (
                                                <div className="p-3 bg-secondary/5">
                                                    <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-foreground leading-relaxed custom-scrollbar">
                                                        {section.content as string}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        <div className="mt-12 pt-6 border-t border-dashed border-border">
                            <div className="flex items-center justify-between mb-3 text-muted-foreground">
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.1em]">Raw System Output</h3>
                                <Clock className="w-3 h-3" />
                            </div>
                            <details className="group">
                                <summary className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 cursor-pointer font-medium mb-3 list-none">
                                    <div className="p-1 group-open:rotate-90 transition-transform">
                                        <ChevronRight className="w-3 h-3" />
                                    </div>
                                    View Full kubectl describe Output
                                </summary>
                                <div className="relative group/raw">
                                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/raw:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => navigator.clipboard.writeText(describe)}
                                            className="p-1.5 bg-background/80 backdrop-blur border border-border rounded shadow-sm text-[10px] hover:bg-background"
                                        >
                                            Copy Raw
                                        </button>
                                    </div>
                                    <pre className="text-[10px] font-mono whitespace-pre-wrap break-words text-foreground bg-secondary/30 p-4 rounded-xl overflow-x-hidden opacity-60 hover:opacity-100 transition-opacity border border-border/50">
                                        {describe}
                                    </pre>
                                </div>
                            </details>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 space-y-4 pb-12">
                        {events.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-secondary/10 rounded-2xl border border-dashed border-border">
                                <Activity className="w-12 h-12 mb-4 opacity-10" />
                                <p className="font-medium text-lg">No events detected</p>
                                <p className="text-sm opacity-60">This resource hasn't generated any events yet.</p>
                            </div>
                        ) : (
                            events.map((event, i) => (
                                <div key={i} className="group relative p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between mb-3 gap-4">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={event.type === 'Warning' ? "destructive" : "secondary"} className="rounded-md font-bold px-2 py-0 border-none">
                                                {event.reason}
                                            </Badge>
                                            {event.count > 1 && (
                                                <Badge variant="outline" className="rounded-md text-[9px] bg-background/50 flex items-center gap-1 border-border/50">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    x{event.count}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground whitespace-nowrap bg-secondary/30 px-2 py-1 rounded-full border border-border/30">
                                            <Clock className="w-3 h-3" />
                                            {event.lastTimestamp
                                                ? `${formatDistanceToNow(new Date(event.lastTimestamp))} ago`
                                                : 'Recently'}
                                        </div>
                                    </div>
                                    <p className="text-xs text-foreground leading-relaxed pl-3 border-l-2 border-primary/30 ml-1">{event.message}</p>
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
