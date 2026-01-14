import { useState, useEffect, useCallback, useRef } from 'react';
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

  const isInitialMount = useRef(true);

  const checkConnection = useCallback(async (silent = false) => {
    if (!silent) setState(prev => ({ ...prev, loading: true }));

    try {
      const status = await k8sApi.checkConnection();

      if (status.connected) {
        // Only fetch full data on initial load or if we were disconnected
        // This prevents the "every 10 seconds" refresh from resetting lists
        if (!state.connected || !silent) {
          const [clusters, namespaces, pods] = await Promise.all([
            k8sApi.fetchClusters().catch(e => { console.error(e); return []; }),
            k8sApi.fetchNamespaces().catch(e => { console.error(e); return []; }),
            k8sApi.fetchPods().catch(e => { console.error(e); return []; }),
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
          // Silent background check - just update connection status
          setState(prev => ({
            ...prev,
            connected: true,
            loading: false,
            error: null
          }));
        }
      } else {
        setState(prev => ({
          ...prev,
          connected: false,
          loading: false,
          error: status.error || 'Not connected',
          // We keep the old data so the UI doesn't blank out instantly
        }));
      }
    } catch (error) {
      if (!silent) {
        setState(prev => ({
          ...prev,
          connected: false,
          loading: false,
          error: 'Failed to connect to backend',
        }));
      }
    }
  }, [state.connected]);

  const switchCluster = useCallback(async (clusterId: string) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      await k8sApi.switchCluster(clusterId);
      // Force a full re-fetch after switching cluster
      const [clusters, namespaces, pods] = await Promise.all([
        k8sApi.fetchClusters().catch(e => { console.error(e); return []; }),
        k8sApi.fetchNamespaces().catch(e => { console.error(e); return []; }),
        k8sApi.fetchPods().catch(e => { console.error(e); return []; }),
      ]);
      setState({
        connected: true,
        loading: false,
        error: null,
        clusters,
        namespaces,
        pods,
      });
    } catch (error) {
      console.error('Failed to switch cluster:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Failed to switch cluster' }));
    }
  }, []);

  const refreshPods = useCallback(async (namespace?: string) => {
    // We don't set loading: true here to avoid UI flickering
    try {
      const pods = await k8sApi.fetchPods(namespace || undefined);
      setState(prev => ({ ...prev, pods }));
    } catch (error) {
      console.error('Failed to refresh pods:', error);
    }
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      checkConnection(false);
      isInitialMount.current = false;
    }

    // Silent background check every 30 seconds (less aggressive)
    const interval = setInterval(() => checkConnection(true), 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return {
    ...state,
    checkConnection: () => checkConnection(false), // Manual retry is never silent
    switchCluster,
    refreshPods,
  };
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
          200
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
        200
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
