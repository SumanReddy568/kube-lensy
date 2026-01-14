import { useState, useMemo } from 'react';
import { FilterPanel } from './FilterPanel';
import { LogList } from './LogList';
import { Header } from './Header';
import { ConnectionBanner } from './ConnectionStatus';
import { FilterState } from '@/types/logs';
import { useKubernetes, usePodLogs } from '@/hooks/useKubernetes';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
  const { logs, loading: logsLoading, refresh, clear } = usePodLogs(
    connected,
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
      if (filters.cluster && log.cluster !== filters.cluster) return false;
      if (filters.namespace && log.namespace !== filters.namespace) return false;
      if (filters.pod && log.pod !== filters.pod) return false;
      if (filters.container && log.container !== filters.container) return false;
      if (!filters.levels.includes(log.level)) return false;
      if (filters.search && !log.message.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [logs, filters]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header
        filters={filters}
        onRefresh={refresh}
        onClear={clear}
        isLive={isLive}
        connected={connected}
        loading={k8sLoading}
        error={k8sError}
        onRetryConnection={checkConnection}
      />

      {/* Connection Banner */}
      {!connected && !k8sLoading && (
        <ConnectionBanner onRetry={checkConnection} />
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden absolute top-4 left-4 z-50 p-2 bg-card border border-border rounded-lg shadow-lg"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Sidebar */}
        <aside className={cn(
          "w-72 shrink-0 transition-all duration-300 lg:translate-x-0",
          "absolute lg:relative z-40 h-full",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <FilterPanel
            filters={filters}
            onFilterChange={handleFilterChange}
            clusters={clusters}
            namespaces={namespaces}
            pods={pods}
          />
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <LogList logs={filteredLogs} searchTerm={filters.search} />
        </main>
      </div>
    </div>
  );
}
