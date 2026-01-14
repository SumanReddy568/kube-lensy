import { useState } from 'react';
import { Search, ChevronDown, Server, Box, Layers, Container } from 'lucide-react';
import { FilterState, LogLevel, Cluster, Namespace, Pod } from '@/types/logs';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  clusters: Cluster[];
  namespaces: Namespace[];
  pods: Pod[];
}

const logLevelConfig: { level: LogLevel; label: string; className: string }[] = [
  { level: 'error', label: 'Error', className: 'bg-destructive/20 text-destructive border-destructive/30 hover:bg-destructive/30' },
  { level: 'warn', label: 'Warn', className: 'bg-warning/20 text-warning border-warning/30 hover:bg-warning/30' },
  { level: 'info', label: 'Info', className: 'bg-info/20 text-info border-info/30 hover:bg-info/30' },
  { level: 'debug', label: 'Debug', className: 'bg-debug/20 text-debug border-debug/30 hover:bg-debug/30' },
];

export function FilterPanel({ filters, onFilterChange, clusters, namespaces, pods }: FilterPanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('cluster');

  const filteredNamespaces = namespaces.filter(
    ns => !filters.cluster || ns.cluster === filters.cluster
  );

  const filteredPods = pods.filter(
    pod => 
      (!filters.cluster || pod.cluster === filters.cluster) &&
      (!filters.namespace || pod.namespace === filters.namespace)
  );

  const toggleLevel = (level: LogLevel) => {
    const newLevels = filters.levels.includes(level)
      ? filters.levels.filter(l => l !== level)
      : [...filters.levels, level];
    onFilterChange({ ...filters, levels: newLevels });
  };

  const FilterSection = ({ 
    id, 
    icon: Icon, 
    title, 
    children 
  }: { 
    id: string; 
    icon: React.ElementType; 
    title: string; 
    children: React.ReactNode;
  }) => (
    <div className="border-b border-border/50">
      <button
        onClick={() => setExpandedSection(expandedSection === id ? null : id)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground transition-transform",
          expandedSection === id && "rotate-180"
        )} />
      </button>
      {expandedSection === id && (
        <div className="px-4 pb-3 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border">
      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search logs..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Log Levels */}
      <div className="p-4 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Log Levels</h3>
        <div className="flex flex-wrap gap-2">
          {logLevelConfig.map(({ level, label, className }) => (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md border transition-all",
                filters.levels.includes(level)
                  ? className
                  : "bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Expandable Filters */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <FilterSection id="cluster" icon={Server} title="Cluster">
          <div className="space-y-1">
            {clusters.map(cluster => (
              <button
                key={cluster.id}
                onClick={() => onFilterChange({ 
                  ...filters, 
                  cluster: filters.cluster === cluster.id ? null : cluster.id,
                  namespace: null,
                  pod: null,
                  container: null 
                })}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-2 rounded-md text-sm transition-colors",
                  filters.cluster === cluster.id
                    ? "bg-primary/20 text-primary"
                    : "text-foreground hover:bg-secondary"
                )}
              >
                <span className="truncate">{cluster.name}</span>
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  cluster.status === 'connected' ? "bg-success" : 
                  cluster.status === 'error' ? "bg-destructive" : "bg-muted-foreground"
                )} />
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection id="namespace" icon={Layers} title="Namespace">
          <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
            {filteredNamespaces.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Select a cluster first</p>
            ) : (
              filteredNamespaces.map(ns => (
                <button
                  key={`${ns.cluster}-${ns.name}`}
                  onClick={() => onFilterChange({ 
                    ...filters, 
                    namespace: filters.namespace === ns.name ? null : ns.name,
                    pod: null,
                    container: null 
                  })}
                  className={cn(
                    "w-full px-3 py-2 rounded-md text-sm text-left transition-colors truncate",
                    filters.namespace === ns.name
                      ? "bg-primary/20 text-primary"
                      : "text-foreground hover:bg-secondary"
                  )}
                >
                  {ns.name}
                </button>
              ))
            )}
          </div>
        </FilterSection>

        <FilterSection id="pod" icon={Box} title="Pod">
          <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
            {filteredPods.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Select a namespace first</p>
            ) : (
              filteredPods.map(pod => (
                <button
                  key={`${pod.cluster}-${pod.namespace}-${pod.name}`}
                  onClick={() => onFilterChange({ 
                    ...filters, 
                    pod: filters.pod === pod.name ? null : pod.name,
                    container: null 
                  })}
                  className={cn(
                    "w-full px-3 py-2 rounded-md text-sm text-left transition-colors",
                    filters.pod === pod.name
                      ? "bg-primary/20 text-primary"
                      : "text-foreground hover:bg-secondary"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate font-mono text-xs">{pod.name}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-medium",
                      pod.status === 'Running' ? "bg-success/20 text-success" :
                      pod.status === 'Pending' ? "bg-warning/20 text-warning" :
                      pod.status === 'Failed' ? "bg-destructive/20 text-destructive" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {pod.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </FilterSection>

        <FilterSection id="container" icon={Container} title="Container">
          <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
            {!filters.pod ? (
              <p className="text-xs text-muted-foreground py-2">Select a pod first</p>
            ) : (
              filteredPods
                .find(p => p.name === filters.pod)
                ?.containers.map(container => (
                  <button
                    key={container}
                    onClick={() => onFilterChange({ 
                      ...filters, 
                      container: filters.container === container ? null : container 
                    })}
                    className={cn(
                      "w-full px-3 py-2 rounded-md text-sm text-left font-mono transition-colors",
                      filters.container === container
                        ? "bg-primary/20 text-primary"
                        : "text-foreground hover:bg-secondary"
                    )}
                  >
                    {container}
                  </button>
                ))
            )}
          </div>
        </FilterSection>
      </div>
    </div>
  );
}
