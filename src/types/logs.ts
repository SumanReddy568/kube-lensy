export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  container: string;
  namespace: string;
  pod: string;
  cluster: string;
}

export interface Cluster {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
}

export interface Namespace {
  name: string;
  cluster: string;
}

export interface Pod {
  name: string;
  namespace: string;
  cluster: string;
  status: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown';
  containers: string[];
  restartCount: number;
  creationTimestamp: string;
  ready: string;
}

export interface FilterState {
  cluster: string | null;
  namespace: string | null;
  pod: string | null;
  container: string | null;
  levels: LogLevel[];
  search: string;
}
