import { Search, Server, Box, Layers, Container } from 'lucide-react';
import { FilterState, Cluster, Namespace, Pod } from '@/types/logs';
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

  return (
    <div className="w-full bg-card border-b border-border p-3 flex flex-col gap-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="pl-9 h-9"
          />
        </div>

        {/* Cluster Select */}
        <div className="flex items-center gap-2 min-w-[250px] flex-1">
          <Server className="w-4 h-4 text-primary shrink-0" />
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
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Select Cluster" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-clusters">All Clusters</SelectItem>
              {clusters.map(cluster => (
                <SelectItem key={cluster.id} value={cluster.id}>
                  <div className="flex items-center gap-2 max-w-[400px]">
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
        <div className="flex items-center gap-2 min-w-[200px] flex-1">
          <Layers className="w-4 h-4 text-primary shrink-0" />
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
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Namespace" />
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
        <div className="flex items-center gap-2 min-w-[250px] flex-1">
          <Box className="w-4 h-4 text-primary shrink-0" />
          <Select
            value={filters.pod || "all-pods"}
            disabled={!filters.namespace && filteredNamespaces.length > 0}
            onValueChange={(val) => onFilterChange({
              ...filters,
              pod: val === "all-pods" ? null : val,
              container: null
            })}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Pod" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-pods">All Pods</SelectItem>
              {filteredPods.map(pod => (
                <SelectItem key={`${pod.cluster}-${pod.namespace}-${pod.name}`} value={pod.name}>
                  <div className="flex items-center justify-between gap-3 w-full max-w-[500px]">
                    <span className="truncate font-mono text-xs">{pod.name}</span>
                    <Badge variant={pod.status === 'Running' ? 'default' : 'secondary'} className="text-[10px] px-1 h-4 shrink-0">
                      {pod.status}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Container Select */}
        <div className="flex items-center gap-2 min-w-[150px] flex-1">
          <Container className="w-4 h-4 text-primary shrink-0" />
          <Select
            value={filters.container || "all-containers"}
            disabled={!filters.pod}
            onValueChange={(val) => onFilterChange({
              ...filters,
              container: val === "all-containers" ? null : val
            })}
          >
            <SelectTrigger className="h-9 truncate">
              <SelectValue placeholder="Container" />
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
  );
}
