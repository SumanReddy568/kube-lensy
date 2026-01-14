import { Cluster, Namespace, Pod, LogEntry, LogLevel } from '@/types/logs';

const API_BASE_URL = 'http://localhost:3001/api';

export interface K8sConnectionStatus {
  connected: boolean;
  error?: string;
}

export async function checkConnection(): Promise<K8sConnectionStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/clusters`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
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

    const response = await fetch(url);
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

// Stream logs using polling
export function streamPodLogs(
  namespace: string,
  podName: string,
  container: string | undefined,
  onLog: (logs: LogEntry[]) => void,
  onError: (error: Error) => void
): () => void {
  let isActive = true;
  let lastTimestamp = '';

  const poll = async () => {
    if (!isActive) return;

    try {
      let url = `${API_BASE_URL}/logs?namespace=${namespace}&pod=${podName}&tailLines=50`;
      if (container) {
        url += `&container=${container}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();
      // Fetch current context to use in logs
      const clusters = await fetchClusters();
      const currentCluster = clusters.find(c => c.status === 'connected')?.name || 'local';
      const logs = parseLogText(text, namespace, podName, container || 'main', currentCluster);

      if (logs.length > 0) {
        // Filter out logs earlier than lastTimestamp
        const newLogs = lastTimestamp
          ? logs.filter(l => l.timestamp.toISOString() > lastTimestamp)
          : logs;

        if (newLogs.length > 0) {
          lastTimestamp = logs[logs.length - 1].timestamp.toISOString();
          onLog(newLogs);
        }
      }
    } catch (error) {
      onError(error as Error);
    }

    if (isActive) {
      setTimeout(poll, 2000);
    }
  };

  poll();

  return () => {
    isActive = false;
  };
}
