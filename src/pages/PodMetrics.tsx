import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Activity,
    Cpu,
    Database,
    RefreshCw,
    AlertCircle,
    Clock,
    Zap,
    ShieldAlert
} from 'lucide-react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    ReferenceLine
} from 'recharts';
import { fetchPodMetrics, PodMetrics as PodMetricsData } from '@/services/kubernetesApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

interface MetricHistory extends PodMetricsData {
    timeLabel: string;
    cpuValue: number;
    memoryValue: number;
    cpuLimitValue: number;
    memoryLimitValue: number;
}

const parseResourceValue = (val: string, type: 'cpu' | 'memory'): number => {
    if (!val || val === 'none') return 0;

    const cleanVal = val.trim();
    if (type === 'cpu') {
        if (cleanVal.endsWith('m')) return parseInt(cleanVal);
        return parseFloat(cleanVal) * 1000;
    } else {
        if (cleanVal.endsWith('Ki')) return parseFloat(cleanVal) / 1024;
        if (cleanVal.endsWith('Mi')) return parseFloat(cleanVal);
        if (cleanVal.endsWith('Gi')) return parseFloat(cleanVal) * 1024;
        if (cleanVal.endsWith('Ti')) return parseFloat(cleanVal) * 1024 * 1024;
        return parseFloat(cleanVal);
    }
};

