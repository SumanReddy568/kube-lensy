import { useState, useMemo, useEffect } from 'react';
import { FilterPanel } from './FilterPanel';
import { LogList } from './LogList';
import { Header } from './Header';
import { ConnectionBanner } from './ConnectionStatus';
import { FilterState } from '@/types/logs';
import { useKubernetes, usePodLogs } from '@/hooks/useKubernetes';
import { PodDetailsSidebar } from './PodDetailsSidebar';
import { ErrorSummarySidebar } from './ErrorSummarySidebar';
import { AIDiagnosticsPanel } from '@/components/AIDiagnostics';
import { BarChart3 } from 'lucide-react';

const initialFilters: FilterState = {
  cluster: null,
  namespace: null,
  pod: null,
  container: null,
  levels: [], // Default to none selected (means show all)
  search: '',
};

const STORAGE_KEY = 'kubelensy_filters';

const loadFilters = (): FilterState => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Validate structure to prevent crashes
      if (parsed && Array.isArray(parsed.levels)) {
        return parsed;
      }
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
  const [showErrorSummary, setShowErrorSummary] = useState(false);
  const [showAIDiagnostics, setShowAIDiagnostics] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string | undefined>(undefined);
  //Kubernetes connection
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
    refreshNamespaces,
    appErrors
  } = useKubernetes(filters.namespace || undefined);

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
      const targetExists = clusters.some(c => c.id === filters.cluster);

      if (currentConnected && targetExists && currentConnected !== filters.cluster) {
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

      // If levels is empty, show all logs. Otherwise, filter by selected levels.
      if (filters.levels.length > 0 && !filters.levels.includes(log.level)) return false;

      if (filters.search && !log.message.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [logs, filters, clusters]);

  const selectedPod = useMemo(() => {
    if (!filters.pod) return undefined;
    return pods.find(p => p.name === filters.pod && (!filters.namespace || p.namespace === filters.namespace));
  }, [pods, filters.pod, filters.namespace]);

  const handleGlobalRefresh = async () => {
    // 1. Refresh logs if pod is selected
    if (filters.pod) {
      refresh();
    }

    // 2. Refresh pods if namespace is selected
    if (filters.namespace) {
      refreshPods(filters.namespace);
    }

    // 3. Refresh namespaces
    refreshNamespaces();

    // 4. Force connection check
    checkConnection(false);
  };

  const handleLogDiagnose = (log: any) => {
    const prompt = `Analyze this log error from pod ${log.pod} in namespace ${log.namespace}: "${log.message}"`;
    setAiPrompt(prompt);
    setShowAIDiagnostics(true);
    setShowPodDetails(false);
    setShowErrorSummary(false);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden font-sans">
      <Header
        filters={filters}
        onRefresh={handleGlobalRefresh}
        onClear={clear}
        onShowDetails={() => {
          const next = !showPodDetails;
          setShowPodDetails(next);
          if (next) setShowErrorSummary(false);
          localStorage.setItem('kubelensy_show_pod_details', String(next));
        }}
        isLive={isLive}
        connected={connected}
        loading={k8sLoading}
        error={k8sError}
        onRetryConnection={checkConnection}
        lastUpdate={lastUpdate}
        selectedPod={selectedPod}
        showErrorSummary={showErrorSummary}
        onToggleErrorSummary={() => {
          const next = !showErrorSummary;
          setShowErrorSummary(next);
          if (next) {
            setShowPodDetails(false);
            setShowAIDiagnostics(false);
          }
        }}
        errorCount={logs.filter(l => l.level === 'error').length}
        showAIDiagnostics={showAIDiagnostics}
        onToggleAIDiagnostics={() => {
          const next = !showAIDiagnostics;
          setShowAIDiagnostics(next);
          if (next) {
            setShowPodDetails(false);
            setShowErrorSummary(false);
          }
        }}
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
          <LogList
            logs={filteredLogs}
            searchTerm={filters.search}
            onDiagnoseLog={handleLogDiagnose}
          />
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

        {showErrorSummary && (
          <ErrorSummarySidebar
            logs={logs}
            appErrors={appErrors}
            onClose={() => setShowErrorSummary(false)}
            onSelectError={(msg) => {
              setFilters({ ...filters, search: msg });
              setShowErrorSummary(false);
            }}
          />
        )}

        {showAIDiagnostics && (
          <div className="w-[350px] md:w-[450px] lg:w-[500px] border-l border-border bg-card overflow-y-auto flex-shrink-0">
            <AIDiagnosticsPanel
              namespace={filters.namespace || undefined}
              initialPrompt={aiPrompt}
            />
          </div>
        )}
      </main>
    </div>
  );
}
