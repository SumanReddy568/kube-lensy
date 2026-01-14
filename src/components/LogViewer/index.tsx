import { useState, useMemo, useEffect, useCallback } from 'react';
import { FilterPanel } from './FilterPanel';
import { LogList } from './LogList';
import { Header } from './Header';
import { FilterState, LogEntry, LogLevel } from '@/types/logs';
import { mockClusters, mockNamespaces, mockPods, generateMockLogs } from '@/data/mockData';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const initialFilters: FilterState = {
  cluster: 'local',
  namespace: null,
  pod: null,
  container: null,
  levels: ['error', 'warn', 'info', 'debug'],
  search: '',
};

export function LogViewer() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [logs, setLogs] = useState<LogEntry[]>(() => generateMockLogs(100));
  const [isLive, setIsLive] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Simulate live log streaming
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      const newLogs = generateMockLogs(Math.floor(Math.random() * 3) + 1);
      setLogs(prev => [...newLogs, ...prev].slice(0, 500));
    }, 2000);

    return () => clearInterval(interval);
  }, [isLive]);

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

  const handleRefresh = useCallback(() => {
    setLogs(generateMockLogs(100));
  }, []);

  const handleClear = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header 
        filters={filters} 
        onRefresh={handleRefresh} 
        onClear={handleClear}
        isLive={isLive}
      />
      
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
            onFilterChange={setFilters}
            clusters={mockClusters}
            namespaces={mockNamespaces}
            pods={mockPods}
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
