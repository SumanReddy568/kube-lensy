import { Cluster, Namespace, Pod, LogEntry, LogLevel } from '@/types/logs';

const KUBECTL_PROXY_URL = 'http://localhost:8001';

export interface K8sConnectionStatus {
  connected: boolean;
  error?: string;
}

export async function checkConnection(): Promise<K8sConnectionStatus> {
  try {
    const response = await fetch(`${KUBECTL_PROXY_URL}/api/v1`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      return { connected: true };
    }
    return { connected: false, error: `HTTP ${response.status}` };
  } catch (error) {
    return { connected: false, error: 'kubectl proxy not running' };
  }
}

export async function fetchNamespaces(): Promise<Namespace[]> {
  try {
    const response = await fetch(`${KUBECTL_PROXY_URL}/api/v1/namespaces`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    return data.items.map((ns: any) => ({
      name: ns.metadata.name,
      cluster: 'local',
    }));
  } catch (error) {
    console.error('Failed to fetch namespaces:', error);
    throw error;
  }
}

export async function fetchPods(namespace?: string): Promise<Pod[]> {
  try {
    const url = namespace 
      ? `${KUBECTL_PROXY_URL}/api/v1/namespaces/${namespace}/pods`
      : `${KUBECTL_PROXY_URL}/api/v1/pods`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    return data.items.map((pod: any) => ({
      name: pod.metadata.name,
      namespace: pod.metadata.namespace,
      cluster: 'local',
      status: pod.status.phase,
      containers: pod.spec.containers.map((c: any) => c.name),
    }));
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
    let url = `${KUBECTL_PROXY_URL}/api/v1/namespaces/${namespace}/pods/${podName}/log?tailLines=${tailLines}&timestamps=true`;
    if (container) {
      url += `&container=${container}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const text = await response.text();
    return parseLogText(text, namespace, podName, container || 'main');
  } catch (error) {
    console.error('Failed to fetch pod logs:', error);
    throw error;
  }
}

function parseLogText(
  text: string,
  namespace: string,
  pod: string,
  container: string
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
      cluster: 'local',
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

// Stream logs using Server-Sent Events pattern (polling fallback)
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
      let url = `${KUBECTL_PROXY_URL}/api/v1/namespaces/${namespace}/pods/${podName}/log?tailLines=50&timestamps=true`;
      if (container) {
        url += `&container=${container}`;
      }
      if (lastTimestamp) {
        url += `&sinceTime=${encodeURIComponent(lastTimestamp)}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const text = await response.text();
      const logs = parseLogText(text, namespace, podName, container || 'main');
      
      if (logs.length > 0) {
        lastTimestamp = logs[logs.length - 1].timestamp.toISOString();
        onLog(logs);
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