export default function PodMetrics() {
    const { namespace, podName } = useParams<{ namespace: string; podName: string }>();
    const navigate = useNavigate();
    const [history, setHistory] = useState<MetricHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchMetrics = async () => {
        if (!namespace || !podName) return;

        try {
            const data = await fetchPodMetrics(namespace, podName);

            const cpuValue = parseResourceValue(data.cpu, 'cpu');
            const memoryValue = parseResourceValue(data.memory, 'memory');
            const cpuLimitValue = parseResourceValue(data.cpuLimit, 'cpu');
            const memoryLimitValue = parseResourceValue(data.memoryLimit, 'memory');

            const newEntry: MetricHistory = {
                ...data,
                timeLabel: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                cpuValue,
                memoryValue,
                cpuLimitValue,
                memoryLimitValue
            };

            setHistory(prev => {
                const updated = [...prev, newEntry].slice(-30);
                return updated;
            });
            setError(null);
        } catch (err: any) {
            console.error('Error fetching metrics:', err);
            setError(err.message || 'Failed to fetch metrics.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();

        let interval: NodeJS.Timeout;
        if (autoRefresh) {
            interval = setInterval(fetchMetrics, 5000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [namespace, podName, autoRefresh]);

    const latest = useMemo(() => history[history.length - 1], [history]);

    const stats = useMemo(() => {
        if (!latest) return null;

        const hasCpuLimit = latest.cpuLimitValue > 0;
        const hasMemLimit = latest.memoryLimitValue > 0;

        const cpuPercent = hasCpuLimit ? (latest.cpuValue / latest.cpuLimitValue) * 100 : 0;
        const memPercent = hasMemLimit ? (latest.memoryValue / latest.memoryLimitValue) * 100 : 0;

        return {
            cpuPercent: Math.min(cpuPercent, 100),
            memPercent: Math.min(memPercent, 100),
            actualCpuPercent: cpuPercent,
            actualMemPercent: memPercent,
            hasCpuLimit,
            hasMemLimit,
            isCpuWarning: hasCpuLimit && cpuPercent > 60,
            isCpuCritical: hasCpuLimit && cpuPercent > 85,
            isMemWarning: hasMemLimit && memPercent > 60,
            isMemCritical: hasMemLimit && memPercent > 85,
        };
    }, [latest]);

    if (loading && !history.length) {
        return (
            <div className="min-h-screen bg-background p-6 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Activity className="w-12 h-12 text-primary animate-pulse" />
                    <p className="text-muted-foreground animate-pulse font-medium">Initializing Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/')}
                        className="hover:bg-secondary"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Activity className="w-6 h-6 text-primary" />
                            Pod Performance Dashboard
                        </h1>
                        <p className="text-muted-foreground flex items-center gap-2 text-sm mt-1">
                            <span className="px-2 py-0.5 bg-secondary rounded text-xs font-mono">{namespace}</span>
                            <span className="text-border">/</span>
                            <span className="font-medium">{podName}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {(stats?.actualMemPercent > 85 || stats?.actualCpuPercent > 85) && (
                        <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-1.5 rounded-md border border-destructive/20 animate-pulse mr-4">
                            <ShieldAlert className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">Critical Resource Usage</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 mr-4 bg-secondary/30 px-3 py-1.5 rounded-full border border-border">
                        <div className={cn("w-2 h-2 rounded-full", autoRefresh ? "bg-success animate-pulse" : "bg-muted")} />
                        <span className="text-xs font-medium uppercase tracking-wider">
                            {autoRefresh ? 'Live' : 'Paused'}
                        </span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className="gap-2"
                    >
                        <RefreshCw className={cn("w-4 h-4", autoRefresh && "animate-spin")} />
                        {autoRefresh ? 'Stop' : 'Sync'}
                    </Button>
                </div>
            </div>

            {error && !history.length ? (
                <Card className="border-destructive/50 bg-destructive/5 max-w-2xl mx-auto mt-20">
                    <CardContent className="pt-6 flex flex-col items-center text-center gap-4">
                        <AlertCircle className="w-12 h-12 text-destructive" />
                        <div>
                            <CardTitle className="text-destructive mb-2">Metrics Unavailable</CardTitle>
                            <CardDescription className="text-foreground/80">
                                {error}
                            </CardDescription>
                        </div>
                        <Button onClick={fetchMetrics} className="mt-2">Try Again</Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {/* Quick Context Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="bg-secondary/10 border-border/50 shadow-sm">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="bg-blue-500/10 p-2 rounded-lg">
                                    <Activity className="w-4 h-4 text-blue-500" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Node Host</div>
                                    <div className="text-xs font-mono font-bold truncate max-w-[120px]" title={latest?.nodeName}>{latest?.nodeName || 'Scanning...'}</div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-secondary/10 border-border/50 shadow-sm">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="bg-orange-500/10 p-2 rounded-lg">
                                    <ShieldAlert className="w-4 h-4 text-orange-500" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">QoS Policy</div>
                                    <div className="text-xs font-mono font-bold truncate">{latest?.qosClass || 'Unknown'}</div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-secondary/10 border-border/50 shadow-sm">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="bg-primary/10 p-2 rounded-lg">
                                    <Cpu className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">CPU Req.</div>
                                    <div className="text-xs font-mono font-bold">{latest?.cpuRequest === 'none' ? 'Unlimited' : latest?.cpuRequest}</div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-secondary/10 border-border/50 shadow-sm">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="bg-blue-400/10 p-2 rounded-lg">
                                    <Database className="w-4 h-4 text-blue-400" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Mem Req.</div>
                                    <div className="text-xs font-mono font-bold">{latest?.memoryRequest === 'none' ? 'Unlimited' : latest?.memoryRequest}</div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* CPU Card */}
                        <Card className={cn(
                            "bg-card/50 backdrop-blur border-border shadow-lg transition-colors duration-500",
                            stats?.isCpuCritical && "border-destructive/50 bg-destructive/5 shadow-destructive/10",
                            stats?.isCpuWarning && !stats?.isCpuCritical && "border-warning/50 bg-warning/5"
                        )}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <Cpu className={cn("w-4 h-4", stats?.isCpuCritical ? "text-destructive" : "text-primary")} />
                                        CPU Usage
                                    </CardTitle>
                                    <div className="text-xs font-mono text-muted-foreground">Limit: {!latest?.cpuLimit || latest.cpuLimit === 'none' ? '∞' : latest.cpuLimit}</div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end justify-between mb-4">
                                    <div className="text-4xl font-bold font-mono tracking-tight">{latest?.cpu || '0m'}</div>
                                    <div className={cn(
                                        "text-xl font-bold font-mono",
                                        stats?.isCpuCritical ? "text-destructive" : stats?.isCpuWarning ? "text-warning" : "text-primary"
                                    )}>
                                        {stats?.hasCpuLimit ? `${stats.actualCpuPercent.toFixed(1)}%` : 'N/A'}
                                    </div>
                                </div>
                                <Progress
                                    value={stats?.cpuPercent}
                                    className="h-2.5 bg-secondary"
                                    indicatorClassName={cn(
                                        stats?.isCpuCritical ? "bg-destructive transition-all duration-500" :
                                            stats?.isCpuWarning ? "bg-warning transition-all duration-500" : "bg-primary transition-all duration-500"
                                    )}
                                />
                                <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border/50 pt-4">
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Current</div>
                                        <div className="font-mono text-sm">{latest?.cpu || '0m'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Limit</div>
                                        <div className="font-mono text-sm">{!latest?.cpuLimit || latest.cpuLimit === 'none' ? 'Unlimited' : latest.cpuLimit}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Status</div>
                                        <div className={cn(
                                            "font-bold text-xs uppercase",
                                            stats?.isCpuCritical ? "text-destructive" : stats?.isCpuWarning ? "text-warning" : !stats?.hasCpuLimit ? "text-warning" : "text-success"
                                        )}>
                                            {stats?.isCpuCritical ? 'Critical' : stats?.isCpuWarning ? 'Saturated' : stats?.hasCpuLimit ? 'Healthy' : 'No Limit Set'}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Memory Card */}
                        <Card className={cn(
                            "bg-card/50 backdrop-blur border-border shadow-lg transition-colors duration-500",
                            stats?.isMemCritical && "border-destructive/50 bg-destructive/5 shadow-destructive/10",
                            stats?.isMemWarning && !stats?.isMemCritical && "border-warning/50 bg-warning/5"
                        )}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <Database className={cn("w-4 h-4", stats?.isMemCritical ? "text-destructive" : "text-blue-500")} />
                                        Memory Usage
                                    </CardTitle>
                                    <div className="text-xs font-mono text-muted-foreground">Limit: {!latest?.memoryLimit || latest.memoryLimit === 'none' ? '∞' : latest.memoryLimit}</div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end justify-between mb-4">
                                    <div className="text-4xl font-bold font-mono tracking-tight">{latest?.memory || '0Mi'}</div>
                                    <div className={cn(
                                        "text-xl font-bold font-mono",
                                        stats?.isMemCritical ? "text-destructive" : stats?.isMemWarning ? "text-warning" : "text-blue-500"
                                    )}>
                                        {stats?.hasMemLimit ? `${stats.actualMemPercent.toFixed(1)}%` : 'N/A'}
                                    </div>
                                </div>
                                <Progress
                                    value={stats?.memPercent}
                                    className="h-2.5 bg-secondary"
                                    indicatorClassName={cn(
                                        stats?.isMemCritical ? "bg-destructive transition-all duration-500" :
                                            stats?.isMemWarning ? "bg-warning transition-all duration-500" : "bg-blue-500 transition-all duration-500"
                                    )}
                                />
                                <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border/50 pt-4">
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Current</div>
                                        <div className="font-mono text-sm">{latest?.memory || '0Mi'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Limit</div>
                                        <div className="font-mono text-sm">{!latest?.memoryLimit || latest.memoryLimit === 'none' ? 'Unlimited' : latest.memoryLimit}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Status</div>
                                        <div className={cn(
                                            "font-bold text-xs uppercase",
                                            stats?.isMemCritical ? "text-destructive" : stats?.isMemWarning ? "text-warning" : !stats?.hasMemLimit ? "text-warning" : "text-success"
                                        )}>
                                            {stats?.isMemCritical ? 'Critical' : stats?.isMemWarning ? 'Saturated' : stats?.hasMemLimit ? 'Healthy' : 'No Limit Set'}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {history.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
                            {/* CPU History Graph */}
                            <Card className="bg-card/50 backdrop-blur border-border shadow-xl overflow-hidden">
                                <CardHeader className="border-b border-border/50 bg-secondary/10 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Zap className="w-5 h-5 text-primary" />
                                            CPU Throughput
                                        </CardTitle>
                                        <CardDescription>Real-time millicore consumption</CardDescription>
                                    </div>
                                    {latest?.cpuLimitValue > 0 && (
                                        <div className="px-2 py-1 bg-primary/10 rounded border border-primary/20 text-[10px] font-mono text-primary">
                                            LIMIT: {latest.cpuLimitValue}m
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent className="pt-6 h-[350px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={history} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                            <XAxis
                                                dataKey="timeLabel"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'hsl(var(--card))',
                                                    borderColor: 'hsl(var(--border))',
                                                    borderRadius: '8px',
                                                    color: 'hsl(var(--foreground))'
                                                }}
                                            />
                                            {latest?.cpuLimitValue > 0 && (
                                                <ReferenceLine
                                                    y={latest.cpuLimitValue}
                                                    stroke="#ef4444"
                                                    strokeDasharray="5 5"
                                                    label={{
                                                        position: 'insideTopRight',
                                                        value: 'LIMIT',
                                                        fill: '#ef4444',
                                                        fontSize: 10,
                                                        fontWeight: 'bold',
                                                        dy: -10
                                                    }}
                                                />
                                            )}
                                            <Area
                                                type="monotone"
                                                dataKey="cpuValue"
                                                name="Usage (m)"
                                                stroke="#8b5cf6"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorCpu)"
                                                isAnimationActive={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            {/* Memory History Graph */}
                            <Card className="bg-card/50 backdrop-blur border-border shadow-xl overflow-hidden">
                                <CardHeader className="border-b border-border/50 bg-secondary/10 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Database className="w-5 h-5 text-blue-500" />
                                            Memory Footprint
                                        </CardTitle>
                                        <CardDescription>Live memory allocation in MiB</CardDescription>
                                    </div>
                                    {latest?.memoryLimitValue > 0 && (
                                        <div className="px-2 py-1 bg-blue-500/10 rounded border border-blue-500/20 text-[10px] font-mono text-blue-500">
                                            LIMIT: {latest.memoryLimitValue}Mi
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent className="pt-6 h-[350px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={history} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                            <XAxis
                                                dataKey="timeLabel"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'hsl(var(--card))',
                                                    borderColor: 'hsl(var(--border))',
                                                    borderRadius: '8px',
                                                    color: 'hsl(var(--foreground))'
                                                }}
                                            />
                                            {latest?.memoryLimitValue > 0 && (
                                                <ReferenceLine
                                                    y={latest.memoryLimitValue}
                                                    stroke="#ef4444"
                                                    strokeDasharray="5 5"
                                                    label={{
                                                        position: 'insideTopRight',
                                                        value: 'LIMIT',
                                                        fill: '#ef4444',
                                                        fontSize: 10,
                                                        fontWeight: 'bold',
                                                        dy: -10
                                                    }}
                                                />
                                            )}
                                            <Area
                                                type="monotone"
                                                dataKey="memoryValue"
                                                name="Usage (MiB)"
                                                stroke="#3b82f6"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorMem)"
                                                isAnimationActive={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
