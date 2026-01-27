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
}

export function AIDiagnosticsPanel({ namespace }: AIDiagnosticsPanelProps) {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<DiagnosticResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDiagnose = async () => {
        if (!prompt.trim()) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await aiDiagnosticsService.diagnose({
                prompt,
                namespace,
            });
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

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
                                <CardTitle>Nodes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    <div>Total: {parsedData.cluster.nodes.total}</div>
                                    <div className="text-green-600">Ready: {parsedData.cluster.nodes.ready}</div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Namespaces</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{parsedData.cluster.namespaces}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Pods</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
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

        // Default: show raw JSON
        return (
            <pre className="whitespace-pre-wrap font-mono text-xs overflow-auto">
                {JSON.stringify(parsedData, null, 2)}
            </pre>
        );
    };

    return (
        <div className="space-y-4 p-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5" />
                        <CardTitle>K8s MCP Diagnostics</CardTitle>
                    </div>
                    <CardDescription>
                        Ask questions about your Kubernetes cluster in natural language
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="e.g., 'Check cluster health' or 'Show failing pods'"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !loading) {
                                    handleDiagnose();
                                }
                            }}
                            disabled={loading}
                        />
                        <Button onClick={handleDiagnose} disabled={loading || !prompt.trim()}>
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {quickActions.map((action, idx) => (
                            <Button
                                key={idx}
                                variant="outline"
                                size="sm"
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
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Results</CardTitle>
                                <CardDescription>Tool used: {result.tool}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[400px]">{renderDiagnosticResult()}</ScrollArea>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
