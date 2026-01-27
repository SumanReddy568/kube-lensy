import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import fixPath from 'fix-path';

// Fix PATH for K8s tools on macOS
fixPath();

// Kubernetes types
interface KubernetesNamespace {
    metadata: {
        name: string;
    };
}

interface ManualNamespace {
    name: string;
    cluster: string;
}

interface KubernetesEvent {
    type: string;
    reason: string;
    message: string;
    lastTimestamp?: string;
    eventTime?: string;
    firstTimestamp?: string;
    count: number;
}

// Fix for __dirname and __filename in both ESM and CJS
const getDirname = () => {
    try {
        return path.dirname(fileURLToPath(import.meta.url));
    } catch {
        return __dirname;
    }
};

const _dirname = getDirname();

const execAsync = promisify(exec);
const MAX_BUFFER = 1024 * 1024 * 50; // 50MB buffer for large K8s outputs

async function execWithTimeout(command: string, timeoutMs: number = 10000) {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
        }, timeoutMs);

        exec(command, { maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => {
            clearTimeout(timeout);
            if (error) {
                reject(error);
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}
const app = express();
const port = 3001;

// Simple in-memory cache with TTL
class Cache<T> {
    private store = new Map<string, { data: T; expires: number }>();

    get(key: string): T | undefined {
        const item = this.store.get(key);
        if (item && item.expires > Date.now()) {
            return item.data;
        }
        this.store.delete(key);
        return undefined;
    }

    set(key: string, data: T, ttlMs: number): void {
        this.store.set(key, { data, expires: Date.now() + ttlMs });
    }

    clear(): void {
        this.store.clear();
    }
}

const apiCache = new Cache<unknown>();

const STORAGE_PATH = process.env.USER_DATA_PATH || _dirname;
const MANUAL_NAMESPACES_FILE = path.join(STORAGE_PATH, 'manual-namespaces.json');

function getManualNamespaces(): ManualNamespace[] {
    try {
        if (fs.existsSync(MANUAL_NAMESPACES_FILE)) {
            const content = fs.readFileSync(MANUAL_NAMESPACES_FILE, 'utf-8');
            const parsed = JSON.parse(content);
            return Array.isArray(parsed) ? parsed : [];
        }
    } catch (e) {
        console.error('Failed to read manual namespaces:', e);
    }
    return [];
}

function saveManualNamespace(ns: ManualNamespace) {
    const list = getManualNamespaces();
    if (!list.some(item => item.name === ns.name && item.cluster === ns.cluster)) {
        list.push(ns);
        if (!fs.existsSync(STORAGE_PATH)) {
            fs.mkdirSync(STORAGE_PATH, { recursive: true });
        }
        fs.writeFileSync(MANUAL_NAMESPACES_FILE, JSON.stringify(list, null, 2));
        apiCache.clear();
    }
}

const cacheMiddleware = (ttlMs: number) => (req: Request, res: Response, next: NextFunction) => {
    const key = req.originalUrl;
    const cachedData = apiCache.get(key);
    if (cachedData) {
        return res.json(cachedData);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
        apiCache.set(key, body, ttlMs);
        return originalJson(body);
    };
    next();
};



// Enhanced logging that captures everything to backend.log
const writeToLog = (type: 'STDOUT' | 'STDERR', msg: string) => {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${type}] ${msg}\n`;
    if (type === 'STDOUT') {
        process.stdout.write(formatted);
    } else {
        process.stderr.write(formatted);
    }
};

// Use standard console for production-like behavior
console.log = (msg: any, ...args: any[]) => {
    const output = typeof msg === 'string' ? msg : JSON.stringify(msg);
    process.stdout.write(`[STDOUT] ${output}\n`);
};
console.error = (msg: any, ...args: any[]) => {
    const output = typeof msg === 'string' ? msg : JSON.stringify(msg);
    process.stderr.write(`[STDERR] ${output}\n`);
};

// Request logging middleware (must be FIRST)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[NETWORK] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    });
    next();
});

app.use(cors());
app.use(compression());
app.use(express.json());

console.log('!!! KubeLensy Backend Logger Initialized !!!');

// Lightweight health check for connection status polling
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/clusters', cacheMiddleware(60000), async (req, res) => {
    try {
        const [
            { stdout: contextsOutput },
            { stdout: currentContext }
        ] = await Promise.all([
            execWithTimeout('kubectl config get-contexts -o name', 5000),
            execWithTimeout('kubectl config current-context', 5000)
        ]);

        const contexts = contextsOutput.split('\n').filter(Boolean);

        res.json(contexts.map(name => ({
            id: name,
            name: name,
            status: name === currentContext.trim() ? 'connected' : 'disconnected'
        })));
    } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
    }
});

app.post('/api/clusters/switch', async (req, res) => {
    const { id } = req.body;
    try {
        await execWithTimeout(`kubectl config use-context ${id}`, 15000); // Give it 15s for cluster switch
        apiCache.clear(); // Invalidate cache on cluster switch
        res.json({ success: true });
    } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
    }
});

app.get('/api/namespaces', cacheMiddleware(10000), async (req, res) => {
    try {
        const [
            { stdout: contextsOutput },
            { stdout: currentContextOutput }
        ] = await Promise.all([
            execWithTimeout('kubectl config get-contexts -o name', 5000),
            execWithTimeout('kubectl config current-context', 5000)
        ]);

        const contexts = contextsOutput.split('\n').filter(Boolean);
        const currentContext = currentContextOutput.trim();

        const manualNamespaces = new Set<string>();
        const persistedManualNamespaces = getManualNamespaces()
            .filter(ns => ns.cluster === currentContext)
            .map(ns => ns.name);

        persistedManualNamespaces.forEach(name => manualNamespaces.add(name));

        // Also try to get all namespaces mentioned in kubeconfig for the current context's cluster
        const { stdout: allContextsJson } = await execWithTimeout('kubectl config view -o json', 5000);
        const kubeconfig = JSON.parse(allContextsJson);

        // Find the cluster name for the current context
        const currentContextObj = kubeconfig.contexts?.find((ctx: any) => ctx.name === currentContext);
        const currentClusterName = currentContextObj?.context?.cluster;

        if (kubeconfig.contexts) {
            kubeconfig.contexts.forEach((ctx: any) => {
                // Only include if it matches the current cluster to avoid showing "all namespaces" from other clusters
                if (ctx.context?.cluster === currentClusterName && ctx.context?.namespace) {
                    manualNamespaces.add(ctx.context.namespace);
                }
            });
        }

        try {
            const { stdout } = await execWithTimeout('kubectl get namespaces -o json', 10000);
            const data = JSON.parse(stdout);
            const discoveredNamespaces = (data.items || []).map((ns: KubernetesNamespace) => ns.metadata.name);

            // Merge discovered and manual namespaces
            const allNamespaces = new Set([...discoveredNamespaces, ...Array.from(manualNamespaces)]);

            res.json(Array.from(allNamespaces).map(name => ({
                name,
                cluster: currentContext,
            })));
        } catch (error: unknown) {
            // Handle Forbidden/RBAC errors gracefully
            if (error instanceof Error && (error.message.includes('Forbidden') || error.message.includes('forbidden'))) {
                console.warn('Listing namespaces forbidden, falling back to manual namespaces or "default"');
                const fallbackNamespaces = manualNamespaces.size > 0
                    ? Array.from(manualNamespaces)
                    : ['default'];

                return res.json(fallbackNamespaces.map(name => ({
                    name,
                    cluster: currentContext,
                })));
            }
            throw error;
        }
    } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
    }
});

app.post('/api/namespaces/manual', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const { stdout: currentContextOutput } = await execWithTimeout('kubectl config current-context', 5000);
        const currentContext = currentContextOutput.trim();

        saveManualNamespace({ name, cluster: currentContext });
        res.json({ success: true });
    } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
    }
});

app.get('/api/pods', cacheMiddleware(5000), async (req, res) => {
    const { namespace } = req.query;
    try {
        const { stdout: currentContext } = await execWithTimeout('kubectl config current-context', 5000);
        const clusterName = currentContext.trim();

        const nsArg = namespace ? `-n ${namespace}` : '--all-namespaces';
        try {
            const { stdout } = await execWithTimeout(`kubectl get pods ${nsArg} -o json`, 20000); // Pods can take longer
            const data = JSON.parse(stdout);

            const pods = (data.items || []).map((item: any) => {
                const containerStatuses = item.status?.containerStatuses || [];
                const restartCount = containerStatuses.reduce((acc: number, c: any) => acc + (c.restartCount || 0), 0);
                const readyCount = containerStatuses.filter((c: any) => c.ready).length;
                const totalContainers = item.spec?.containers?.length || 0;

                return {
                    name: item.metadata.name,
                    namespace: item.metadata.namespace,
                    cluster: clusterName,
                    status: item.status?.phase || 'Unknown',
                    containers: item.spec?.containers?.map((c: any) => c.name) || [],
                    restartCount,
                    creationTimestamp: item.metadata.creationTimestamp,
                    ready: `${readyCount}/${totalContainers}`
                };
            });

            res.json(pods);
        } catch (error: unknown) {
            if (error instanceof Error && (error.message.includes('Forbidden') || error.message.includes('forbidden'))) {
                console.warn(`Listing pods in ${nsArg} forbidden`);
                return res.json([]);
            }
            // Handle cases where no resources are found, which can be an error for jsonpath
            if (error instanceof Error && error.message.includes('no resources found')) {
                return res.json([]);
            }
            throw error;
        }
    } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
    }
});

app.get('/api/pods/:pod/describe', async (req, res) => {
    const { pod } = req.params;
    const { namespace } = req.query;
    if (!namespace) return res.status(400).json({ error: 'Namespace is required' });

    try {
        const { stdout } = await execWithTimeout(`kubectl describe pod ${pod} -n ${namespace}`, 10000);
        res.send(stdout);
    } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
    }
});

app.get('/api/pods/:pod/events', cacheMiddleware(5000), async (req, res) => {
    const { pod } = req.params;
    const { namespace } = req.query;
    if (!namespace) return res.status(400).json({ error: 'Namespace is required' });

    try {
        // First, get the pod's UID
        const { stdout: uid } = await execWithTimeout(`kubectl get pod ${pod} -n ${namespace} -o jsonpath='{.metadata.uid}'`, 5000);

        if (!uid) {
            return res.json([]);
        }

        // Then, get events using the UID
        const { stdout } = await execWithTimeout(`kubectl get events -n ${namespace} --field-selector involvedObject.uid=${uid} -o json`, 10000);
        const data = JSON.parse(stdout);
        res.json((data.items || []).map((event: KubernetesEvent) => ({
            type: event.type,
            reason: event.reason,
            message: event.message,
            lastTimestamp: event.lastTimestamp || event.eventTime || event.firstTimestamp,
            count: event.count
        })));
    } catch (error: unknown) {
        // It's common for no events to be found, which can cause an error.
        if (error instanceof Error && error.message.toLowerCase().includes('no resources found')) {
            return res.json([]);
        }
        res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
    }
});

app.get('/api/logs', async (req, res) => {
    const { namespace, pod, container, tailLines = 100 } = req.query;
    if (!namespace || !pod) {
        return res.status(400).json({ error: 'Namespace and pod are required' });
    }

    try {
        let command = `kubectl logs -n ${namespace} ${pod} --tail=${tailLines} --timestamps=true`;
        if (container) {
            command += ` -c ${container}`;
        }

        try {
            const { stdout } = await execWithTimeout(command, 15000); // Logs can be slow
            res.send(stdout);
        } catch (error: any) {
            const errorMessage = error.message || String(error);
            if (errorMessage.includes('is terminated')) {
                console.log(`Container terminated, trying previous logs for ${pod}`);
                // Try fetching previous container logs
                const prevCommand = `${command} -p`;
                try {
                    const { stdout: prevStdout } = await execWithTimeout(prevCommand, 15000);
                    res.send(prevStdout);
                } catch (prevError) {
                    // If even previous fails, return empty or the original termination error
                    res.send(`[Container Terminated] ${errorMessage}`);
                }
            } else {
                throw error;
            }
        }
    } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
});

app.get('/api/logs/stream', (req, res) => {
    const { namespace, pod, container, tailLines = 10 } = req.query;
    if (!namespace || !pod) {
        return res.status(400).json({ error: 'Namespace and pod are required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const args = ['logs', '-n', namespace as string, pod as string, '-f', `--tail=${tailLines}`, '--timestamps=true'];
    if (container) {
        args.push('-c', container as string);
    }

    const kubectl = spawn('kubectl', args);
    let errorSent = false;

    kubectl.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach((line: string) => {
            if (line.trim()) {
                res.write(`data: ${line}\n\n`);
            }
        });
    });

    kubectl.stderr.on('data', (data) => {
        const msg = data.toString();
        console.error(`kubectl stderr: ${msg}`);
        if (msg.includes('is terminated')) {
            // If container is terminated, don't send an "error" event 
            // instead just end the stream normally or send a message
            res.write(`data: [Container Terminated] ${msg}\n\n`);
            return;
        }
        if (!errorSent) {
            res.write(`event: error\ndata: ${msg}\n\n`);
            errorSent = true;
        }
    });

    kubectl.on('close', (code) => {
        console.log(`kubectl process exited with code ${code}`);
        res.end();
    });

    req.on('close', () => {
        kubectl.kill();
    });
});

app.get('/api/debug/logs', (req, res) => {
    const logPath = path.join(STORAGE_PATH, 'backend.log');
    if (!fs.existsSync(logPath)) {
        return res.send('No logs found yet.');
    }
    const content = fs.readFileSync(logPath, 'utf-8');
    res.send(content);
});

app.get('/api/debug/logs/stream', (req, res) => {
    const logPath = path.join(STORAGE_PATH, 'backend.log');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!fs.existsSync(logPath)) {
        res.write('data: Waiting for logs...\n\n');
    }

    // Use tail -f to stream the log file
    const tail = spawn('tail', ['-f', '-n', '100', logPath]);

    tail.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach((line: string) => {
            if (line.trim()) {
                res.write(`data: ${line}\n\n`);
            }
        });
    });

    req.on('close', () => {
        tail.kill();
    });
});

app.get('/api/namespaces/:namespace/events', cacheMiddleware(5000), async (req, res) => {
    const { namespace } = req.params;
    try {
        const { stdout } = await execWithTimeout(`kubectl get events -n ${namespace} -o json`, 10000);
        const data = JSON.parse(stdout);
        res.json((data.items || []).map((event: KubernetesEvent) => ({
            type: event.type,
            reason: event.reason,
            message: event.message,
            lastTimestamp: event.lastTimestamp || event.eventTime || event.firstTimestamp,
            count: event.count
        })));
    } catch (error: unknown) {
        if (error instanceof Error && error.message.toLowerCase().includes('no resources found')) {
            return res.json([]);
        }
        res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
    }
});

// ============= MCP Server Integration =============
// AI-powered Kubernetes diagnostics

interface MCPRequest {
    tool: string;
    arguments?: Record<string, any>;
}

interface MCPResponse {
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}

// Spawn MCP server process
let mcpServerProcess: any = null;

function startMCPServer() {
    if (mcpServerProcess) return;

    try {
        // Detect if running from bundled version (dist-server/server.js)
        // In production bundle, mcp-server.js is in the same directory
        const bundledMcpPath = path.join(_dirname, 'mcp-server.js');
        const devMcpPath = path.join(_dirname, 'mcp-server.ts');
        const distMcpPath = path.join(_dirname, 'dist-server/mcp-server.js');

        let mcpPath: string = '';
        let command: string = '';
        // In Electron production, process.execPath is the Electron binary.
        // We must use it to spawn child processes that need to read from ASAR.
        // In dev (Node), process.execPath is just 'node'.
        const nodeExecutable = process.execPath;

        if (fs.existsSync(bundledMcpPath)) {
            // Running from dist-server/ - mcp-server.js is in same directory (Production)
            mcpPath = bundledMcpPath;
            command = nodeExecutable;
        } else if (fs.existsSync(distMcpPath)) {
            // Running from project root with dist-server built (Hybrid/Dev)
            mcpPath = distMcpPath;
            command = nodeExecutable;
        } else if (fs.existsSync(devMcpPath)) {
            // Development mode
            mcpPath = devMcpPath;
            command = 'tsx';
        }

        if (!mcpPath) {
            console.error(`MCP Server file not found. Checked: ${bundledMcpPath}, ${distMcpPath}, ${devMcpPath}`);
            return;
        }

        console.log(`Starting MCP Server: ${command} ${mcpPath}`);

        mcpServerProcess = spawn(command, [mcpPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                PATH: process.env.PATH,
                ELECTRON_RUN_AS_NODE: '1' // Crucial for Electron to act as Node
            }
        });

        mcpServerProcess.stderr.on('data', (data: Buffer) => {
            const msg = data.toString();
            console.error(`[MCP Server STDERR] ${msg}`);
        });

        mcpServerProcess.stdout.on('data', (data: Buffer) => {
            // Only log if it's not JSON (to avoid cluttering logs with protocol messages)
            const msg = data.toString();
            if (!msg.trim().startsWith('{')) {
                console.log(`[MCP Server STDOUT] ${msg}`);
            }
        });

        mcpServerProcess.on('error', (err: Error) => {
            console.error('[MCP Server Process Error]', err);
        });

        mcpServerProcess.on('close', (code: number) => {
            console.log(`MCP Server process exited with code ${code}`);
            mcpServerProcess = null;
        });

        console.log('MCP Server spawned successfully');
    } catch (error) {
        console.error('Failed to start MCP Server:', error);
    }
}

// Start MCP server on initialization
startMCPServer();

async function callMCPTool(tool: string, args: Record<string, any> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        if (!mcpServerProcess) {
            startMCPServer();
            setTimeout(() => {
                if (!mcpServerProcess) {
                    return reject(new Error('MCP Server failed to start'));
                }
            }, 1000);
        }

        const request = {
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
                name: tool,
                arguments: args
            }
        };

        let responseData = '';
        const timeout = setTimeout(() => {
            reject(new Error('MCP request timeout'));
        }, 30000);

        const onData = (data: Buffer) => {
            responseData += data.toString();
            try {
                const response = JSON.parse(responseData);
                clearTimeout(timeout);
                mcpServerProcess.stdout.off('data', onData);

                if (response.error) {
                    reject(new Error(response.error.message || 'MCP error'));
                } else {
                    resolve(response.result);
                }
            } catch (e) {
                // Not complete JSON yet, wait for more data
            }
        };

        const onExit = (code: number) => {
            clearTimeout(timeout);
            mcpServerProcess?.stdout?.off('data', onData);
            reject(new Error(`MCP Server crashed with code ${code} during request`));
        };

        mcpServerProcess.once('close', onExit);
        mcpServerProcess.stdout.on('data', onData);
        mcpServerProcess.stdin.write(JSON.stringify(request) + '\n');

        // Clean up the exit listener once we have a response
        const originalResolve = resolve;
        resolve = (value: any) => {
            mcpServerProcess?.off('close', onExit);
            originalResolve(value);
        };
        const originalReject = reject;
        reject = (reason: any) => {
            mcpServerProcess?.off('close', onExit);
            originalReject(reason);
        };
    });
}

// AI Diagnostics endpoint - main entry point for natural language queries
app.post('/api/ai/diagnose', async (req, res) => {
    const { prompt, namespace } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        // Parse the prompt to determine which MCP tool to use
        const tool = determineToolFromPrompt(prompt);
        const args: Record<string, any> = {};

        if (namespace) args.namespace = namespace;

        // Extract additional parameters from prompt
        const podMatch = prompt.match(/pod[:\s]+([a-z0-9-]+)/i);
        if (podMatch) args.podName = podMatch[1];

        const result = await callMCPTool(tool, args);

        res.json({
            tool,
            result,
            prompt
        });
    } catch (error: unknown) {
        console.error('AI Diagnose error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
});

// Specific diagnostic endpoints
app.post('/api/ai/cluster-health', async (req, res) => {
    const { namespace } = req.body;

    try {
        const result = await callMCPTool('diagnose_cluster', { namespace });
        res.json(result);
    } catch (error: unknown) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
});

app.post('/api/ai/troubleshoot-pod', async (req, res) => {
    const { podName, namespace } = req.body;

    if (!podName || !namespace) {
        return res.status(400).json({ error: 'podName and namespace are required' });
    }

    try {
        const result = await callMCPTool('troubleshoot_pod', { podName, namespace });
        res.json(result);
    } catch (error: unknown) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
});

app.get('/api/ai/failing-pods', async (req, res) => {
    const { namespace } = req.query;

    try {
        const result = await callMCPTool('list_failing_pods', { namespace });
        res.json(result);
    } catch (error: unknown) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
});

app.get('/api/ai/cluster-overview', async (req, res) => {
    try {
        const result = await callMCPTool('get_cluster_overview', {});
        res.json(result);
    } catch (error: unknown) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
});

// Helper function to determine which tool to use based on prompt
function determineToolFromPrompt(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('troubleshoot') || lowerPrompt.includes('debug')) {
        return 'troubleshoot_pod';
    }
    if (lowerPrompt.includes('failing') || lowerPrompt.includes('failed')) {
        return 'list_failing_pods';
    }
    if (lowerPrompt.includes('health') || lowerPrompt.includes('check')) {
        if (lowerPrompt.includes('pod')) {
            return 'check_pod_health';
        }
        return 'diagnose_cluster';
    }
    if (lowerPrompt.includes('event')) {
        return 'analyze_events';
    }
    if (lowerPrompt.includes('resource') || lowerPrompt.includes('usage') || lowerPrompt.includes('cpu') || lowerPrompt.includes('memory')) {
        return 'get_resource_usage';
    }
    if (lowerPrompt.includes('log')) {
        return 'analyze_logs';
    }
    if (lowerPrompt.includes('overview') || lowerPrompt.includes('summary')) {
        return 'get_cluster_overview';
    }

    // Default to cluster diagnosis
    return 'diagnose_cluster';
}

// Serve static files from the Vite build
const distPath = fs.existsSync(path.join(_dirname, 'dist'))
    ? path.join(_dirname, 'dist')
    : path.join(_dirname, '../dist');

if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('/debug', (req, res) => {
        const paths = [
            path.join(distPath, 'debug.html'),
            path.join(_dirname, 'public/debug.html'),
            path.join(_dirname, '../public/debug.html')
        ];
        const found = paths.find(p => fs.existsSync(p));
        if (found) return res.sendFile(found);
        res.status(404).send('Debugger UI not found');
    });

    app.get('*fallback', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    console.warn('Dist folder not found, skipping static file serving. This is normal in development mode.');
}

app.listen(port, () => {
    console.log(`Kube-Lensy Backend running at http://localhost:${port}`);
});
