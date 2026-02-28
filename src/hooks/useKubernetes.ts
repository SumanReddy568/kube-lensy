import { useEffect, useState, useCallback } from 'react';
import { useKubernetesContext } from '@/contexts/KubernetesContext';
import { Cluster, Namespace, Pod, LogEntry } from '@/types/logs';
import * as k8sApi from '@/services/kubernetesApi';
import { LOG_POLL_INTERVAL, POD_REFRESH_INTERVAL } from '@/config';

export interface K8sState {
  connected: boolean;
  loading: boolean;
  error: string | null;
  clusters: Cluster[];
  namespaces: Namespace[];
  pods: Pod[];
  appErrors: Array<{ message: string; count: number; lastSeen: Date }>;
}

export function useKubernetes() {
  const context = useKubernetesContext();

  useEffect(() => {
    const interval = setInterval(() => {
      context.refreshPods();
    }, POD_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [context.refreshPods]);

  return context;
}

export function usePodLogs(
  connected: boolean,
  cluster: string | null,
  namespace: string | null,
  pod: string | null,
  container: string | null,
  isLive: boolean,
  isStreamingPaused: boolean = false
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

  // Live streaming + 5s polling fallback - respects isStreamingPaused
  useEffect(() => {
    if (!isLive || !connected || !namespace || !pod || isStreamingPaused) {
      return;
    }

    const mergeLogs = (prev: LogEntry[], fetched: LogEntry[]): LogEntry[] => {
      const existingKeys = new Set(prev.map(l => `${l.pod}-${l.timestamp.getTime()}-${l.message}`));
      const uniqueNew = fetched.filter(l => !existingKeys.has(`${l.pod}-${l.timestamp.getTime()}-${l.message}`));
      if (uniqueNew.length === 0) return prev;
      return [...prev, ...uniqueNew].slice(-2000);
    };

    // Poll /api/logs every 5 seconds to catch any logs the stream may have missed
    const pollInterval = setInterval(async () => {
      try {
        const fetchedLogs = await k8sApi.fetchPodLogs(
          namespace,
          pod,
          container || undefined,
          500
        );
        setLogs(prev => mergeLogs(prev, fetchedLogs));
        setLastUpdate(Date.now());
      } catch (error) {
        console.error('Failed to poll logs:', error);
      }
    }, LOG_POLL_INTERVAL);

    const stopStream = k8sApi.streamPodLogs(
      namespace,
      pod,
      container || undefined,
      cluster || 'local',
      (newLogs) => {
        setLogs(prev => mergeLogs(prev, newLogs));
        setLastUpdate(Date.now());
      },
      (error) => {
        console.error('Stream error:', error);
      }
    );

    return () => {
      clearInterval(pollInterval);
      stopStream();
    };
  }, [isLive, connected, namespace, pod, container, cluster, isStreamingPaused]);

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
