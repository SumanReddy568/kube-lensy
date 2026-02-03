import { Search, Server, Box, Layers, Container, X, Filter, Activity, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from 'react';
import { addManualNamespace } from '@/services/kubernetesApi';
import { useToast } from "@/components/ui/use-toast";

interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  clusters: Cluster[];
  namespaces: Namespace[];
  pods: Pod[];
  onRefreshNamespaces: () => void;
}

export function FilterPanel({ filters, onFilterChange, clusters, namespaces, pods, onRefreshNamespaces }: FilterPanelProps) {
  const navigate = useNavigate();
  const [isAddNamespaceOpen, setIsAddNamespaceOpen] = useState(false);
  const [newNamespace, setNewNamespace] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nss = Array.isArray(namespaces) ? namespaces : [];
  const filteredNamespaces = nss.filter(
    ns => ns && (!filters.cluster || ns.cluster === filters.cluster)
  );

  const pds = Array.isArray(pods) ? pods : [];
  const filteredPods = pds.filter(
    pod =>
      pod &&
      (!filters.cluster || pod.cluster === filters.cluster) &&
      (!filters.namespace || pod.namespace === filters.namespace)
  );

  const handleLevelChange = (value: string[]) => {
    onFilterChange({
      ...filters,
      levels: value as LogLevel[]
    });
  };

  const handleAddNamespace = async () => {
    if (!newNamespace.trim()) return;

    setIsSubmitting(true);
    try {
      await addManualNamespace(newNamespace.trim());
      onRefreshNamespaces();
      setIsAddNamespaceOpen(false);
      setNewNamespace("");
    } catch (error) {
      console.error('Failed to add namespace:', error);
    } finally {
      setIsSubmitting(false);
    }
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
                  <SelectItem key={`${ns.cluster || 'none'}-${ns.name || Math.random()}`} value={ns.name || ""}>
                    <div className="max-w-[300px] truncate">{ns.name || "Unknown"}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={isAddNamespaceOpen} onOpenChange={setIsAddNamespaceOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add Namespace Manually</DialogTitle>
                  <DialogDescription>
                    Enter the name of the namespace you want to add. It will be saved for the current cluster context.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="name" className="text-right text-sm">
                      Name
                    </label>
                    <Input
                      id="name"
                      value={newNamespace}
                      onChange={(e) => setNewNamespace(e.target.value)}
                      className="col-span-3"
                      placeholder="e.g. my-namespace"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddNamespace()}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" onClick={handleAddNamespace} disabled={isSubmitting || !newNamespace.trim()}>
                    {isSubmitting ? "Adding..." : "Add Namespace"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Pod Select */}
          <div className="flex items-center gap-2 min-w-[220px] flex-1">
            <div className={`p-1.5 rounded-md transition-colors ${filters.pod ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <Box className="w-3.5 h-3.5" />
            </div>
            <Select
              value={filters.pod && filters.namespace ? `${filters.namespace}/${filters.pod}` :
                filters.pod ? (pods.find(p => p.name === filters.pod)?.namespace || "unknown") + "/" + filters.pod : "all-pods"}
              disabled={pods.length === 0}
              onValueChange={(val) => {
                if (val === "all-pods") {
                  onFilterChange({ ...filters, pod: null, container: null });
                } else {
                  const [ns, name] = val.split('/');
                  onFilterChange({
                    ...filters,
                    namespace: ns,
                    pod: name,
                    container: null
                  });
                }
              }}
            >
              <SelectTrigger className="h-9 w-full bg-background/50 border-muted-foreground/20">
                <SelectValue placeholder="All Pods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-pods">All Pods</SelectItem>
                {filteredPods.map(pod => (
                  <SelectItem key={`${pod.cluster}-${pod.namespace}-${pod.name}`} value={`${pod.namespace}/${pod.name}`}>
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
