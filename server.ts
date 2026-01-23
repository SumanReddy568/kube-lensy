import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

const MANUAL_NAMESPACES_FILE = path.join(_dirname, 'manual-namespaces.json');

function getManualNamespaces(): ManualNamespace[] {
    try {
        if (fs.existsSync(MANUAL_NAMESPACES_FILE)) {
            const content = fs.readFileSync(MANUAL_NAMESPACES_FILE, 'utf-8');
            return JSON.parse(content);
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


app.use(cors());
app.use(compression()); // Enable gzip compression
app.use(express.json());

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
            execAsync('kubectl config get-contexts -o name', { maxBuffer: MAX_BUFFER }),
            execAsync('kubectl config current-context', { maxBuffer: MAX_BUFFER })
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
        await execAsync(`kubectl config use-context ${id}`, { maxBuffer: MAX_BUFFER });
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
            execAsync('kubectl config get-contexts -o name', { maxBuffer: MAX_BUFFER }),
            execAsync('kubectl config current-context', { maxBuffer: MAX_BUFFER })
        ]);

        const contexts = contextsOutput.split('\n').filter(Boolean);
        const currentContext = currentContextOutput.trim();

        const manualNamespaces = new Set<string>();
        const persistedManualNamespaces = getManualNamespaces()
            .filter(ns => ns.cluster === currentContext)
            .map(ns => ns.name);

        persistedManualNamespaces.forEach(name => manualNamespaces.add(name));

        // Also try to get all namespaces mentioned in kubeconfig for the current context's cluster
        const { stdout: allContextsJson } = await execAsync('kubectl config view -o json', { maxBuffer: MAX_BUFFER });
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
            const { stdout } = await execAsync('kubectl get namespaces -o json', { maxBuffer: MAX_BUFFER });
            const data = JSON.parse(stdout);
            const discoveredNamespaces = data.items.map((ns: KubernetesNamespace) => ns.metadata.name);

            // Merge discovered and manual namespaces
            const allNamespaces = new Set([...discoveredNamespaces, ...Array.from(manualNamespaces)]);

            res.json(Array.from(allNamespaces).map(name => ({
                name,
                cluster: currentContext, // Associate with current cluster for now
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
        const { stdout: currentContextOutput } = await execAsync('kubectl config current-context', { maxBuffer: MAX_BUFFER });
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
        const { stdout: currentContext } = await execAsync('kubectl config current-context', { maxBuffer: MAX_BUFFER });
        const clusterName = currentContext.trim();

        const nsArg = namespace ? `-n ${namespace}` : '--all-namespaces';
        try {
            const { stdout } = await execAsync(`kubectl get pods ${nsArg} -o json`, { maxBuffer: MAX_BUFFER });
            const data = JSON.parse(stdout);

            const pods = data.items.map((item: any) => {
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
        const { stdout } = await execAsync(`kubectl describe pod ${pod} -n ${namespace}`, { maxBuffer: MAX_BUFFER });
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
        const { stdout: uid } = await execAsync(`kubectl get pod ${pod} -n ${namespace} -o jsonpath='{.metadata.uid}'`, { maxBuffer: MAX_BUFFER });

        if (!uid) {
            return res.json([]);
        }

        // Then, get events using the UID
        const { stdout } = await execAsync(`kubectl get events -n ${namespace} --field-selector involvedObject.uid=${uid} -o json`, { maxBuffer: MAX_BUFFER });
        const data = JSON.parse(stdout);
        res.json(data.items.map((event: KubernetesEvent) => ({
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

        const { stdout } = await execAsync(command, { maxBuffer: MAX_BUFFER });
        res.send(stdout);
    } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
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

    kubectl.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach((line: string) => {
            if (line.trim()) {
                res.write(`data: ${line}\n\n`);
            }
        });
    });

    kubectl.stderr.on('data', (data) => {
        console.error(`kubectl stderr: ${data}`);
        res.write(`event: error\ndata: ${data}\n\n`);
    });

    kubectl.on('close', (code) => {
        console.log(`kubectl process exited with code ${code}`);
        res.end();
    });

    req.on('close', () => {
        kubectl.kill();
    });
});

app.get('/api/namespaces/:namespace/events', cacheMiddleware(5000), async (req, res) => {
    const { namespace } = req.params;
    try {
        const { stdout } = await execAsync(`kubectl get events -n ${namespace} -o json`, { maxBuffer: MAX_BUFFER });
        const data = JSON.parse(stdout);
        res.json(data.items.map((event: KubernetesEvent) => ({
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

// Serve static files from the Vite build
const distPath = fs.existsSync(path.join(_dirname, 'dist'))
    ? path.join(_dirname, 'dist')
    : path.join(_dirname, '../dist');

if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*fallback', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    console.warn('Dist folder not found, skipping static file serving. This is normal in development mode.');
}

app.listen(port, () => {
    console.log(`Kube-Lensy Backend running at http://localhost:${port}`);
});
