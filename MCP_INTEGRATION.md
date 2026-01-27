# Kubernetes MCP Server Integration

## Overview

KubeLensy now includes an integrated **Kubernetes MCP (Model Context Protocol) Server** that provides AI-powered diagnostics and intelligent cluster analysis through natural language queries.

## Features

### 🤖 AI-Powered Diagnostics

The MCP server enables you to:

- **Ask questions in natural language** about your Kubernetes cluster
- **Automatically diagnose issues** across pods, nodes, and namespaces
- **Get intelligent recommendations** for fixing problems
- **Analyze logs and events** with AI assistance
- **Troubleshoot failing pods** with comprehensive diagnostics

### 🔧 Available Tools

The MCP server provides 8 specialized diagnostic tools:

1. **diagnose_cluster** - Comprehensive health check of the entire cluster
2. **check_pod_health** - Detailed health diagnostics for specific pods
3. **analyze_events** - Pattern analysis of Kubernetes events
4. **get_resource_usage** - CPU and memory usage metrics
5. **troubleshoot_pod** - Deep troubleshooting with logs and events
6. **list_failing_pods** - Quick identification of problematic pods
7. **get_cluster_overview** - High-level cluster health summary
8. **analyze_logs** - Intelligent log analysis with error detection

## Usage

### Via UI

1. **Open KubeLensy** and connect to your cluster
2. **Click the "AI Diagnostics" button** in the header (Brain icon)
3. **Type your question** in natural language, for example:
   - "Check cluster health"
   - "Show me all failing pods"
   - "Troubleshoot pod nginx-deployment-abc123"
   - "What's wrong with my cluster?"
4. **View the results** with actionable insights and recommendations

### Quick Actions

The UI provides quick action buttons for common queries:
- Check cluster health
- List failing pods
- Cluster overview
- Recent events

### Via API

You can also interact with the MCP server programmatically:

#### Diagnose with Natural Language

```bash
curl -X POST http://localhost:3001/api/ai/diagnose \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Check cluster health",
    "namespace": "default"
  }'
```

#### Get Cluster Health

```bash
curl -X POST http://localhost:3001/api/ai/cluster-health \
  -H "Content-Type: application/json" \
  -d '{"namespace": "default"}'
```

#### Troubleshoot a Pod

```bash
curl -X POST http://localhost:3001/api/ai/troubleshoot-pod \
  -H "Content-Type: application/json" \
  -d '{
    "podName": "nginx-deployment-abc123",
    "namespace": "default"
  }'
```

#### List Failing Pods

```bash
curl http://localhost:3001/api/ai/failing-pods?namespace=default
```

#### Get Cluster Overview

```bash
curl http://localhost:3001/api/ai/cluster-overview
```

## API Endpoints

### POST /api/ai/diagnose
Main endpoint for natural language queries.

**Request:**
```json
{
  "prompt": "string",
  "namespace": "string (optional)"
}
```

**Response:**
```json
{
  "tool": "string",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "string"
      }
    ]
  },
  "prompt": "string"
}
```

### POST /api/ai/cluster-health
Get comprehensive cluster health diagnostics.

**Request:**
```json
{
  "namespace": "string (optional)"
}
```

### POST /api/ai/troubleshoot-pod
Deep troubleshooting for a specific pod.

**Request:**
```json
{
  "podName": "string",
  "namespace": "string"
}
```

### GET /api/ai/failing-pods
List all pods in failing or problematic states.

**Query Parameters:**
- `namespace` (optional): Filter by namespace

### GET /api/ai/cluster-overview
Get a high-level overview of cluster resources and health.

## Architecture

```
┌─────────────┐
│   Frontend  │
│  (React UI) │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Express Server │
│   (server.ts)   │
└──────┬──────────┘
       │
       ▼
┌──────────────────┐
│   MCP Server     │
│ (mcp-server.ts)  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  kubectl / K8s   │
│   API Server     │
└──────────────────┘
```

## Example Queries

Here are some example natural language queries you can use:

### Health Checks
- "Check cluster health"
- "Is my cluster healthy?"
- "Show me cluster status"

### Pod Diagnostics
- "List all failing pods"
- "Show me pods with errors"
- "Troubleshoot pod nginx-abc123 in namespace default"
- "Why is my pod crashing?"

### Resource Analysis
- "Show resource usage"
- "Check CPU and memory usage"
- "Which pods are using the most resources?"

### Event Analysis
- "Show recent warning events"
- "What events happened in the last hour?"
- "Analyze cluster events"

### Logs
- "Analyze logs for pod nginx-abc123"
- "Show me errors in pod logs"

## Response Format

The MCP server returns structured data that includes:

### Cluster Diagnosis
```json
{
  "status": "healthy|warning|critical",
  "summary": "string",
  "issues": [
    {
      "severity": "low|medium|high|critical",
      "resource": "string",
      "message": "string",
      "recommendation": "string"
    }
  ],
  "metrics": {
    "totalPods": 10,
    "healthyPods": 8,
    "unhealthyPods": 2
  }
}
```

### Pod Troubleshooting
```json
{
  "podName": "string",
  "namespace": "string",
  "status": "string",
  "issues": ["string"],
  "recentEvents": [
    {
      "type": "string",
      "reason": "string",
      "message": "string"
    }
  ],
  "logSummary": "string",
  "recommendations": ["string"]
}
```

## Development

### Running the MCP Server

The MCP server starts automatically when you run the backend:

```bash
npm run server
```

Or for development with auto-reload:

```bash
npm run dev:all
```

### Testing the MCP Server

You can test individual MCP tools using the API endpoints:

```bash
# Test cluster diagnosis
curl -X POST http://localhost:3001/api/ai/cluster-health \
  -H "Content-Type: application/json" \
  -d '{}'

# Test failing pods detection
curl http://localhost:3001/api/ai/failing-pods
```

## Troubleshooting

### MCP Server Not Starting

If the MCP server fails to start:

1. Check that `tsx` is installed: `npm install tsx`
2. Verify the MCP SDK is installed: `npm install @modelcontextprotocol/sdk`
3. Check backend logs for errors

### No Results from AI Queries

If queries return no results:

1. Ensure kubectl is configured and accessible
2. Verify cluster connection in KubeLensy
3. Check that you have permissions to access the requested resources
4. Review the backend logs at `/api/debug/logs`

### Timeout Errors

If you experience timeout errors:

1. The default timeout is 30 seconds
2. Large clusters may need more time for comprehensive diagnostics
3. Try narrowing your query to a specific namespace

## Future Enhancements

Planned improvements for the MCP integration:

- [ ] Integration with LLM providers (OpenAI, Anthropic) for enhanced analysis
- [ ] Historical trend analysis
- [ ] Predictive failure detection
- [ ] Automated remediation suggestions
- [ ] Custom diagnostic rules
- [ ] Multi-cluster analysis
- [ ] Export diagnostic reports

## Contributing

To add new diagnostic tools to the MCP server:

1. Add the tool definition to `getAvailableTools()` in `mcp-server.ts`
2. Implement the tool handler in the `CallToolRequestSchema` handler
3. Add the corresponding API endpoint in `server.ts`
4. Update the UI to support the new tool

## License

Same as KubeLensy main project.
