import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/clusters', async (req, res) => {
    try {
        const { stdout } = await execAsync('kubectl config get-contexts -o name');
        const contexts = stdout.split('\n').filter(Boolean);
        const { stdout: currentContext } = await execAsync('kubectl config current-context');

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
        await execAsync(`kubectl config use-context ${id}`);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/namespaces', async (req, res) => {
    try {
        const { stdout } = await execAsync('kubectl get namespaces -o json');
        const data = JSON.parse(stdout);
        const { stdout: currentContext } = await execAsync('kubectl config current-context');

        res.json(data.items.map((ns: any) => ({
            name: ns.metadata.name,
            cluster: currentContext.trim(),
        })));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/pods', async (req, res) => {
    const { namespace } = req.query;
    try {
        const nsArg = namespace ? `-n ${namespace}` : '--all-namespaces';
        const { stdout } = await execAsync(`kubectl get pods ${nsArg} -o json`);
        const data = JSON.parse(stdout);
        const { stdout: currentContext } = await execAsync('kubectl config current-context');

        res.json(data.items.map((pod: any) => ({
            name: pod.metadata.name,
            namespace: pod.metadata.namespace,
            cluster: currentContext.trim(),
            status: pod.status.phase,
            containers: pod.spec.containers.map((c: any) => c.name),
        })));
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

        const { stdout } = await execAsync(command);
        res.send(stdout);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Kube-Lensy Backend running at http://localhost:${port}`);
});
