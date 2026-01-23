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
  appErrors: Array<{ message: string; count: number; lastSeen: Date }>;
}

export function useKubernetes(initialNamespace?: string) {
  const [state, setState] = useState<K8sState>({
    connected: false,
    loading: true,
    error: null,
    clusters: [],
    namespaces: [],
    pods: [],
    appErrors: [],
  });

  const isInitialMount = useRef(true);
  const initialNamespaceRef = useRef(initialNamespace);

  const recordAppError = useCallback((message: string) => {
    setState(prev => {
      const existing = prev.appErrors.find(e => e.message === message);
      if (existing) {
        return {
          ...prev,
          appErrors: prev.appErrors.map(e =>
            e.message === message ? { ...e, count: e.count + 1, lastSeen: new Date() } : e
          )
        };
      }
      return {
        ...prev,
        appErrors: [...prev.appErrors, { message, count: 1, lastSeen: new Date() }]
      };
    });
  }, []);


  useEffect(() => {
    initialNamespaceRef.current = initialNamespace;
  }, [initialNamespace]);

  const checkConnection = useCallback(async (silent = false) => {
    if (!silent) setState(prev => ({ ...prev, loading: true }));

    try {
      const status = await k8sApi.checkConnection();

      if (status.connected) {
        if (!state.connected || !silent) {
          // Fetch clusters and namespaces first (fast)
          const clusters = await k8sApi.fetchClusters().catch(e => { console.error(e); return state.clusters; });
          const namespaces = await k8sApi.fetchNamespaces().catch(e => { console.error(e); return state.namespaces; });

          setState(prev => ({
            ...prev,
            connected: true,
            loading: false,
            error: null,
            clusters,
            namespaces,
          }));

          // Fetch pods in background (slow) - use the current namespace in ref
          k8sApi.fetchPods(initialNamespaceRef.current || undefined).then(pods => {
            setState(prev => ({ ...prev, pods }));
          }).catch(e => console.error('Background pod fetch failed:', e));
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

      // Fetch clusters and namespaces first (essential for context)
      const [clusters, namespaces] = await Promise.all([
        k8sApi.fetchClusters().catch(e => { console.error(e); return []; }),
        k8sApi.fetchNamespaces().catch(e => { console.error(e); return []; }),
      ]);

      setState(prev => ({
        ...prev,
        connected: true,
        loading: false,
        error: null,
        clusters,
        namespaces,
        pods: [], // Clear pods from previous cluster
      }));

      // Fetch pods in background
      k8sApi.fetchPods(initialNamespaceRef.current || undefined).then(pods => {
        setState(prev => ({ ...prev, pods }));
      }).catch(e => console.error('Background pod fetch failed after switch:', e));

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to switch cluster';
      console.error('Failed to switch cluster:', msg);
      recordAppError(`Cluster Switch Error: ${msg}`);
      setState(prev => ({
        ...prev,
        loading: false,
        error: msg
      }));
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

  const refreshNamespaces = useCallback(async () => {
    try {
      const namespaces = await k8sApi.fetchNamespaces();
      setState(prev => ({ ...prev, namespaces }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to refresh namespaces:', error);
      recordAppError(`Namespace Sync Error: ${msg}`);
    }
  }, [recordAppError]);

  return {
    ...state,
    checkConnection: () => checkConnection(false), // Manual retry is never silent
    switchCluster,
    refreshPods,
    refreshNamespaces,
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
