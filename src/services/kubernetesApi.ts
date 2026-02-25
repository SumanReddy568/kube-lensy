// --- Keep-Alive Mechanism ---
let keepAliveInterval: NodeJS.Timeout | null = null;
const KEEP_ALIVE_PERIOD = 60_000; // 1 minute

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    fetch(`${API_BASE_URL}/health`, { method: 'GET' }).catch(() => {});
  }, KEEP_ALIVE_PERIOD);
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// Start keep-alive on module load
startKeepAlive();
// --- End Keep-Alive ---
import { Cluster, Namespace, Pod, LogEntry, LogLevel } from '@/types/logs';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

// --- Client-side Caching ---
interface CacheEntry {
  data: unknown;
  expires: number;
}
const apiCache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL = 5000; // 5 seconds

async function cachedFetch(url: string, ttl = DEFAULT_CACHE_TTL, options?: RequestInit) {
  const cached = apiCache.get(url);
  if (cached && cached.expires > Date.now()) {
    const headers = typeof cached.data === 'string'
      ? { 'Content-Type': 'text/plain' }
      : { 'Content-Type': 'application/json' };
    const body = typeof cached.data === 'string' ? cached.data : JSON.stringify(cached.data);

    return Promise.resolve(new Response(body, { status: 200, headers }));
  }

  const response = await fetch(url, options);
  if (response.ok && (options?.method === 'GET' || !options?.method)) {
    const resClone = response.clone();
    try {
      const data = await resClone.json();
      apiCache.set(url, { data, expires: Date.now() + ttl });
    } catch (e) {
      // Not a JSON response, assume text
      const data = await response.clone().text();
      apiCache.set(url, { data, expires: Date.now() + ttl });
    }
  }
  return response;
}

function clearCache(pattern?: string) {
  if (!pattern) {
    apiCache.clear();
    return;
  }
  // Remove only cache entries matching the pattern
  for (const key of Array.from(apiCache.keys())) {
    if (key.includes(pattern)) {
      apiCache.delete(key);
    }
  }
}
// --- End Caching ---

export interface K8sConnectionStatus {
  connected: boolean;
  error?: string;
}

export async function checkConnection(): Promise<K8sConnectionStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // Reduce timeout for faster feedback
    });
    if (response.ok) {
      return { connected: true };
    }
    return { connected: false, error: `HTTP ${response.status}` };
  } catch (error) {
    return { connected: false, error: 'Backend server not running' };
  }
}

export async function fetchClusters(): Promise<Cluster[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/clusters`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch clusters:', error);
    throw error;
  }
}

export async function switchCluster(clusterId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/clusters/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clusterId }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // Invalidate only cluster, namespace, and pod cache
    clearCache('/clusters');
    clearCache('/namespaces');
    clearCache('/pods');
    // Prefetch namespaces and pods for faster UI
    fetchNamespaces().catch(() => {});
    fetchPods().catch(() => {});
  } catch (error) {
    console.error('Failed to switch cluster:', error);
    throw error;
  }
}

export async function fetchNamespaces(): Promise<Namespace[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/namespaces`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch namespaces:', error);
    throw error;
  }
}

export async function addManualNamespace(name: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/namespaces/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    clearCache('/namespaces');
    // Prefetch updated namespaces
    fetchNamespaces().catch(() => {});
  } catch (error) {
    console.error('Failed to add manual namespace:', error);
    throw error;
  }
}

export async function fetchPods(namespace?: string): Promise<Pod[]> {
  try {
    const url = namespace
      ? `${API_BASE_URL}/pods?namespace=${namespace}`
      : `${API_BASE_URL}/pods`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch pods:', error);
    throw error;
  }
}

export async function fetchPodLogs(
  namespace: string,
  podName: string,
  container?: string,
  tailLines: number = 100
): Promise<LogEntry[]> {
  try {
    let url = `${API_BASE_URL}/logs?namespace=${namespace}&pod=${podName}&tailLines=${tailLines}`;
    if (container) {
      url += `&container=${container}`;
    }

    const response = await fetch(url); // Logs are not cached
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    // Fetch current context to use in logs
    const clusters = await fetchClusters();
    const currentCluster = clusters.find(c => c.status === 'connected')?.name || 'local';
    return parseLogText(text, namespace, podName, container || 'main', currentCluster);
  } catch (error) {
    console.error('Failed to fetch pod logs:', error);
    throw error;
  }
}

