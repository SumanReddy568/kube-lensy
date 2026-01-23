import { useState, useEffect, useRef } from 'react';
import { Terminal, ArrowLeft, RefreshCw, Trash2, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

export default function DebugLogs() {
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Initial fetch
        fetch(`${API_BASE_URL}/debug/logs`)
            .then(res => res.text())
            .then(text => {
                setLogs(text.split('\n').filter(Boolean));
                setLoading(false);
            });

        // Stream updates
        const eventSource = new EventSource(`${API_BASE_URL}/debug/logs/stream`);
        eventSource.onmessage = (event) => {
            setLogs(prev => [...prev, event.data].slice(-2000));
        };

        return () => eventSource.close();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const handleDownload = () => {
        const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kubelensy-debug-${new Date().toISOString()}.log`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-screen flex flex-col bg-[#0d1117] text-gray-300 font-mono text-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-[#161b22]">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-1.5 hover:bg-gray-800 rounded-md transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-primary/20 rounded-lg">
                            <Terminal className="w-5 h-5 text-primary" />
                        </div>
                        <h1 className="text-lg font-bold text-white uppercase tracking-tight">KubeLensy Internal Logs</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <div className="h-4 w-px bg-gray-700 mx-1" />
                    <span className="text-xs text-gray-500">Live Streaming Enabled</span>
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                </div>
            </div>

            {/* Log Content */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-1 selection:bg-primary/30"
            >
                {loading ? (
                    <div className="flex items-center justify-center h-full gap-3 text-gray-500">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Loading system logs...
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500 italic">
                        No internal logs recorded yet.
                    </div>
                ) : (
                    logs.map((line, i) => {
                        const isError = line.includes('[STDERR]') || line.includes('Error') || line.includes('Exception');
                        const isSystem = line.includes('--- Session Started ---') || line.includes('!!! KubeLensy');
                        const isNetwork = line.includes('[NETWORK]');

                        return (
                            <div
                                key={i}
                                className={`flex gap-4 p-0.5 rounded transition-colors hover:bg-white/5 
                                    ${isError ? 'text-red-400' :
                                        isSystem ? 'text-primary font-bold border-y border-white/5 my-2 py-1' :
                                            isNetwork ? 'text-cyan-400' : ''
                                    }`}
                            >
                                <span className="opacity-30 select-none w-12 text-right shrink-0">{i + 1}</span>
                                <span className="break-all whitespace-pre-wrap">{line}</span>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-2 border-t border-gray-800 bg-[#161b22] flex justify-between items-center text-[10px] text-gray-500 uppercase tracking-widest">
                <span>Backend Version: 1.0.0-PROD</span>
                <span>{logs.length} Lines Captured</span>
            </div>
        </div>
    );
}
