import { useState, useMemo, useEffect } from 'react';
import { FilterPanel } from './FilterPanel';
import { LogList } from './LogList';
import { Header } from './Header';
import { ConnectionBanner } from './ConnectionStatus';
import { FilterState } from '@/types/logs';
import { useKubernetes, usePodLogs } from '@/hooks/useKubernetes';
import { PodDetailsSidebar } from './PodDetailsSidebar';

const initialFilters: FilterState = {
  cluster: null,
  namespace: null,
  pod: null,
  container: null,
  levels: ['error', 'warn', 'info', 'debug'],
  search: '',
};

const STORAGE_KEY = 'kubelensy_filters';

const loadFilters = (): FilterState => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load filters:', e);
    }
  }
  return initialFilters;
};

export function LogViewer() {
  const [filters, setFilters] = useState<FilterState>(loadFilters());
  const [isLive, setIsLive] = useState(true);
  const [showPodDetails, setShowPodDetails] = useState(() => {
    return localStorage.getItem('kubelensy_show_pod_details') === 'true';
  });
  const initialSwitchRef = import.meta.env.DEV ? { current: false } : { current: false }; // We'll use a local ref
  const hasAttemptedInitialSwitch = useState(false)[0]; // Actually let's use a proper ref
  const initialSwitchDone = useState(false); // Using state just to be safe with re-renders

  // Real Kubernetes connection
  const {
    connected,
    loading: k8sLoading,
    error: k8sError,
    clusters,
    namespaces,
    pods,
    checkConnection,
    switchCluster,
    refreshPods,
    refreshNamespaces
  } = useKubernetes();

  // Real pod logs
  const { logs, loading: logsLoading, refresh, clear, lastUpdate } = usePodLogs(
    connected,
    filters.cluster,
    filters.namespace,
    filters.pod,
    filters.container,
    isLive
  );

  // Initial cluster switch if needed to match persisted state
  useEffect(() => {
    if (connected && filters.cluster && clusters.length > 0) {
      const currentConnected = clusters.find(c => c.status === 'connected')?.id;
      if (currentConnected && currentConnected !== filters.cluster) {
        console.log(`Auto-switching to last cluster: ${filters.cluster}`);
        switchCluster(filters.cluster);
      }
    }
  }, [connected, clusters, filters.cluster, switchCluster]);

  // Refresh pods when namespace changes
  const handleFilterChange = async (newFilters: FilterState) => {
    const clusterChanged = newFilters.cluster !== filters.cluster;

    if (clusterChanged && newFilters.cluster) {
      await switchCluster(newFilters.cluster);
    }

    setFilters(newFilters);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newFilters));

    if (newFilters.namespace !== filters.namespace || clusterChanged) {
      refreshPods(newFilters.namespace || undefined);
    }
    // Close details if pod changes
    if (newFilters.pod !== filters.pod) {
      setShowPodDetails(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Cluster filtering is usually handled by the backend switch, 
      // but we keep it here as a safety check if we have multi-cluster data in memory
      if (filters.cluster && log.cluster !== filters.cluster) {
        // Only return false if the cluster name is actually different from the connected one
        const connectedCluster = clusters.find(c => c.status === 'connected')?.id;
        if (connectedCluster && filters.cluster !== connectedCluster) return false;
      }
      if (filters.namespace && log.namespace !== filters.namespace) return false;
      if (filters.pod && log.pod !== filters.pod) return false;
      if (filters.container && log.container !== filters.container) return false;
      if (!filters.levels.includes(log.level)) return false;
      if (filters.search && !log.message.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [logs, filters, clusters]);

  const selectedPod = useMemo(() => {
    if (!filters.pod) return undefined;
    return pods.find(p => p.name === filters.pod && (!filters.namespace || p.namespace === filters.namespace));
  }, [pods, filters.pod, filters.namespace]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden font-sans">
      <Header
        filters={filters}
        onRefresh={refresh}
        onClear={clear}
        onShowDetails={() => {
          const next = !showPodDetails;
          setShowPodDetails(next);
          localStorage.setItem('kubelensy_show_pod_details', String(next));
        }}
        isLive={isLive}
        connected={connected}
        loading={k8sLoading}
        error={k8sError}
        onRetryConnection={checkConnection}
        lastUpdate={lastUpdate}
        selectedPod={selectedPod}
      />

      {/* Connection Banner */}
      {!connected && !k8sLoading && (
        <ConnectionBanner onRetry={checkConnection} />
      )}

      {/* Horizontal Toolbar */}
      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        clusters={clusters}
        namespaces={namespaces}
        pods={pods}
        onRefreshNamespaces={refreshNamespaces}
      />

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-hidden">
          <LogList logs={filteredLogs} searchTerm={filters.search} />
        </div>

        {showPodDetails && filters.pod && filters.namespace && (
          <PodDetailsSidebar
            podName={filters.pod}
            namespace={filters.namespace}
            onClose={() => {
              setShowPodDetails(false);
              localStorage.setItem('kubelensy_show_pod_details', 'false');
            }}
          />
        )}
      </main>
    </div>
  );
}
