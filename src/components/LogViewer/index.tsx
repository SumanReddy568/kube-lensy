import { useState, useMemo } from 'react';
import { FilterPanel } from './FilterPanel';
import { LogList } from './LogList';
import { Header } from './Header';
import { ConnectionBanner } from './ConnectionStatus';
import { FilterState } from '@/types/logs';
import { useKubernetes, usePodLogs } from '@/hooks/useKubernetes';

const initialFilters: FilterState = {
  cluster: null,
  namespace: null,
  pod: null,
  container: null,
  levels: ['error', 'warn', 'info', 'debug'],
  search: '',
};

export function LogViewer() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [isLive, setIsLive] = useState(true);

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
    refreshPods
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

  // Refresh pods when namespace changes
  const handleFilterChange = async (newFilters: FilterState) => {
    if (newFilters.cluster !== filters.cluster && newFilters.cluster) {
      await switchCluster(newFilters.cluster);
    }
    setFilters(newFilters);
    if (newFilters.namespace !== filters.namespace) {
      refreshPods(newFilters.namespace || undefined);
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

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header
        filters={filters}
        onRefresh={refresh}
        onClear={clear}
        isLive={isLive}
        connected={connected}
        loading={k8sLoading}
        error={k8sError}
        onRetryConnection={checkConnection}
        lastUpdate={lastUpdate}
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
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <LogList logs={filteredLogs} searchTerm={filters.search} />
      </main>
    </div>
  );
}
