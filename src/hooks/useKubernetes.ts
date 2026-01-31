import { useEffect, useState, useCallback } from 'react';
import { useKubernetesContext } from '@/contexts/KubernetesContext';
import { Cluster, Namespace, Pod, LogEntry } from '@/types/logs';
import * as k8sApi from '@/services/kubernetesApi';

export interface K8sState {
  connected: boolean;
  loading: boolean;
  error: string | null;
  clusters: Cluster[];
  namespaces: Namespace[];
  pods: Pod[];
  appErrors: Array<{ message: string; count: number; lastSeen: Date }>;
}

export function useKubernetes(initialNamespace?: string) {
  const context = useKubernetesContext();

  // Handle initial namespace trigger if provided
  useEffect(() => {
    if (initialNamespace) {
      context.refreshPods(initialNamespace);
    }
  }, [initialNamespace, context.refreshPods]);

  return context;
}

export function usePodLogs(
  connected: boolean,
  cluster: string | null,
  namespace: string | null,
  pod: string | null,
  container: string | null,
  isLive: boolean
) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // Initial fetch
  useEffect(() => {
    if (!connected || !namespace || !pod) {
      setLogs([]);
      setLastUpdate(0);
      return;
    }

    const fetchLogs = async () => {
      setLoading(true);
      try {
        const fetchedLogs = await k8sApi.fetchPodLogs(
          namespace,
          pod,
          container || undefined,
          500
        );
        setLogs(fetchedLogs);
        setLastUpdate(Date.now());
      } catch (error) {
        console.error('Failed to fetch logs:', error);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [connected, namespace, pod, container]);

  // Live streaming
  useEffect(() => {
    if (!isLive || !connected || !namespace || !pod) {
      return;
    }

    const stopStream = k8sApi.streamPodLogs(
      namespace,
      pod,
      container || undefined,
      cluster || 'local',
      (newLogs) => {
        setLogs(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const uniqueNew = newLogs.filter(l => !existingIds.has(l.id));
          return [...prev, ...uniqueNew].slice(-1000);
        });
        setLastUpdate(Date.now());
      },
      (error) => {
        console.error('Stream error:', error);
      }
    );

    return stopStream;
  }, [isLive, connected, namespace, pod, container, cluster]);

  const refresh = useCallback(async () => {
    if (!connected || !namespace || !pod) {
      return;
    }

    try {
      const fetchedLogs = await k8sApi.fetchPodLogs(
        namespace,
        pod,
        container || undefined,
        500
      );
      setLogs(fetchedLogs);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error('Failed to refresh logs:', error);
    }
  }, [connected, namespace, pod, container]);

  const clear = useCallback(() => {
    setLogs([]);
    setLastUpdate(0);
  }, []);

  return { logs, loading, refresh, clear, lastUpdate };
}