function parseLogText(
  text: string,
  namespace: string,
  pod: string,
  container: string,
  cluster: string
): LogEntry[] {
  const lines = text.split('\n').filter(line => line.trim());

  return lines.map((line, index) => {
    // K8s timestamps are in RFC3339 format at the start of each line
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(.*)$/);

    let timestamp: Date;
    let message: string;

    if (timestampMatch) {
      timestamp = new Date(timestampMatch[1]);
      message = timestampMatch[2];
    } else {
      timestamp = new Date();
      message = line;
    }

    const level = detectLogLevel(message);

    return {
      id: `${pod}-${Date.now()}-${index}`,
      timestamp,
      level,
      message,
      container,
      namespace,
      pod,
      cluster,
    };
  });
}

function detectLogLevel(message: string): LogLevel {
  const lower = message.toLowerCase();

  if (lower.includes('error') || lower.includes('fatal') || lower.includes('panic') || lower.includes('exception')) {
    return 'error';
  }
  if (lower.includes('warn') || lower.includes('warning')) {
    return 'warn';
  }
  if (lower.includes('debug') || lower.includes('trace')) {
    return 'debug';
  }
  return 'info';
}

export function streamPodLogs(
  namespace: string,
  podName: string,
  container: string | undefined,
  clusterName: string,
  onLog: (logs: LogEntry[]) => void,
  onError: (error: Error) => void
): () => void {
  let url = `${API_BASE_URL}/logs/stream?namespace=${namespace}&pod=${podName}&tailLines=10`;
  if (container) {
    url += `&container=${container}`;
  }

  const eventSource = new EventSource(url);
  let logBuffer: LogEntry[] = [];
  let flushTimeout: NodeJS.Timeout | null = null;
  const FLUSH_DELAY = 20; // ms, reduced for faster sync
  const MAX_BUFFER_SIZE = 10; // flush immediately if buffer reaches this

  const flush = () => {
    if (logBuffer.length > 0) {
      onLog([...logBuffer]);
      logBuffer = [];
    }
    flushTimeout = null;
  };

  eventSource.onmessage = (event) => {
    const line = event.data;
    if (!line) return;

    const log = parseSingleLogLine(line, 0, namespace, podName, container || 'main', clusterName);
    logBuffer.push(log);

    // Flush immediately if buffer is large, else use timer
    if (logBuffer.length >= MAX_BUFFER_SIZE) {
      if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
      }
      flush();
    } else if (!flushTimeout) {
      flushTimeout = setTimeout(flush, FLUSH_DELAY);
    }
  };

  eventSource.onerror = (error) => {
    console.error('EventSource error:', error);
    onError(new Error('Log stream connection lost'));
    eventSource.close();
  };

  return () => {
    if (flushTimeout) clearTimeout(flushTimeout);
    eventSource.close();
  };
}

function parseSingleLogLine(
  line: string,
  index: number,
  namespace: string,
  pod: string,
  container: string,
  cluster: string
): LogEntry {
  const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(.*)$/);

  let timestamp: Date;
  let message: string;

  if (timestampMatch) {
    timestamp = new Date(timestampMatch[1]);
    message = timestampMatch[2];
  } else {
    timestamp = new Date();
    message = line;
  }

  const level = detectLogLevel(message);

  return {
    id: `${pod}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp,
    level,
    message,
    container,
    namespace,
    pod,
    cluster,
  };
}

export async function fetchPodDescribe(namespace: string, pod: string): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/pods/${pod}/describe?namespace=${namespace}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    console.error('Failed to fetch pod description:', error);
    throw error;
  }
}

export interface PodEvent {
  type: string;
  reason: string;
  message: string;
  lastTimestamp: string;
  count: number;
}

export async function fetchPodEvents(namespace: string, pod: string): Promise<PodEvent[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/pods/${pod}/events?namespace=${namespace}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch pod events:', error);
    throw error;
  }
}

export interface PodMetrics {
  pod: string;
  namespace: string;
  cpu: string;
  memory: string;
  cpuLimit: string;
  memoryLimit: string;
  cpuRequest: string;
  memoryRequest: string;
  qosClass: string;
  nodeName: string;
  timestamp: number;
}

export async function fetchPodMetrics(namespace: string, pod: string): Promise<PodMetrics> {
  try {
    const response = await fetch(`${API_BASE_URL}/pods/${pod}/metrics?namespace=${namespace}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch pod metrics:', error);
    throw error;
  }
}
