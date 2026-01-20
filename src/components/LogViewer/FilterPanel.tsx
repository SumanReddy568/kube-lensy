import { Search, Server, Box, Layers, Container, X, Filter } from 'lucide-react';
import { FilterState, Cluster, Namespace, Pod, LogLevel } from '@/types/logs';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";

interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  clusters: Cluster[];
  namespaces: Namespace[];
  pods: Pod[];
}

export function FilterPanel({ filters, onFilterChange, clusters, namespaces, pods }: FilterPanelProps) {
  const filteredNamespaces = namespaces.filter(
    ns => !filters.cluster || ns.cluster === filters.cluster
  );

  const filteredPods = pods.filter(
    pod =>
      (!filters.cluster || pod.cluster === filters.cluster) &&
      (!filters.namespace || pod.namespace === filters.namespace)
  );

  const hasActiveFilters = filters.cluster || filters.namespace || filters.pod || filters.search || filters.levels.length > 0;

  const handleClearFilters = () => {
    onFilterChange({
      cluster: null,
      namespace: null,
      pod: null,
      container: null,
      levels: [],
      search: ""
    });
  };

  const handleLevelChange = (value: string[]) => {
    onFilterChange({
      ...filters,
      levels: value as LogLevel[]
    });
  };

  return (
    <div className="w-full bg-card/50 backdrop-blur-sm border-b border-border shadow-sm transition-all duration-200">
      <div className="p-3 flex flex-col gap-3">
        {/* Top Row: Search and Action Buttons */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={filters.search}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              className="pl-9 h-9 bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all font-mono text-sm"
            />
            {filters.search && (
              <button
                onClick={() => onFilterChange({ ...filters, search: "" })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          {/* Log Levels */}
          <ToggleGroup type="multiple" value={filters.levels} onValueChange={handleLevelChange} className="hidden sm:flex bg-muted/30 p-1 rounded-lg border border-border/50">
            <ToggleGroupItem value="error" size="sm" className="h-7 px-2.5 data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground text-xs hover:bg-muted font-medium transition-all" aria-label="Toggle Error">
              ERR
            </ToggleGroupItem>
            <ToggleGroupItem value="warn" size="sm" className="h-7 px-2.5 data-[state=on]:bg-warning data-[state=on]:text-warning-foreground text-xs hover:bg-muted font-medium transition-all" aria-label="Toggle Warning">
              WRN
            </ToggleGroupItem>
            <ToggleGroupItem value="info" size="sm" className="h-7 px-2.5 data-[state=on]:bg-blue-500 data-[state=on]:text-white text-xs hover:bg-muted font-medium transition-all" aria-label="Toggle Info">
              INF
            </ToggleGroupItem>
            <ToggleGroupItem value="debug" size="sm" className="h-7 px-2.5 text-xs hover:bg-muted font-medium transition-all" aria-label="Toggle Debug">
              DBG
            </ToggleGroupItem>
          </ToggleGroup>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-9 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}
        </div>

        <Separator className="bg-border/50" />

        {/* Bottom Row: Context Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Cluster Select */}
          <div className="flex items-center gap-2 min-w-[200px] flex-1">
            <div className={`p-1.5 rounded-md transition-colors ${filters.cluster ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <Server className="w-3.5 h-3.5" />
            </div>
            <Select
              value={filters.cluster || "all-clusters"}
              onValueChange={(val) => onFilterChange({
                ...filters,
                cluster: val === "all-clusters" ? null : val,
                namespace: null,
                pod: null,
                container: null
              })}
            >
              <SelectTrigger className="h-9 w-full bg-background/50 border-muted-foreground/20">
                <SelectValue placeholder="All Clusters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-clusters">All Clusters</SelectItem>
                {clusters.map(cluster => (
                  <SelectItem key={cluster.id} value={cluster.id}>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        cluster.status === 'connected' ? "bg-success" :
                          cluster.status === 'error' ? "bg-destructive" : "bg-muted-foreground"
                      )} />
                      <span className="truncate">{cluster.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Namespace Select */}
          <div className="flex items-center gap-2 min-w-[180px] flex-1">
            <div className={`p-1.5 rounded-md transition-colors ${filters.namespace ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <Layers className="w-3.5 h-3.5" />
            </div>
            <Select
              value={filters.namespace || "all-namespaces"}
              disabled={!filters.cluster && clusters.length > 1}
              onValueChange={(val) => onFilterChange({
                ...filters,
                namespace: val === "all-namespaces" ? null : val,
                pod: null,
                container: null
              })}
            >
              <SelectTrigger className="h-9 w-full bg-background/50 border-muted-foreground/20">
                <SelectValue placeholder="All Namespaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-namespaces">All Namespaces</SelectItem>
                {filteredNamespaces.map(ns => (
                  <SelectItem key={`${ns.cluster}-${ns.name}`} value={ns.name}>
                    <div className="max-w-[300px] truncate">{ns.name}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pod Select */}
          <div className="flex items-center gap-2 min-w-[220px] flex-1">
            <div className={`p-1.5 rounded-md transition-colors ${filters.pod ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <Box className="w-3.5 h-3.5" />
            </div>
            <Select
              value={filters.pod || "all-pods"}
              disabled={!filters.namespace && filteredNamespaces.length > 0}
              onValueChange={(val) => onFilterChange({
                ...filters,
                pod: val === "all-pods" ? null : val,
                container: null
              })}
            >
              <SelectTrigger className="h-9 w-full bg-background/50 border-muted-foreground/20">
                <SelectValue placeholder="All Pods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-pods">All Pods</SelectItem>
                {filteredPods.map(pod => (
                  <SelectItem key={`${pod.cluster}-${pod.namespace}-${pod.name}`} value={pod.name}>
                    <div className="flex items-center justify-between gap-3 w-full max-w-[400px]">
                      <span className="truncate font-mono text-xs">{pod.name}</span>
                      <Badge variant={pod.status === 'Running' ? 'default' : 'secondary'} className="text-[9px] px-1 h-3.5 shrink-0 pointer-events-none">
                        {pod.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Container Select */}
          <div className="flex items-center gap-2 min-w-[140px] flex-1">
            <div className={`p-1.5 rounded-md transition-colors ${filters.container ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <Container className="w-3.5 h-3.5" />
            </div>
            <Select
              value={filters.container || "all-containers"}
              disabled={!filters.pod}
              onValueChange={(val) => onFilterChange({
                ...filters,
                container: val === "all-containers" ? null : val
              })}
            >
              <SelectTrigger className="h-9 truncate bg-background/50 border-muted-foreground/20">
                <SelectValue placeholder="All Containers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-containers">All Containers</SelectItem>
                {filters.pod && filteredPods
                  .find(p => p.name === filters.pod)
                  ?.containers.map(container => (
                    <SelectItem key={container} value={container} className="font-mono text-xs">
                      {container}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
