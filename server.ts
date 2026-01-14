import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

app.use(cors());
app.use(express.json());

app.get('/api/clusters', async (req, res) => {
    try {
        const { stdout } = await execAsync('kubectl config get-contexts -o name', { maxBuffer: MAX_BUFFER });
        const contexts = stdout.split('\n').filter(Boolean);
        const { stdout: currentContext } = await execAsync('kubectl config current-context', { maxBuffer: MAX_BUFFER });

        res.json(contexts.map(name => ({
            id: name,
            name: name,
            status: name === currentContext.trim() ? 'connected' : 'disconnected'
        })));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/clusters/switch', async (req, res) => {
    const { id } = req.body;
    try {
        await execAsync(`kubectl config use-context ${id}`, { maxBuffer: MAX_BUFFER });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/namespaces', async (req, res) => {
    try {
        const { stdout: currentContext } = await execAsync('kubectl config current-context', { maxBuffer: MAX_BUFFER });
        const clusterName = currentContext.trim();

        try {
            const { stdout } = await execAsync('kubectl get namespaces -o json', { maxBuffer: MAX_BUFFER });
            const data = JSON.parse(stdout);
            res.json(data.items.map((ns: any) => ({
                name: ns.metadata.name,
                cluster: clusterName,
            })));
        } catch (error: any) {
            // Handle Forbidden/RBAC errors gracefully
            if (error.message.includes('Forbidden') || error.message.includes('forbidden')) {
                console.warn('Listing namespaces forbidden, falling back to "default" namespace');
                return res.json([{
                    name: 'default',
                    cluster: clusterName,
                }]);
            }
            throw error;
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/pods', async (req, res) => {
    const { namespace } = req.query;
    try {
        const { stdout: currentContext } = await execAsync('kubectl config current-context', { maxBuffer: MAX_BUFFER });
        const clusterName = currentContext.trim();

        const nsArg = namespace ? `-n ${namespace}` : '--all-namespaces';
        try {
            const { stdout } = await execAsync(`kubectl get pods ${nsArg} -o json`, { maxBuffer: MAX_BUFFER });
            const data = JSON.parse(stdout);

            res.json(data.items.map((pod: any) => ({
                name: pod.metadata.name,
                namespace: pod.metadata.namespace,
                cluster: clusterName,
                status: pod.status.phase,
                containers: pod.spec.containers.map((c: any) => c.name),
            })));
        } catch (error: any) {
            if (error.message.includes('Forbidden') || error.message.includes('forbidden')) {
                console.warn(`Listing pods in ${nsArg} forbidden`);
                return res.json([]);
            }
            throw error;
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
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
    } catch (error: any) {
        res.status(500).json({ error: error.message });
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
