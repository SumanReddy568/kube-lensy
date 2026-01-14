import { Cluster, Namespace, Pod, LogEntry, LogLevel } from '@/types/logs';

export const mockClusters: Cluster[] = [
  { id: 'local', name: 'local-cluster', status: 'connected' },
  { id: 'dev', name: 'dev-cluster', status: 'connected' },
  { id: 'staging', name: 'staging-cluster', status: 'disconnected' },
];

export const mockNamespaces: Namespace[] = [
  { name: 'default', cluster: 'local' },
  { name: 'kube-system', cluster: 'local' },
  { name: 'monitoring', cluster: 'local' },
  { name: 'app-backend', cluster: 'local' },
  { name: 'app-frontend', cluster: 'local' },
  { name: 'default', cluster: 'dev' },
  { name: 'development', cluster: 'dev' },
];

export const mockPods: Pod[] = [
  { name: 'api-server-7d9f8c6b5-x2k4m', namespace: 'app-backend', cluster: 'local', status: 'Running', containers: ['api', 'sidecar'] },
  { name: 'api-server-7d9f8c6b5-j8n2p', namespace: 'app-backend', cluster: 'local', status: 'Running', containers: ['api', 'sidecar'] },
  { name: 'postgres-0', namespace: 'app-backend', cluster: 'local', status: 'Running', containers: ['postgres', 'metrics'] },
  { name: 'redis-master-0', namespace: 'app-backend', cluster: 'local', status: 'Running', containers: ['redis'] },
  { name: 'nginx-ingress-controller-5f9d8c7b6-m3k9j', namespace: 'kube-system', cluster: 'local', status: 'Running', containers: ['nginx'] },
  { name: 'coredns-6d8c4cb4d-l4n2m', namespace: 'kube-system', cluster: 'local', status: 'Running', containers: ['coredns'] },
  { name: 'prometheus-server-0', namespace: 'monitoring', cluster: 'local', status: 'Running', containers: ['prometheus', 'configmap-reload'] },
  { name: 'grafana-7f9c8d6b5-k2j4n', namespace: 'monitoring', cluster: 'local', status: 'Running', containers: ['grafana'] },
  { name: 'frontend-app-8c7d6f5b4-n9m3k', namespace: 'app-frontend', cluster: 'local', status: 'Running', containers: ['frontend'] },
  { name: 'frontend-app-8c7d6f5b4-p2k8j', namespace: 'app-frontend', cluster: 'local', status: 'Pending', containers: ['frontend'] },
];

const logMessages = {
  error: [
    'Connection refused: unable to connect to database at postgres:5432',
    'FATAL: password authentication failed for user "admin"',
    'OutOfMemory: Container killed due to OOM',
    'ECONNRESET: socket hang up',
    'Unhandled promise rejection: TypeError: Cannot read property of undefined',
    'CrashLoopBackOff: Back-off restarting failed container',
    'ImagePullBackOff: Failed to pull image "myapp:latest"',
    'Request timeout after 30000ms',
  ],
  warn: [
    'High memory usage detected: 85% of limit',
    'Slow query detected: SELECT * FROM users took 2.3s',
    'Rate limit approaching: 450/500 requests',
    'Certificate expires in 7 days',
    'Deprecated API version v1beta1 in use',
    'Connection pool exhausted, waiting for available connection',
    'Retry attempt 3/5 for external API call',
  ],
  info: [
    'Server started on port 8080',
    'Connected to database successfully',
    'Health check passed',
    'Processing batch job: 150/500 items completed',
    'User authentication successful for user_id=12345',
    'Cache invalidated for key: user:preferences:*',
    'Deployment rollout completed successfully',
    'Scaling up to 3 replicas',
    'HTTP GET /api/v1/users 200 45ms',
    'HTTP POST /api/v1/orders 201 128ms',
  ],
  debug: [
    'Parsing request body: {"id": 123, "action": "update"}',
    'Query executed: SELECT id, name FROM products WHERE active = true',
    'Cache hit for key: session:abc123',
    'WebSocket connection established: client_id=ws_789',
    'Metrics exported: cpu=0.45, memory=512MB',
    'Goroutine count: 42',
  ],
};

function generateRandomLog(index: number): LogEntry {
  const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
  const levelWeights = [0.05, 0.15, 0.60, 0.20]; // Weighted towards info
  
  let random = Math.random();
  let level: LogLevel = 'info';
  let cumulative = 0;
  
  for (let i = 0; i < levels.length; i++) {
    cumulative += levelWeights[i];
    if (random < cumulative) {
      level = levels[i];
      break;
    }
  }
  
  const messages = logMessages[level];
  const message = messages[Math.floor(Math.random() * messages.length)];
  
  const pods = mockPods.filter(p => p.cluster === 'local');
  const pod = pods[Math.floor(Math.random() * pods.length)];
  const container = pod.containers[Math.floor(Math.random() * pod.containers.length)];
  
  const now = new Date();
  const timestamp = new Date(now.getTime() - (index * 1000 * Math.random() * 5));
  
  return {
    id: `log-${Date.now()}-${index}`,
    timestamp,
    level,
    message,
    container,
    namespace: pod.namespace,
    pod: pod.name,
    cluster: pod.cluster,
  };
}

export function generateMockLogs(count: number = 100): LogEntry[] {
  const logs: LogEntry[] = [];
  for (let i = 0; i < count; i++) {
    logs.push(generateRandomLog(i));
  }
  return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export const mockLogs = generateMockLogs(150);
