const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

export interface DiagnosticPrompt {
    prompt: string;
    namespace?: string;
}

export interface DiagnosticResult {
    tool: string;
    result: {
        content: Array<{
            type: string;
            text: string;
        }>;
    };
    prompt: string;
}

export interface ClusterHealthRequest {
    namespace?: string;
}

export interface TroubleshootPodRequest {
    podName: string;
    namespace: string;
}

export const aiDiagnosticsService = {
    /**
     * Send a natural language prompt to diagnose cluster issues
     */
    async diagnose(data: DiagnosticPrompt): Promise<DiagnosticResult> {
        const response = await fetch(`${API_BASE_URL}/ai/diagnose`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Failed to get diagnostics');
        }

        return response.json();
    },

    /**
     * Get comprehensive cluster health check
     */
    async getClusterHealth(data: ClusterHealthRequest = {}): Promise<any> {
        const response = await fetch(`${API_BASE_URL}/ai/cluster-health`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Failed to get cluster health');
        }

        return response.json();
    },

    /**
     * Troubleshoot a specific pod
     */
    async troubleshootPod(data: TroubleshootPodRequest): Promise<any> {
        const response = await fetch(`${API_BASE_URL}/ai/troubleshoot-pod`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Failed to troubleshoot pod');
        }

        return response.json();
    },

    /**
     * List all failing pods
     */
    async getFailingPods(namespace?: string): Promise<any> {
        const url = new URL(`${API_BASE_URL}/ai/failing-pods`);
        if (namespace) {
            url.searchParams.append('namespace', namespace);
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new Error('Failed to get failing pods');
        }

        return response.json();
    },

    /**
     * Get cluster overview
     */
    async getClusterOverview(): Promise<any> {
        const response = await fetch(`${API_BASE_URL}/ai/cluster-overview`);

        if (!response.ok) {
            throw new Error('Failed to get cluster overview');
        }

        return response.json();
    },
};
