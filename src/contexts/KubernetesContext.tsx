import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Cluster, Namespace, Pod } from '@/types/logs';
import * as k8sApi from '@/services/kubernetesApi';

interface K8sState {
    connected: boolean;
    loading: boolean;
    error: string | null;
    clusters: Cluster[];
    namespaces: Namespace[];
    pods: Pod[];
    appErrors: Array<{ message: string; count: number; lastSeen: Date }>;
}

interface KubernetesContextType extends K8sState {
    checkConnection: (silent?: boolean) => Promise<void>;
    switchCluster: (clusterId: string) => Promise<void>;
    refreshPods: (namespace?: string) => Promise<void>;
    refreshNamespaces: () => Promise<void>;
    recordAppError: (message: string) => void;
}

const KubernetesContext = createContext<KubernetesContextType | undefined>(undefined);

export function KubernetesProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<K8sState>({
        connected: false,
        loading: true,
        error: null,
        clusters: [],
        namespaces: [],
        pods: [],
        appErrors: [],
    });

    const isInitialMount = useRef(true);
    const lastTargetNamespace = useRef<string | undefined>(undefined);

    const recordAppError = useCallback((message: string) => {
        setState(prev => {
            const existing = prev.appErrors.find(e => e.message === message);
            if (existing) {
                return {
                    ...prev,
                    appErrors: prev.appErrors.map(e =>
                        e.message === message ? { ...e, count: e.count + 1, lastSeen: new Date() } : e
                    )
                };
            }
            return {
                ...prev,
                appErrors: [...prev.appErrors, { message, count: 1, lastSeen: new Date() }]
            };
        });
    }, []);

    const checkConnection = useCallback(async (silent = false) => {
        if (!silent) setState(prev => ({ ...prev, loading: true }));

        const maxRetries = silent ? 0 : 5;
        let lastError = 'Failed to connect to backend';

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const status = await k8sApi.checkConnection();

                if (status.connected) {
                    if (!state.connected || !silent) {
                        const [clusters, namespacesResponse] = await Promise.all([
                            k8sApi.fetchClusters().catch(e => { console.error(e); return []; }),
                            k8sApi.fetchNamespaces().catch(e => { console.error(e); return []; })
                        ]);

                        const valNamespaces = Array.isArray(namespacesResponse) ? namespacesResponse : [];

                        setState(prev => ({
                            ...prev,
                            connected: true,
                            loading: false,
                            error: null,
                            clusters: Array.isArray(clusters) ? clusters : [],
                            namespaces: valNamespaces,
                        }));

                        // Fetch pods in background
                        k8sApi.fetchPods(lastTargetNamespace.current).then(pods => {
                            setState(prev => ({ ...prev, pods: Array.isArray(pods) ? pods : [] }));
                        }).catch(e => console.error('Background pod fetch failed:', e));
                    } else {
                        setState(prev => ({
                            ...prev,
                            connected: true,
                            loading: false,
                            error: null
                        }));
                    }
                    return; // Success!
                } else {
                    lastError = status.error || 'Not connected';
                }
            } catch (error) {
                lastError = 'Failed to connect to backend';
            }

            if (attempt < maxRetries) {
                // Wait before retrying (exponential backoff or simple delay)
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }

        // If we reached here, all attempts failed
        setState(prev => ({
            ...prev,
            connected: false,
            loading: false,
            error: lastError,
        }));
    }, [state.connected]);

    const switchCluster = useCallback(async (clusterId: string) => {
        setState(prev => ({ ...prev, loading: true }));
        try {
            await k8sApi.switchCluster(clusterId);
            const [clusters, namespaces] = await Promise.all([
                k8sApi.fetchClusters().catch(e => { console.error(e); return []; }),
                k8sApi.fetchNamespaces().catch(e => { console.error(e); return []; }),
            ]);

            setState(prev => ({
                ...prev,
                connected: true,
                loading: false,
                error: null,
                clusters: Array.isArray(clusters) ? clusters : [],
                namespaces: Array.isArray(namespaces) ? namespaces : [],
                pods: [],
            }));

            k8sApi.fetchPods(lastTargetNamespace.current).then(pods => {
                setState(prev => ({ ...prev, pods: Array.isArray(pods) ? pods : [] }));
            }).catch(e => console.error('Background pod fetch failed after switch:', e));

        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to switch cluster';
            recordAppError(`Cluster Switch Error: ${msg}`);
            setState(prev => ({ ...prev, loading: false, error: msg }));
        }
    }, [recordAppError]);

    const refreshPods = useCallback(async (namespace?: string) => {
        lastTargetNamespace.current = namespace;
        try {
            const pods = await k8sApi.fetchPods(namespace);
            setState(prev => ({ ...prev, pods: Array.isArray(pods) ? pods : [] }));
        } catch (error) {
            console.error('Failed to refresh pods:', error);
        }
    }, []);

    const refreshNamespaces = useCallback(async () => {
        try {
            const namespaces = await k8sApi.fetchNamespaces();
            setState(prev => ({ ...prev, namespaces: Array.isArray(namespaces) ? namespaces : [] }));
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            recordAppError(`Namespace Sync Error: ${msg}`);
        }
    }, [recordAppError]);

    useEffect(() => {
        if (isInitialMount.current) {
            checkConnection(false);
            isInitialMount.current = false;
        }
        const interval = setInterval(() => checkConnection(true), 30000);
        return () => clearInterval(interval);
    }, [checkConnection]);

    const value = {
        ...state,
        checkConnection: (silent?: boolean) => checkConnection(silent),
        switchCluster,
        refreshPods,
        refreshNamespaces,
        recordAppError,
    };

    return (
        <KubernetesContext.Provider value={value}>
            {children}
        </KubernetesContext.Provider>
    );
}

export function useKubernetesContext() {
    const context = useContext(KubernetesContext);
    if (context === undefined) {
        throw new Error('useKubernetesContext must be used within a KubernetesProvider');
    }
    return context;
}
