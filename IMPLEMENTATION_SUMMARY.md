# Kubernetes MCP Integration - Implementation Summary

## What Was Built

This integration adds AI-powered Kubernetes diagnostics to KubeLensy using the Model Context Protocol (MCP).

## Files Created

### 1. MCP Server (`mcp-server.ts`)
- **Location**: `kube-lensy/mcp-server.ts`
- **Purpose**: Standalone MCP server that provides 8 diagnostic tools for Kubernetes cluster analysis
- **Key Features**:
  - Cluster health diagnosis
  - Pod troubleshooting
  - Event analysis
  - Resource usage monitoring
  - Log analysis
  - Failing pod detection

### 2. AI Diagnostics Panel Component (`src/components/AIDiagnostics/AIDiagnosticsPanel.tsx`)
- **Location**: `kube-lensy/src/components/AIDiagnostics/AIDiagnosticsPanel.tsx`
- **Purpose**: React UI component for natural language queries
- **Features**:
  - Text input for natural language queries
  - Quick action buttons for common queries
  - Intelligent result rendering based on query type
  - Visual health indicators and metrics

### 3. AI Diagnostics Service (`src/services/aiDiagnostics.ts`)
- **Location**: `kube-lensy/src/services/aiDiagnostics.ts`
- **Purpose**: TypeScript service for API communication
- **Exports**: Typed functions for all AI diagnostic endpoints

### 4. Documentation (`MCP_INTEGRATION.md`)
- **Location**: `kube-lensy/MCP_INTEGRATION.md`
- **Purpose**: Comprehensive guide for using the MCP integration
- **Contents**:
  - Feature overview
  - Usage examples
  - API reference
  - Architecture diagram
  - Troubleshooting guide

### 5. Example Script (`examples/mcp-usage.js`)
- **Location**: `kube-lensy/examples/mcp-usage.js`
- **Purpose**: Demonstrates programmatic API usage
- **Usage**: `node examples/mcp-usage.js`

## Files Modified

### 1. Server (`server.ts`)
**Changes**:
- Added MCP server process management
- Added 5 new API endpoints:
  - `POST /api/ai/diagnose` - Natural language queries
  - `POST /api/ai/cluster-health` - Cluster health check
  - `POST /api/ai/troubleshoot-pod` - Pod troubleshooting
  - `GET /api/ai/failing-pods` - List failing pods
  - `GET /api/ai/cluster-overview` - Cluster overview
- Added helper function `determineToolFromPrompt()` for NLP parsing

### 2. LogViewer Component (`src/components/LogViewer/index.tsx`)
**Changes**:
- Added `showAIDiagnostics` state
- Integrated `AIDiagnosticsPanel` component
- Added toggle logic to show/hide AI panel

### 3. Header Component (`src/components/LogViewer/Header.tsx`)
**Changes**:
- Added "AI Diagnostics" button with Brain icon
- Added props for AI diagnostics toggle
- Integrated toggle state management

### 4. Package.json (`package.json`)
**Changes**:
- Added `@modelcontextprotocol/sdk` dependency
- Added `mcp-server` script for standalone execution

### 5. README (`README.md`)
**Changes**:
- Added AI-Powered Diagnostics to features list
- Added dedicated AI diagnostics section
- Added link to MCP integration guide

## API Endpoints

### Natural Language Query
```
POST /api/ai/diagnose
Body: { "prompt": "string", "namespace": "string?" }
```

### Cluster Health
```
POST /api/ai/cluster-health
Body: { "namespace": "string?" }
```

### Troubleshoot Pod
```
POST /api/ai/troubleshoot-pod
Body: { "podName": "string", "namespace": "string" }
```

### Failing Pods
```
GET /api/ai/failing-pods?namespace=string
```

### Cluster Overview
```
GET /api/ai/cluster-overview
```

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                         User Interface                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  AI Diagnostics Panel                                  │  │
│  │  - Text input for queries                              │  │
│  │  - Quick action buttons                                │  │
│  │  - Results display                                     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP Request
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                      Express Server                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  API Endpoints                                         │  │
│  │  - Parse natural language                              │  │
│  │  - Route to appropriate MCP tool                       │  │
│  │  - Return structured results                           │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
                       │ JSON-RPC over stdio
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                       MCP Server                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Diagnostic Tools                                      │  │
│  │  - diagnose_cluster                                    │  │
│  │  - check_pod_health                                    │  │
│  │  - analyze_events                                      │  │
│  │  - troubleshoot_pod                                    │  │
│  │  - list_failing_pods                                   │  │
│  │  - get_cluster_overview                                │  │
│  │  - get_resource_usage                                  │  │
│  │  - analyze_logs                                        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
                       │ kubectl commands
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                  Kubernetes API Server                        │
└──────────────────────────────────────────────────────────────┘
```

## Usage Examples

### Via UI
1. Click "AI Diagnostics" button in header
2. Type: "Check cluster health"
3. View results with recommendations

### Via API
```bash
curl -X POST http://localhost:3001/api/ai/diagnose \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Show me all failing pods"}'
```

### Via Code
```typescript
import { aiDiagnosticsService } from '@/services/aiDiagnostics';

const result = await aiDiagnosticsService.diagnose({
  prompt: 'Check cluster health',
  namespace: 'default'
});
```

## Testing

To test the integration:

1. **Start the server**:
   ```bash
   npm run dev:all
   ```

2. **Open the UI**:
   - Navigate to http://localhost:5173
   - Click "AI Diagnostics" button
   - Try a query like "Check cluster health"

3. **Test the API**:
   ```bash
   curl http://localhost:3001/api/ai/cluster-overview
   ```

4. **Run the example**:
   ```bash
   node examples/mcp-usage.js
   ```

## Next Steps

To use this integration:

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Start the application**:
   ```bash
   npm run dev:all
   ```

3. **Connect to your cluster**:
   - Ensure kubectl is configured
   - Select your cluster in KubeLensy

4. **Try AI diagnostics**:
   - Click the "AI Diagnostics" button
   - Ask questions about your cluster

## Benefits

✅ **Natural Language Interface**: No need to remember kubectl commands
✅ **Intelligent Analysis**: Automatic issue detection and recommendations
✅ **Time Saving**: Quick diagnosis of cluster problems
✅ **Comprehensive**: Analyzes pods, events, logs, and resources
✅ **Actionable**: Provides specific recommendations for fixes
✅ **Extensible**: Easy to add new diagnostic tools

## Future Enhancements

Potential improvements:
- Integration with LLM providers (GPT-4, Claude) for enhanced analysis
- Historical trend analysis
- Predictive failure detection
- Automated remediation
- Custom diagnostic rules
- Multi-cluster analysis
- Export diagnostic reports

## Support

For issues or questions:
- Check the [MCP Integration Guide](./MCP_INTEGRATION.md)
- Review the [example script](./examples/mcp-usage.js)
- Check backend logs at `/api/debug/logs`
