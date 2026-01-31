import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, AlertCircle, CheckCircle, XCircle, Brain } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { aiDiagnosticsService } from '@/services/aiDiagnostics';

interface DiagnosticResult {
    tool: string;
    result: {
        content: Array<{
            type: string;
            text: string;
        }>;
    };
    prompt: string;
}

interface AIDiagnosticsPanelProps {
    namespace?: string;
    initialPrompt?: string;
}

export function AIDiagnosticsPanel({ namespace, initialPrompt }: AIDiagnosticsPanelProps) {
    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<DiagnosticResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDiagnose = async (overridePrompt?: string) => {
        const activePrompt = overridePrompt || prompt;
        if (!activePrompt.trim()) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await aiDiagnosticsService.diagnose({
                prompt: activePrompt,
                namespace,
            });
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        if (initialPrompt) {
            setPrompt(initialPrompt);
            handleDiagnose(initialPrompt);
        }
    }, [initialPrompt]);

    const quickActions = [
        { label: 'Cluster Health', prompt: 'Check the overall health of the cluster' },
        { label: 'Failing Pods', prompt: 'Show me all failing pods' },
        { label: 'Resource Usage', prompt: 'Show CPU and memory usage overview' },
        { label: 'Troubleshoot Pod', prompt: 'Troubleshoot pod [POD_NAME]' },
        { label: 'Log Analysis', prompt: 'Analyze logs for pod [POD_NAME]' },
        { label: 'Network Policies', prompt: 'List all network policies' },
        { label: 'Storage/PVCs', prompt: 'Check status of all PVCs' },
        { label: 'Describe Resource', prompt: 'Describe resource [TYPE]/[NAME]' },
        { label: 'Recent Events', prompt: 'Show recent warning events' },
        { label: 'Cluster Summary', prompt: 'Give me a cluster overview' },
        { label: 'Helm Releases', prompt: 'List all helm releases' },
        { label: 'Release History', prompt: 'Show history for helm release [NAME]' },
        { label: 'Analyze Deployment', prompt: 'Analyze deployment [NAME]' },
        { label: 'Memory Analysis', prompt: 'Analyze memory usage and OOM events' },
    ];

    const parseResult = (resultText: string) => {
        try {
            return JSON.parse(resultText);
        } catch {
            return null;
        }
    };

    const renderDiagnosticResult = () => {
        if (!result) return null;

        const content = result.result.content[0];
        if (!content) return null;

        const parsedData = parseResult(content.text);

        if (!parsedData) {
            return (
                <div className="whitespace-pre-wrap font-mono text-sm">
                    {content.text}
                </div>
            );
        }

        // Render cluster diagnosis
        if (parsedData.status) {
            return (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        {parsedData.status === 'healthy' && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        {parsedData.status === 'warning' && (
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                        )}
                        {parsedData.status === 'critical' && (
                            <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <Badge
                            variant={
                                parsedData.status === 'healthy'
                                    ? 'default'
                                    : parsedData.status === 'warning'
                                        ? 'secondary'
                                        : 'destructive'
                            }
                        >
                            {parsedData.status.toUpperCase()}
                        </Badge>
                    </div>

                    <div className="whitespace-pre-wrap text-sm">{parsedData.summary}</div>

                    {parsedData.metrics && (
                        <div className="grid grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Total Pods</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{parsedData.metrics.totalPods}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Healthy</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-green-600">
                                        {parsedData.metrics.healthyPods}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Unhealthy</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-red-600">
                                        {parsedData.metrics.unhealthyPods}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {parsedData.issues && parsedData.issues.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="font-semibold">Issues Found:</h4>
                            {parsedData.issues.map((issue: any, idx: number) => (
                                <Alert
                                    key={idx}
                                    variant={
                                        issue.severity === 'critical' || issue.severity === 'high'
                                            ? 'destructive'
                                            : 'default'
                                    }
                                >
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        <div className="font-semibold">{issue.resource}</div>
                                        <div>{issue.message}</div>
                                        {issue.recommendation && (
                                            <div className="mt-1 text-xs italic">💡 {issue.recommendation}</div>
                                        )}
                                    </AlertDescription>
                                </Alert>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        // Render failing pods list
        if (parsedData.pods) {
            return (
                <div className="space-y-4">
                    <div className="text-lg font-semibold">
                        Found {parsedData.count} failing pod(s)
                    </div>
                    <div className="space-y-2">
                        {parsedData.pods.map((pod: any, idx: number) => (
                            <Card key={idx}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">{pod.name}</CardTitle>
                                    <CardDescription>{pod.namespace}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex gap-2">
                                        <Badge variant="outline">{pod.phase}</Badge>
                                        {pod.restarts > 0 && (
                                            <Badge variant="destructive">Restarts: {pod.restarts}</Badge>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            );
        }
        // Render cluster overview
        if (parsedData.cluster) {
            return (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Cluster Overview</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Nodes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1 text-sm">
                                    <div>Total: {parsedData.cluster.nodes.total}</div>
                                    <div className="text-green-600">Ready: {parsedData.cluster.nodes.ready}</div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Namespaces</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{parsedData.cluster.namespaces}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Pods</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1 text-sm">
                                    <div>Total: {parsedData.cluster.pods.total}</div>
                                    <div className="text-green-600">Running: {parsedData.cluster.pods.running}</div>
                                    <div className="text-yellow-600">Pending: {parsedData.cluster.pods.pending}</div>
                                    <div className="text-red-600">Failed: {parsedData.cluster.pods.failed}</div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            );
        }
        // Render Helm releases
        if (parsedData.releases) {
            return (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Helm Releases ({parsedData.count})</h3>
                    <div className="space-y-2">
                        {parsedData.releases.map((release: any, idx: number) => (
                            <Card key={idx}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-sm">{release.name}</CardTitle>
                                            <CardDescription>{release.namespace} • {release.chart}</CardDescription>
                                        </div>
                                        <Badge variant={release.status === 'deployed' ? 'default' : 'destructive'}>
                                            {release.status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-xs space-y-1">
                                    <div>Revision: {release.revision}</div>
                                    <div>App Version: {release.appVersion}</div>
                                    <div className="text-muted-foreground">{release.updated}</div>
                                    {release.issues && release.issues.length > 0 && (
                                        <div className="text-red-500 font-semibold mt-1">
                                            {release.issues.join(', ')}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            );
        }

        // Render Deployment Analysis
        if (parsedData.replicas && parsedData.strategy) {
            return (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Deployment: {parsedData.name}</h3>
                        <Badge variant={parsedData.issues.length > 0 ? 'destructive' : 'default'}>
                            {parsedData.issues.length > 0 ? 'Issues Found' : 'Healthy'}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="pb-2 text-sm font-medium">Replicas</CardHeader>
                            <CardContent className="text-sm">
                                <div>Desired: {parsedData.replicas.desired}</div>
                                <div>Ready: {parsedData.replicas.ready}</div>
                                <div>Available: {parsedData.replicas.available}</div>
                                <div className={parsedData.replicas.unavailable > 0 ? 'text-red-500 font-bold' : ''}>
                                    Unavailable: {parsedData.replicas.unavailable}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2 text-sm font-medium">Restarts</CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${parsedData.podRestarts > 5 ? 'text-red-500' : ''}`}>
                                    {parsedData.podRestarts}
                                </div>
                                <div className="text-xs text-muted-foreground">Total restarts in pod group</div>
                            </CardContent>
                        </Card>
                    </div>

                    {parsedData.issues.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold">Critical Issues:</h4>
                            {parsedData.issues.map((issue: string, idx: number) => (
                                <Alert key={idx} variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{issue}</AlertDescription>
                                </Alert>
                            ))}
                        </div>
                    )}

                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Recent Events:</h4>
                        <div className="space-y-1">
                            {parsedData.recentEvents.map((event: any, idx: number) => (
                                <div key={idx} className="text-xs p-2 rounded bg-muted">
                                    <span className={`font-semibold ${event.type === 'Warning' ? 'text-yellow-600' : ''}`}>
                                        [{event.reason}]
                                    </span> {event.message}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        // Render Memory Analysis
        if (parsedData.oomEventsFound !== undefined) {
            return (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Memory Usage & OOM Analysis</h3>
                    <Alert variant={parsedData.oomEventsFound > 0 ? 'destructive' : 'default'}>
                        <Brain className="h-4 w-4" />
                        <AlertDescription>
                            {parsedData.oomEventsFound === 0
                                ? 'No OOM issues or high memory threats detected.'
                                : `Found ${parsedData.oomEventsFound} potential memory issues or OOM kills.`}
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                        {parsedData.details.map((issue: any, idx: number) => (
                            <Card key={idx} className={issue.issue === 'OOMKilled' ? 'border-red-500' : ''}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm">{issue.pod}</CardTitle>
                                        <Badge variant={issue.issue === 'OOMKilled' ? 'destructive' : 'secondary'}>
                                            {issue.issue}
                                        </Badge>
                                    </div>
                                    <CardDescription>Container: {issue.container}</CardDescription>
                                </CardHeader>
                                <CardContent className="text-xs space-y-1">
                                    {issue.usage && <div>Current Usage: <span className="font-bold">{issue.usage}</span></div>}
                                    {issue.limit && <div>Limit: {issue.limit}</div>}
                                    {issue.exitCode && <div>Exit Code: {issue.exitCode}</div>}
                                    {issue.finishedAt && <div>Last Event: {issue.finishedAt}</div>}
                                    {issue.recommendation && (
                                        <div className="mt-2 text-blue-600 dark:text-blue-400 font-medium">
                                            💡 Recommendation: {issue.recommendation}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            );
        }

        // Default: show raw JSON
        return (
            <pre className="whitespace-pre-wrap font-mono text-xs overflow-auto">
                {JSON.stringify(parsedData, null, 2)}
            </pre>
        );
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b bg-muted/50">
                <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold text-base">K8s MCP Diagnostics</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Natural language cluster diagnostics
                </p>
            </div>

            <div className="p-4 space-y-4">
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="e.g., 'Check cluster health'..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !loading) {
                                    handleDiagnose();
                                }
                            }}
                            disabled={loading}
                        />
                        <Button onClick={() => handleDiagnose()} disabled={loading || !prompt.trim()}>
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                        {quickActions.map((action, idx) => (
                            <Button
                                key={idx}
                                variant="outline"
                                size="sm"
                                className="whitespace-nowrap flex-shrink-0 text-xs h-8"
                                onClick={() => {
                                    setPrompt(action.prompt);
                                }}
                                disabled={loading}
                            >
                                {action.label}
                            </Button>
                        ))}
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {result && (
                        <div className="space-y-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold">Diagnostic Results</h3>
                                <Badge variant="secondary" className="text-[10px]">
                                    Tool: {result.tool}
                                </Badge>
                            </div>
                            <div className="space-y-4">
                                {renderDiagnosticResult()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
