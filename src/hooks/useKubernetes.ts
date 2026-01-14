import { useState, useEffect, useCallback } from 'react';
import { Cluster, Namespace, Pod, LogEntry } from '@/types/logs';
import * as k8sApi from '@/services/kubernetesApi';

export interface K8sState {
  connected: boolean;
  loading: boolean;
  error: string | null;
  clusters: Cluster[];
  namespaces: Namespace[];
  pods: Pod[];
}

export function useKubernetes() {
  const [state, setState] = useState<K8sState>({
    connected: false,
    loading: true,
    error: null,
    clusters: [],
    namespaces: [],
    pods: [],
  });

  const checkConnection = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      const status = await k8sApi.checkConnection();

      if (status.connected) {
        const [clusters, namespaces, pods] = await Promise.all([
          k8sApi.fetchClusters(),
          k8sApi.fetchNamespaces(),
          k8sApi.fetchPods(),
        ]);

        setState({
          connected: true,
          loading: false,
          error: null,
          clusters,
          namespaces,
          pods,
        });
      } else {
        setState(prev => ({
          ...prev,
          connected: false,
          loading: false,
          error: status.error || 'Not connected',
          clusters: [],
          namespaces: [],
          pods: [],
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        connected: false,
        loading: false,
        error: 'Failed to connect to backend',
        clusters: [],
        namespaces: [],
        pods: [],
      }));
    }
  }, []);

  const switchCluster = useCallback(async (clusterId: string) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      await k8sApi.switchCluster(clusterId);
      await checkConnection();
    } catch (error) {
      console.error('Failed to switch cluster:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Failed to switch cluster' }));
    }
  }, [checkConnection]);

  const refreshPods = useCallback(async (namespace?: string) => {
    if (!state.connected) return;

    try {
      const pods = await k8sApi.fetchPods(namespace || undefined);
      setState(prev => ({ ...prev, pods }));
    } catch (error) {
      console.error('Failed to refresh pods:', error);
    }
  }, [state.connected]);

  useEffect(() => {
    checkConnection();

    // Re-check connection every 10 seconds
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return {
    ...state,
    checkConnection,
    switchCluster,
    refreshPods,
  };
}

export function usePodLogs(
  connected: boolean,
  namespace: string | null,
  pod: string | null,
  container: string | null,
  isLive: boolean
) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Initial fetch
  useEffect(() => {
    if (!connected || !namespace || !pod) {
      setLogs([]);
      return;
    }

    const fetchLogs = async () => {
      setLoading(true);
      try {
        const fetchedLogs = await k8sApi.fetchPodLogs(
          namespace,
          pod,
          container || undefined,
          200
        );
        setLogs(fetchedLogs);
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
      (newLogs) => {
        setLogs(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const uniqueNew = newLogs.filter(l => !existingIds.has(l.id));
          return [...uniqueNew, ...prev].slice(0, 500);
        });
      },
      (error) => {
        console.error('Stream error:', error);
      }
    );

    return stopStream;
  }, [isLive, connected, namespace, pod, container]);

  const refresh = useCallback(async () => {
    if (!connected || !namespace || !pod) {
      return;
    }

    try {
      const fetchedLogs = await k8sApi.fetchPodLogs(
        namespace,
        pod,
        container || undefined,
        200
      );
      setLogs(fetchedLogs);
    } catch (error) {
      console.error('Failed to refresh logs:', error);
    }
  }, [connected, namespace, pod, container]);

  const clear = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, loading, refresh, clear };
}
