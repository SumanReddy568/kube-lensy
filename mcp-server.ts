import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const MAX_BUFFER = 1024 * 1024 * 50; // 50MB buffer

interface KubeDiagnosticResult {
    status: 'healthy' | 'warning' | 'critical';
    issues: Array<{
        severity: 'low' | 'medium' | 'high' | 'critical';
        resource: string;
        message: string;
        recommendation?: string;
    }>;
    summary: string;
}

/**
 * Kubernetes MCP Server
 * Provides intelligent Kubernetes cluster diagnostics and management through natural language
 */
class KubernetesMCPServer {
    private server: Server;

    constructor() {
        this.server = new Server(
            {
                name: 'kubernetes-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupToolHandlers();
        this.setupErrorHandling();
    }

    private setupErrorHandling(): void {
        this.server.onerror = (error) => {
            console.error('[MCP Error]', error);
        };

        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }

    private setupToolHandlers(): void {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: this.getAvailableTools(),
        }));

        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case 'diagnose_cluster':
                        return await this.diagnoseCluster(args);
                    case 'check_pod_health':
                        return await this.checkPodHealth(args);
                    case 'analyze_events':
                        return await this.analyzeEvents(args);
                    case 'get_resource_usage':
                        return await this.getResourceUsage(args);
                    case 'troubleshoot_pod':
                        return await this.troubleshootPod(args);
                    case 'list_failing_pods':
                        return await this.listFailingPods(args);
                    case 'get_cluster_overview':
                        return await this.getClusterOverview(args);
                    case 'analyze_logs':
                        return await this.analyzeLogs(args);
                    case 'exec_in_pod':
                        return await this.execInPod(args);
                    case 'describe_resource':
                        return await this.describeResource(args);
                    case 'get_network_policies':
                        return await this.getNetworkPolicies(args);
                    case 'check_service_endpoints':
                        return await this.checkServiceEndpoints(args);
                    case 'get_configmaps':
                        return await this.getConfigMaps(args);
                    case 'get_secrets':
                        return await this.getSecrets(args);
                    case 'rollout_status':
                        return await this.rolloutStatus(args);
                    case 'port_forward_info':
                        return await this.portForwardInfo(args);
                    case 'get_ingress':
                        return await this.getIngress(args);
                    case 'check_pvc_status':
                        return await this.checkPVCStatus(args);
                    case 'helm_list':
                        return await this.helmList(args);
                    case 'helm_history':
                        return await this.helmHistory(args);
                    case 'analyze_deployment':
                        return await this.analyzeDeployment(args);
                    case 'analyze_memory_usage':
                        return await this.analyzeMemoryUsage(args);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    private getAvailableTools(): Tool[] {
        return [
            {
                name: 'diagnose_cluster',
                description:
                    'Performs a comprehensive health check of the entire Kubernetes cluster, identifying issues across all namespaces',
                inputSchema: {
                    type: 'object',
                    properties: {
                        namespace: {
                            type: 'string',
                            description: 'Optional: Specific namespace to diagnose (defaults to all namespaces)',
                        },
                    },
                },
            },
            {
                name: 'check_pod_health',
                description: 'Checks the health status of a specific pod and provides detailed diagnostics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        podName: {
                            type: 'string',
                            description: 'Name of the pod to check',
                        },
                        namespace: {
                            type: 'string',
                            description: 'Namespace where the pod is located',
                        },
                    },
                    required: ['podName', 'namespace'],
                },
            },
            {
                name: 'analyze_events',
                description: 'Analyzes Kubernetes events to identify patterns and issues',
                inputSchema: {
                    type: 'object',
                    properties: {
                        namespace: {
                            type: 'string',
                            description: 'Namespace to analyze events from (optional, defaults to all)',
                        },
                        severity: {
                            type: 'string',
                            enum: ['Warning', 'Normal', 'Error'],
                            description: 'Filter by event severity',
                        },
                    },
                },
            },
            {
                name: 'get_resource_usage',
                description: 'Gets resource usage (CPU, memory) for pods and nodes',
                inputSchema: {
                    type: 'object',
                    properties: {
                        resourceType: {
                            type: 'string',
                            enum: ['pods', 'nodes'],
                            description: 'Type of resource to check',
                        },
                        namespace: {
                            type: 'string',
                            description: 'Namespace (for pods only)',
                        },
                    },
                    required: ['resourceType'],
                },
            },
            {
                name: 'troubleshoot_pod',
                description:
                    'Performs deep troubleshooting on a pod, analyzing logs, events, and configuration',
                inputSchema: {
                    type: 'object',
                    properties: {
                        podName: {
                            type: 'string',
                            description: 'Name of the pod to troubleshoot',
                        },
                        namespace: {
                            type: 'string',
                            description: 'Namespace where the pod is located',
                        },
                    },
                    required: ['podName', 'namespace'],
                },
            },
            {
                name: 'list_failing_pods',
                description: 'Lists all pods that are in a failing or problematic state',
                inputSchema: {
                    type: 'object',
                    properties: {
                        namespace: {
                            type: 'string',
                            description: 'Optional: Specific namespace to check',
                        },
                    },
                },
            },
            {
                name: 'get_cluster_overview',
                description: 'Provides a high-level overview of cluster health and resources',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'analyze_logs',
                description: 'Analyzes pod logs to identify errors and issues',
                inputSchema: {
                    type: 'object',
                    properties: {
                        podName: {
                            type: 'string',
                            description: 'Name of the pod',
                        },
                        namespace: {
                            type: 'string',
                            description: 'Namespace where the pod is located',
                        },
                        container: {
                            type: 'string',
                            description: 'Optional: Specific container name',
                        },
                        lines: {
                            type: 'number',
                            description: 'Number of log lines to analyze (default: 100)',
                        },
                    },
                    required: ['podName', 'namespace'],
                },
            },
            {
                name: 'exec_in_pod',
                description: 'Execute a command inside a pod container for debugging',
                inputSchema: {
                    type: 'object',
                    properties: {
                        podName: {
                            type: 'string',
                            description: 'Name of the pod',
                        },
                        namespace: {
                            type: 'string',
                            description: 'Namespace where the pod is located',
                        },
                        command: {
                            type: 'string',
                            description: 'Command to execute (e.g., "cat /etc/hosts", "env", "ps aux")',
                        },
                        container: {
                            type: 'string',
                            description: 'Optional: Specific container name',
                        },
                    },
                    required: ['podName', 'namespace', 'command'],
                },
            },
            {
                name: 'describe_resource',
                description: 'Get detailed description of any Kubernetes resource',
                inputSchema: {
                    type: 'object',
                    properties: {
                        resourceType: {
                            type: 'string',
                            description: 'Type of resource (pod, service, deployment, configmap, secret, etc.)',
                        },
                        resourceName: {
                            type: 'string',
                            description: 'Name of the resource',
                        },
                        namespace: {
                            type: 'string',
                            description: 'Namespace where the resource is located',
                        },
                    },
                    required: ['resourceType', 'resourceName', 'namespace'],
                },
            },
            {
                name: 'get_network_policies',
                description: 'List and analyze network policies affecting pods',
                inputSchema: {
                    type: 'object',
                    properties: {
                        namespace: {
                            type: 'string',
                            description: 'Namespace to check (optional, defaults to all)',
                        },
                    },
                },
            },
            {
                name: 'check_service_endpoints',
                description: 'Check if a service has healthy endpoints and proper connectivity',
                inputSchema: {
                    type: 'object',
                    properties: {
                        serviceName: {
                            type: 'string',
                            description: 'Name of the service to check',
                        },
                        namespace: {
                            type: 'string',
                            description: 'Namespace where the service is located',
                        },
                    },
                    required: ['serviceName', 'namespace'],
                },
            },
            {
                name: 'get_configmaps',
                description: 'List and inspect ConfigMaps in a namespace',
                inputSchema: {
                    type: 'object',
                    properties: {
                        namespace: {
                            type: 'string',
                            description: 'Namespace to check',
                        },
                        configMapName: {
                            type: 'string',
                            description: 'Optional: Specific ConfigMap name to inspect',
                        },
                    },
                    required: ['namespace'],
                },
            },
            {
                name: 'get_secrets',
                description: 'List secrets in a namespace (values are masked for security)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        namespace: {
                            type: 'string',
                            description: 'Namespace to check',
                        },
                        secretName: {
                            type: 'string',
                            description: 'Optional: Specific secret name to inspect',
                        },
                    },
                    required: ['namespace'],
                },
            },
            {
                name: 'rollout_status',
                description: 'Check the rollout status of a deployment or statefulset',
                inputSchema: {
                    type: 'object',
                    properties: {
                        resourceType: {
                            type: 'string',
                            enum: ['deployment', 'statefulset', 'daemonset'],
                            description: 'Type of resource',
                        },
                        resourceName: {
                            type: 'string',
                            description: 'Name of the resource',
                        },
                        namespace: {
                            type: 'string',
                            description: 'Namespace where the resource is located',
                        },
                    },
                    required: ['resourceType', 'resourceName', 'namespace'],
                },
            },
            {
                name: 'port_forward_info',
                description: 'Get information about how to port-forward to a service or pod',
                inputSchema: {
                    type: 'object',
                    properties: {
                        resourceType: {
                            type: 'string',
                            enum: ['pod', 'service'],
                            description: 'Type of resource to port-forward to',
                        },
                        resourceName: {
                            type: 'string',
                            description: 'Name of the resource',
                        },
                        namespace: {
                            type: 'string',
                            description: 'Namespace where the resource is located',
                        },
                    },
                    required: ['resourceType', 'resourceName', 'namespace'],
                },
            },
            {
                name: 'get_ingress',
                description: 'List and analyze Ingress resources',
                inputSchema: {
                    type: 'object',
                    properties: {
                        namespace: {
                            type: 'string',
                            description: 'Namespace to check (optional, defaults to all)',
                        },
                        ingressName: {
                            type: 'string',
                            description: 'Optional: Specific ingress name',
                        },
                    },
                },
            },
            {
                name: 'check_pvc_status',
                description: 'Check PersistentVolumeClaim status and storage issues',
                inputSchema: {
                    type: 'object',
                    properties: {
                        namespace: {
                            type: 'string',
                            description: 'Namespace to check (optional, defaults to all)',
                        },
                        pvcName: {
                            type: 'string',
                            description: 'Optional: Specific PVC name',
                        },
                    },
                },
            },
            {
                name: 'helm_list',
                description: 'List Helm releases and their status across namespaces',
                inputSchema: {
                    type: 'object',
                    properties: {
                        namespace: {
                            type: 'string',
                            description: 'Namespace to check (optional, defaults to all)',
                        },
                    },
                },
            },
            {
                name: 'helm_history',
                description: 'Get revision history for a specific Helm release',
                inputSchema: {
                    type: 'object',
                    properties: {
                        releaseName: {
                            type: 'string',
                            description: 'Name of the Helm release',
                        },
                        namespace: {
                            type: 'string',
                            description: 'Namespace where release is located',
                        },
                    },
                    required: ['releaseName', 'namespace'],
                },
            },
            {
                name: 'analyze_deployment',
                description: 'Deep analysis of a deployment, including status, replicas, and recent changes',
                inputSchema: {
                    type: 'object',
                    properties: {
                        deploymentName: {
                            type: 'string',
                            description: 'Name of the deployment',
                        },
                        namespace: {
                            type: 'string',
                            description: 'Namespace where deployment is located',
                        },
                    },
                    required: ['deploymentName', 'namespace'],
                },
            },
            {
                name: 'analyze_memory_usage',
                description: 'Analyze memory usage across pods, identifying OOM kills and high usage',
                inputSchema: {
                    type: 'object',
                    properties: {
                        namespace: {
                            type: 'string',
                            description: 'Namespace to analyze (optional, defaults to all)',
                        },
                    },
                },
            },
        ];
    }

    // Tool implementations

    private async diagnoseCluster(args: any) {
        const namespace = args.namespace || '--all-namespaces';
        const nsFlag = namespace === '--all-namespaces' ? '--all-namespaces' : `-n ${namespace}`;

        try {
            // Get all pods
            const { stdout: podsJson } = await execAsync(`kubectl get pods ${nsFlag} -o json`, {
                maxBuffer: MAX_BUFFER,
            });
            const pods = JSON.parse(podsJson);

            // Get events
            const { stdout: eventsJson } = await execAsync(
                `kubectl get events ${nsFlag} --sort-by='.lastTimestamp' -o json`,
                { maxBuffer: MAX_BUFFER }
            );
            const events = JSON.parse(eventsJson);

            // Analyze
            const issues: KubeDiagnosticResult['issues'] = [];
            let healthyPods = 0;
            let totalPods = 0;

            for (const pod of pods.items || []) {
                totalPods++;
                const podName = pod.metadata.name;
                const podNamespace = pod.metadata.namespace;
                const phase = pod.status?.phase;

                if (phase === 'Running') {
                    // Check container statuses
                    const containerStatuses = pod.status?.containerStatuses || [];
                    const allReady = containerStatuses.every((c: any) => c.ready);

                    if (allReady) {
                        healthyPods++;
                    } else {
                        issues.push({
                            severity: 'medium',
                            resource: `Pod: ${podNamespace}/${podName}`,
                            message: 'Pod is running but not all containers are ready',
                            recommendation: 'Check container logs and readiness probes',
                        });
                    }

                    // Check for high restart counts
                    const restartCount = containerStatuses.reduce(
                        (acc: number, c: any) => acc + (c.restartCount || 0),
                        0
                    );
                    if (restartCount > 5) {
                        issues.push({
                            severity: 'high',
                            resource: `Pod: ${podNamespace}/${podName}`,
                            message: `High restart count: ${restartCount}`,
                            recommendation: 'Investigate pod logs and events for crash reasons',
                        });
                    }
                } else if (phase === 'Pending') {
                    issues.push({
                        severity: 'high',
                        resource: `Pod: ${podNamespace}/${podName}`,
                        message: 'Pod is stuck in Pending state',
                        recommendation: 'Check for resource constraints or scheduling issues',
                    });
                } else if (phase === 'Failed' || phase === 'CrashLoopBackOff') {
                    issues.push({
                        severity: 'critical',
                        resource: `Pod: ${podNamespace}/${podName}`,
                        message: `Pod is in ${phase} state`,
                        recommendation: 'Check pod logs and events immediately',
                    });
                }
            }

            // Analyze warning events
            const warningEvents = (events.items || []).filter((e: any) => e.type === 'Warning');
            for (const event of warningEvents.slice(0, 10)) {
                issues.push({
                    severity: 'medium',
                    resource: `Event: ${event.involvedObject?.name || 'Unknown'}`,
                    message: `${event.reason}: ${event.message}`,
                });
            }

            const status: KubeDiagnosticResult['status'] =
                issues.some((i) => i.severity === 'critical')
                    ? 'critical'
                    : issues.length > 0
                        ? 'warning'
                        : 'healthy';

            const summary = `Cluster Health: ${status.toUpperCase()}\nTotal Pods: ${totalPods}\nHealthy Pods: ${healthyPods}\nIssues Found: ${issues.length}`;

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                status,
                                summary,
                                issues,
                                metrics: {
                                    totalPods,
                                    healthyPods,
                                    unhealthyPods: totalPods - healthyPods,
                                },
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to diagnose cluster: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async checkPodHealth(args: any) {
        const { podName, namespace } = args;

        try {
            const { stdout } = await execAsync(`kubectl get pod ${podName} -n ${namespace} -o json`, {
                maxBuffer: MAX_BUFFER,
            });
            const pod = JSON.parse(stdout);

            const phase = pod.status?.phase;
            const conditions = pod.status?.conditions || [];
            const containerStatuses = pod.status?.containerStatuses || [];

            const health = {
                podName,
                namespace,
                phase,
                conditions: conditions.map((c: any) => ({
                    type: c.type,
                    status: c.status,
                    reason: c.reason,
                    message: c.message,
                })),
                containers: containerStatuses.map((c: any) => ({
                    name: c.name,
                    ready: c.ready,
                    restartCount: c.restartCount,
                    state: c.state,
                })),
                recommendation: this.generatePodRecommendation(pod),
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(health, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to check pod health: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async analyzeEvents(args: any) {
        const namespace = args.namespace || '--all-namespaces';
        const nsFlag = namespace === '--all-namespaces' ? '--all-namespaces' : `-n ${namespace}`;

        try {
            const { stdout } = await execAsync(
                `kubectl get events ${nsFlag} --sort-by='.lastTimestamp' -o json`,
                { maxBuffer: MAX_BUFFER }
            );
            const events = JSON.parse(stdout);

            const analysis = {
                totalEvents: events.items?.length || 0,
                warnings: events.items?.filter((e: any) => e.type === 'Warning').length || 0,
                recentEvents: (events.items || []).slice(-20).map((e: any) => ({
                    type: e.type,
                    reason: e.reason,
                    message: e.message,
                    object: `${e.involvedObject?.kind}/${e.involvedObject?.name}`,
                    namespace: e.involvedObject?.namespace,
                    timestamp: e.lastTimestamp || e.eventTime,
                })),
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(analysis, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to analyze events: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getResourceUsage(args: any) {
        const { resourceType, namespace } = args;

        try {
            let command = '';
            if (resourceType === 'nodes') {
                command = 'kubectl top nodes';
            } else if (resourceType === 'pods') {
                const nsFlag = namespace ? `-n ${namespace}` : '--all-namespaces';
                command = `kubectl top pods ${nsFlag}`;
            }

            const { stdout } = await execAsync(command, { maxBuffer: MAX_BUFFER });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Resource Usage:\n\n${stdout}`,
                    },
                ],
            };
        } catch (error) {
            // Metrics server might not be installed
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Metrics server not available. Install metrics-server to view resource usage.',
                    },
                ],
            };
        }
    }

    private async troubleshootPod(args: any) {
        const { podName, namespace } = args;

        try {
            // Get pod details
            const { stdout: podJson } = await execAsync(`kubectl get pod ${podName} -n ${namespace} -o json`, {
                maxBuffer: MAX_BUFFER,
            });
            const pod = JSON.parse(podJson);

            // Get pod events
            const uid = pod.metadata.uid;
            let events = [];
            try {
                const { stdout: eventsJson } = await execAsync(
                    `kubectl get events -n ${namespace} --field-selector involvedObject.uid=${uid} -o json`,
                    { maxBuffer: MAX_BUFFER }
                );
                events = JSON.parse(eventsJson).items || [];
            } catch (e) {
                // Events might not exist
            }

            // Get logs (last 50 lines)
            let logs = '';
            try {
                const { stdout: logsOutput } = await execAsync(
                    `kubectl logs ${podName} -n ${namespace} --tail=50`,
                    { maxBuffer: MAX_BUFFER }
                );
                logs = logsOutput;
            } catch (e) {
                logs = 'Unable to fetch logs';
            }

            const troubleshooting = {
                podName,
                namespace,
                status: pod.status?.phase,
                issues: this.identifyPodIssues(pod, events),
                recentEvents: events.slice(-10).map((e: any) => ({
                    type: e.type,
                    reason: e.reason,
                    message: e.message,
                })),
                logSummary: this.summarizeLogs(logs),
                recommendations: this.generatePodRecommendation(pod),
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(troubleshooting, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to troubleshoot pod: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async listFailingPods(args: any) {
        const namespace = args.namespace || '--all-namespaces';
        const nsFlag = namespace === '--all-namespaces' ? '--all-namespaces' : `-n ${namespace}`;

        try {
            const { stdout } = await execAsync(`kubectl get pods ${nsFlag} -o json`, {
                maxBuffer: MAX_BUFFER,
            });
            const pods = JSON.parse(stdout);

            const failingPods = (pods.items || [])
                .filter((pod: any) => {
                    const phase = pod.status?.phase;
                    const containerStatuses = pod.status?.containerStatuses || [];
                    const hasUnreadyContainers = containerStatuses.some((c: any) => !c.ready);
                    const hasRestarts = containerStatuses.some((c: any) => (c.restartCount || 0) > 0);

                    return (
                        phase !== 'Running' ||
                        phase === 'Succeeded' ||
                        hasUnreadyContainers ||
                        hasRestarts
                    );
                })
                .map((pod: any) => ({
                    name: pod.metadata.name,
                    namespace: pod.metadata.namespace,
                    phase: pod.status?.phase,
                    reason: pod.status?.reason,
                    restarts: (pod.status?.containerStatuses || []).reduce(
                        (acc: number, c: any) => acc + (c.restartCount || 0),
                        0
                    ),
                }));

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                count: failingPods.length,
                                pods: failingPods,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to list failing pods: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getClusterOverview(args: any) {
        try {
            const [
                { stdout: nodesJson },
                { stdout: podsJson },
                { stdout: namespacesJson },
            ] = await Promise.all([
                execAsync('kubectl get nodes -o json', { maxBuffer: MAX_BUFFER }),
                execAsync('kubectl get pods --all-namespaces -o json', { maxBuffer: MAX_BUFFER }),
                execAsync('kubectl get namespaces -o json', { maxBuffer: MAX_BUFFER }),
            ]);

            const nodes = JSON.parse(nodesJson);
            const pods = JSON.parse(podsJson);
            const namespaces = JSON.parse(namespacesJson);

            const overview = {
                cluster: {
                    nodes: {
                        total: nodes.items?.length || 0,
                        ready: (nodes.items || []).filter((n: any) =>
                            n.status?.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'True')
                        ).length,
                    },
                    namespaces: namespaces.items?.length || 0,
                    pods: {
                        total: pods.items?.length || 0,
                        running: (pods.items || []).filter((p: any) => p.status?.phase === 'Running').length,
                        pending: (pods.items || []).filter((p: any) => p.status?.phase === 'Pending').length,
                        failed: (pods.items || []).filter((p: any) => p.status?.phase === 'Failed').length,
                    },
                },
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(overview, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to get cluster overview: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async analyzeLogs(args: any) {
        const { podName, namespace, container, lines = 100 } = args;

        try {
            let command = `kubectl logs ${podName} -n ${namespace} --tail=${lines}`;
            if (container) {
                command += ` -c ${container}`;
            }

            const { stdout } = await execAsync(command, { maxBuffer: MAX_BUFFER });

            const analysis = {
                podName,
                namespace,
                container: container || 'default',
                summary: this.summarizeLogs(stdout),
                errors: this.extractErrors(stdout),
                warnings: this.extractWarnings(stdout),
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(analysis, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to analyze logs: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async execInPod(args: any) {
        const { podName, namespace, command, container } = args;

        // Security: Block dangerous commands
        const dangerousPatterns = [/rm\s+-rf/, /mkfs/, /dd\s+if=/, /:\(\)\s*\{/, />\s*\/dev/];
        if (dangerousPatterns.some(pattern => pattern.test(command))) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Error: This command is blocked for safety reasons.',
                    },
                ],
                isError: true,
            };
        }

        try {
            let execCommand = `kubectl exec ${podName} -n ${namespace}`;
            if (container) {
                execCommand += ` -c ${container}`;
            }
            execCommand += ` -- ${command}`;

            const { stdout, stderr } = await execAsync(execCommand, { maxBuffer: MAX_BUFFER });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            podName,
                            namespace,
                            command,
                            output: stdout || stderr,
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to exec in pod: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async describeResource(args: any) {
        const { resourceType, resourceName, namespace } = args;

        try {
            const { stdout } = await execAsync(
                `kubectl describe ${resourceType} ${resourceName} -n ${namespace}`,
                { maxBuffer: MAX_BUFFER }
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: stdout,
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to describe resource: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getNetworkPolicies(args: any) {
        const namespace = args.namespace || '--all-namespaces';
        const nsFlag = namespace === '--all-namespaces' ? '--all-namespaces' : `-n ${namespace}`;

        try {
            const { stdout } = await execAsync(
                `kubectl get networkpolicies ${nsFlag} -o json`,
                { maxBuffer: MAX_BUFFER }
            );
            const policies = JSON.parse(stdout);

            const analysis = (policies.items || []).map((np: any) => ({
                name: np.metadata.name,
                namespace: np.metadata.namespace,
                podSelector: np.spec?.podSelector,
                ingress: np.spec?.ingress?.length || 0,
                egress: np.spec?.egress?.length || 0,
                policyTypes: np.spec?.policyTypes || [],
            }));

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            count: analysis.length,
                            policies: analysis,
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to get network policies: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async checkServiceEndpoints(args: any) {
        const { serviceName, namespace } = args;

        try {
            const [{ stdout: svcJson }, { stdout: epJson }] = await Promise.all([
                execAsync(`kubectl get service ${serviceName} -n ${namespace} -o json`, { maxBuffer: MAX_BUFFER }),
                execAsync(`kubectl get endpoints ${serviceName} -n ${namespace} -o json`, { maxBuffer: MAX_BUFFER }),
            ]);

            const service = JSON.parse(svcJson);
            const endpoints = JSON.parse(epJson);

            const addresses = endpoints.subsets?.flatMap((s: any) =>
                (s.addresses || []).map((a: any) => ({
                    ip: a.ip,
                    targetRef: a.targetRef?.name,
                }))
            ) || [];

            const notReadyAddresses = endpoints.subsets?.flatMap((s: any) =>
                (s.notReadyAddresses || []).map((a: any) => ({
                    ip: a.ip,
                    targetRef: a.targetRef?.name,
                }))
            ) || [];

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            service: {
                                name: serviceName,
                                namespace,
                                type: service.spec?.type,
                                clusterIP: service.spec?.clusterIP,
                                ports: service.spec?.ports,
                                selector: service.spec?.selector,
                            },
                            endpoints: {
                                ready: addresses,
                                notReady: notReadyAddresses,
                            },
                            health: addresses.length > 0 ? 'healthy' : 'no endpoints',
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to check service endpoints: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getConfigMaps(args: any) {
        const { namespace, configMapName } = args;

        try {
            let command = `kubectl get configmap -n ${namespace} -o json`;
            if (configMapName) {
                command = `kubectl get configmap ${configMapName} -n ${namespace} -o json`;
            }

            const { stdout } = await execAsync(command, { maxBuffer: MAX_BUFFER });
            const result = JSON.parse(stdout);

            const configMaps = configMapName ? [result] : (result.items || []);
            const analysis = configMaps.map((cm: any) => ({
                name: cm.metadata.name,
                namespace: cm.metadata.namespace,
                dataKeys: Object.keys(cm.data || {}),
                created: cm.metadata.creationTimestamp,
            }));

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            count: analysis.length,
                            configMaps: analysis,
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to get configmaps: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getSecrets(args: any) {
        const { namespace, secretName } = args;

        try {
            let command = `kubectl get secret -n ${namespace} -o json`;
            if (secretName) {
                command = `kubectl get secret ${secretName} -n ${namespace} -o json`;
            }

            const { stdout } = await execAsync(command, { maxBuffer: MAX_BUFFER });
            const result = JSON.parse(stdout);

            const secrets = secretName ? [result] : (result.items || []);
            const analysis = secrets.map((s: any) => ({
                name: s.metadata.name,
                namespace: s.metadata.namespace,
                type: s.type,
                dataKeys: Object.keys(s.data || {}),
                created: s.metadata.creationTimestamp,
                // Don't expose actual secret values
            }));

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            count: analysis.length,
                            secrets: analysis,
                            note: 'Secret values are not displayed for security reasons',
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to get secrets: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async rolloutStatus(args: any) {
        const { resourceType, resourceName, namespace } = args;

        try {
            const [{ stdout: statusOutput }, { stdout: resourceJson }] = await Promise.all([
                execAsync(
                    `kubectl rollout status ${resourceType}/${resourceName} -n ${namespace} --timeout=5s`,
                    { maxBuffer: MAX_BUFFER }
                ).catch(e => ({ stdout: e.message })),
                execAsync(
                    `kubectl get ${resourceType} ${resourceName} -n ${namespace} -o json`,
                    { maxBuffer: MAX_BUFFER }
                ),
            ]);

            const resource = JSON.parse(resourceJson);
            const status = resource.status || {};

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            resourceType,
                            resourceName,
                            namespace,
                            status: statusOutput.trim(),
                            replicas: {
                                desired: status.replicas,
                                ready: status.readyReplicas,
                                available: status.availableReplicas,
                                updated: status.updatedReplicas,
                            },
                            conditions: status.conditions?.map((c: any) => ({
                                type: c.type,
                                status: c.status,
                                reason: c.reason,
                                message: c.message,
                            })),
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to get rollout status: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async portForwardInfo(args: any) {
        const { resourceType, resourceName, namespace } = args;

        try {
            const { stdout } = await execAsync(
                `kubectl get ${resourceType} ${resourceName} -n ${namespace} -o json`,
                { maxBuffer: MAX_BUFFER }
            );
            const resource = JSON.parse(stdout);

            let ports: any[] = [];
            if (resourceType === 'pod') {
                ports = resource.spec?.containers?.flatMap((c: any) =>
                    (c.ports || []).map((p: any) => ({
                        container: c.name,
                        containerPort: p.containerPort,
                        protocol: p.protocol || 'TCP',
                    }))
                ) || [];
            } else if (resourceType === 'service') {
                ports = (resource.spec?.ports || []).map((p: any) => ({
                    name: p.name,
                    port: p.port,
                    targetPort: p.targetPort,
                    protocol: p.protocol || 'TCP',
                }));
            }

            const commands = ports.map((p: any) => {
                const localPort = p.containerPort || p.port;
                const remotePort = p.containerPort || p.port;
                return `kubectl port-forward ${resourceType}/${resourceName} -n ${namespace} ${localPort}:${remotePort}`;
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            resourceType,
                            resourceName,
                            namespace,
                            ports,
                            commands,
                            usage: 'Run one of the commands above to forward the port locally',
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to get port forward info: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getIngress(args: any) {
        const namespace = args.namespace || '--all-namespaces';
        const nsFlag = namespace === '--all-namespaces' ? '--all-namespaces' : `-n ${namespace}`;
        const { ingressName } = args;

        try {
            let command = `kubectl get ingress ${nsFlag} -o json`;
            if (ingressName && namespace !== '--all-namespaces') {
                command = `kubectl get ingress ${ingressName} -n ${namespace} -o json`;
            }

            const { stdout } = await execAsync(command, { maxBuffer: MAX_BUFFER });
            const result = JSON.parse(stdout);

            const ingresses = ingressName ? [result] : (result.items || []);
            const analysis = ingresses.map((ing: any) => ({
                name: ing.metadata.name,
                namespace: ing.metadata.namespace,
                className: ing.spec?.ingressClassName,
                rules: ing.spec?.rules?.map((r: any) => ({
                    host: r.host,
                    paths: r.http?.paths?.map((p: any) => ({
                        path: p.path,
                        pathType: p.pathType,
                        backend: p.backend?.service ? {
                            serviceName: p.backend.service.name,
                            servicePort: p.backend.service.port?.number || p.backend.service.port?.name,
                        } : null,
                    })),
                })),
                tls: ing.spec?.tls?.map((t: any) => ({
                    hosts: t.hosts,
                    secretName: t.secretName,
                })),
                loadBalancer: ing.status?.loadBalancer?.ingress,
            }));

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            count: analysis.length,
                            ingresses: analysis,
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to get ingress: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async checkPVCStatus(args: any) {
        const namespace = args.namespace || '--all-namespaces';
        const nsFlag = namespace === '--all-namespaces' ? '--all-namespaces' : `-n ${namespace}`;
        const { pvcName } = args;

        try {
            let command = `kubectl get pvc ${nsFlag} -o json`;
            if (pvcName && namespace !== '--all-namespaces') {
                command = `kubectl get pvc ${pvcName} -n ${namespace} -o json`;
            }

            const { stdout } = await execAsync(command, { maxBuffer: MAX_BUFFER });
            const result = JSON.parse(stdout);

            const pvcs = pvcName ? [result] : (result.items || []);
            const analysis = pvcs.map((pvc: any) => ({
                name: pvc.metadata.name,
                namespace: pvc.metadata.namespace,
                status: pvc.status?.phase,
                capacity: pvc.status?.capacity?.storage,
                accessModes: pvc.status?.accessModes,
                storageClass: pvc.spec?.storageClassName,
                volumeName: pvc.spec?.volumeName,
                issues: pvc.status?.phase !== 'Bound' ? [`PVC is ${pvc.status?.phase}, not Bound`] : [],
            }));

            const problems = analysis.filter((p: any) => p.issues.length > 0);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            count: analysis.length,
                            healthy: analysis.length - problems.length,
                            problems: problems.length,
                            pvcs: analysis,
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to check PVC status: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async helmList(args: any) {
        const namespace = args.namespace || '';
        const nsFlag = namespace ? `-n ${namespace}` : '-A';

        try {
            const { stdout } = await execAsync(`helm list ${nsFlag} -o json`, { maxBuffer: MAX_BUFFER });
            const releases = JSON.parse(stdout);

            const analysis = releases.map((r: any) => ({
                name: r.name,
                namespace: r.namespace,
                revision: r.revision,
                updated: r.updated,
                status: r.status,
                chart: r.chart,
                appVersion: r.app_version,
                issues: r.status !== 'deployed' ? [`Release status is ${r.status}`] : [],
            }));

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            count: analysis.length,
                            releases: analysis,
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Helm not found or error listing releases: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    }

    private async helmHistory(args: any) {
        const { releaseName, namespace } = args;

        try {
            const { stdout } = await execAsync(`helm history ${releaseName} -n ${namespace} -o json`, { maxBuffer: MAX_BUFFER });
            const history = JSON.parse(stdout);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            releaseName,
                            namespace,
                            history: history.map((h: any) => ({
                                revision: h.revision,
                                updated: h.updated,
                                status: h.status,
                                chart: h.chart,
                                appVersion: h.app_version,
                                description: h.description,
                            })),
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to get helm history: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async analyzeDeployment(args: any) {
        const { deploymentName, namespace } = args;

        try {
            const [
                { stdout: depJson },
                { stdout: podsJson },
                { stdout: eventsJson }
            ] = await Promise.all([
                execAsync(`kubectl get deployment ${deploymentName} -n ${namespace} -o json`, { maxBuffer: MAX_BUFFER }),
                execAsync(`kubectl get pods -n ${namespace} -l app=${deploymentName} -o json`, { maxBuffer: MAX_BUFFER }).catch(() => ({ stdout: '{"items":[]}' })),
                execAsync(`kubectl get events -n ${namespace} --field-selector involvedObject.name=${deploymentName} -o json`, { maxBuffer: MAX_BUFFER }).catch(() => ({ stdout: '{"items":[]}' }))
            ]);

            const deployment = JSON.parse(depJson);
            const pods = JSON.parse(podsJson);
            const events = JSON.parse(eventsJson);

            const status = deployment.status || {};
            const issues: string[] = [];

            if (status.unavailableReplicas > 0) {
                issues.push(`${status.unavailableReplicas} replicas are unavailable`);
            }

            const podRestarts = (pods.items || []).reduce((acc: number, pod: any) => {
                const restarts = (pod.status?.containerStatuses || []).reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0);
                return acc + restarts;
            }, 0);

            if (podRestarts > 0) {
                issues.push(`Multiple pod restarts detected (${podRestarts} total)`);
            }

            const analysis = {
                name: deploymentName,
                namespace,
                replicas: {
                    desired: deployment.spec?.replicas,
                    updated: status.updatedReplicas,
                    ready: status.readyReplicas,
                    available: status.availableReplicas,
                    unavailable: status.unavailableReplicas || 0,
                },
                strategy: deployment.spec?.strategy?.type,
                conditions: status.conditions?.map((c: any) => ({
                    type: c.type,
                    status: c.status,
                    reason: c.reason,
                    message: c.message,
                })),
                podRestarts,
                issues,
                recentEvents: (events.items || []).slice(-5).map((e: any) => ({
                    reason: e.reason,
                    message: e.message,
                    type: e.type,
                })),
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(analysis, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to analyze deployment: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async analyzeMemoryUsage(args: any) {
        const namespace = args.namespace || '--all-namespaces';
        const nsFlag = namespace === '--all-namespaces' ? '--all-namespaces' : `-n ${namespace}`;

        try {
            const [
                { stdout: topPods },
                { stdout: podsJson }
            ] = await Promise.all([
                execAsync(`kubectl top pods ${nsFlag}`).catch(() => ({ stdout: '' })),
                execAsync(`kubectl get pods ${nsFlag} -o json`, { maxBuffer: MAX_BUFFER })
            ]);

            const pods = JSON.parse(podsJson);
            const memoryIssues: any[] = [];

            // Parse top output if available
            const topLines = topPods.trim().split('\n').slice(1);
            const usageMap = new Map();
            topLines.forEach(line => {
                const parts = line.split(/\s+/);
                if (parts.length >= 3) {
                    const name = parts[0];
                    const mem = parts[2];
                    usageMap.set(name, mem);
                }
            });

            for (const pod of pods.items || []) {
                const podName = pod.metadata.name;
                const podNs = pod.metadata.namespace;
                const containerStatuses = pod.status?.containerStatuses || [];

                for (const status of containerStatuses) {
                    // Check for OOMKilled
                    const lastState = status.lastState?.terminated;
                    const currentState = status.state?.terminated;

                    if (lastState?.reason === 'OOMKilled' || currentState?.reason === 'OOMKilled') {
                        memoryIssues.push({
                            pod: `${podNs}/${podName}`,
                            container: status.name,
                            issue: 'OOMKilled',
                            exitCode: (lastState || currentState).exitCode,
                            finishedAt: (lastState || currentState).finishedAt,
                            recommendation: 'Increase memory limits in deployment spec',
                        });
                    }

                    // Check if usage is close to limit
                    const containerSpec = pod.spec?.containers?.find((c: any) => c.name === status.name);
                    const limit = containerSpec?.resources?.limits?.memory;
                    const usage = usageMap.get(podName);

                    if (limit && usage) {
                        // Very rough comparison (e.g., "128Mi" vs "100Mi")
                        // In a real implementation we'd normalize these units
                        memoryIssues.push({
                            pod: `${podNs}/${podName}`,
                            container: status.name,
                            issue: 'Resource Check',
                            usage,
                            limit,
                            note: 'Compare usage vs limit to check for near-OOM conditions',
                        });
                    }
                }
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            namespace: namespace === '--all-namespaces' ? 'all' : namespace,
                            oomEventsFound: memoryIssues.length,
                            details: memoryIssues,
                            note: 'Metrics server is required for live usage data',
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Failed to analyze memory usage: ${error instanceof Error ? error.message : String(error)}`);
        }
    }


    private generatePodRecommendation(pod: any): string[] {
        const recommendations: string[] = [];
        const phase = pod.status?.phase;
        const containerStatuses = pod.status?.containerStatuses || [];

        if (phase === 'Pending') {
            recommendations.push('Check if there are sufficient resources in the cluster');
            recommendations.push('Verify node selectors and affinity rules');
            recommendations.push('Check for PersistentVolumeClaim binding issues');
        }

        if (phase === 'Failed') {
            recommendations.push('Review pod logs for error messages');
            recommendations.push('Check container exit codes');
            recommendations.push('Verify image pull secrets and registry access');
        }

        for (const container of containerStatuses) {
            if (container.state?.waiting?.reason === 'ImagePullBackOff') {
                recommendations.push(`Container ${container.name}: Verify image name and registry credentials`);
            }
            if (container.state?.waiting?.reason === 'CrashLoopBackOff') {
                recommendations.push(`Container ${container.name}: Application is crashing, check logs for errors`);
            }
            if ((container.restartCount || 0) > 5) {
                recommendations.push(`Container ${container.name}: High restart count, investigate stability issues`);
            }
        }

        return recommendations.length > 0 ? recommendations : ['Pod appears healthy'];
    }

    private identifyPodIssues(pod: any, events: any[]): string[] {
        const issues: string[] = [];

        // Check pod phase
        const phase = pod.status?.phase;
        if (phase !== 'Running' && phase !== 'Succeeded') {
            issues.push(`Pod is in ${phase} state`);
        }

        // Check container statuses
        const containerStatuses = pod.status?.containerStatuses || [];
        for (const container of containerStatuses) {
            if (!container.ready) {
                issues.push(`Container ${container.name} is not ready`);
            }
            if (container.state?.waiting) {
                issues.push(`Container ${container.name} is waiting: ${container.state.waiting.reason}`);
            }
            if (container.state?.terminated) {
                issues.push(
                    `Container ${container.name} terminated: ${container.state.terminated.reason} (exit code: ${container.state.terminated.exitCode})`
                );
            }
        }

        // Check events
        const warningEvents = events.filter((e: any) => e.type === 'Warning');
        for (const event of warningEvents) {
            issues.push(`Event: ${event.reason} - ${event.message}`);
        }

        return issues;
    }

    private summarizeLogs(logs: string): string {
        const lines = logs.split('\n');
        const errorCount = lines.filter((l) =>
            /error|exception|fatal|panic/i.test(l)
        ).length;
        const warningCount = lines.filter((l) => /warn|warning/i.test(l)).length;

        return `Total lines: ${lines.length}, Errors: ${errorCount}, Warnings: ${warningCount}`;
    }

    private extractErrors(logs: string): string[] {
        return logs
            .split('\n')
            .filter((l) => /error|exception|fatal|panic/i.test(l))
            .slice(-10); // Last 10 errors
    }

    private extractWarnings(logs: string): string[] {
        return logs
            .split('\n')
            .filter((l) => /warn|warning/i.test(l))
            .slice(-10); // Last 10 warnings
    }

    async run(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Kubernetes MCP Server running on stdio');
    }
}

// Start the server
const server = new KubernetesMCPServer();
server.run().catch(console.error);

// Add global error handlers to capture unhandled errors
process.on('unhandledRejection', (reason) => {
    console.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', (error) => {
    console.error('[Uncaught Exception]', error);
    process.exit(1); // Exit with error code
});

// Add detailed logging for server startup and shutdown
console.error('[MCP Server] Initializing Kubernetes MCP Server...');

process.on('exit', (code) => {
    console.error(`[MCP Server] Process exiting with code ${code}`);
});

process.on('SIGTERM', async () => {
    console.error('[MCP Server] Received SIGTERM, shutting down...');
    process.exit(0);
});
