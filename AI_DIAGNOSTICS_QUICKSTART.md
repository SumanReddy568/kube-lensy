# Kubernetes MCP Integration - Quick Start Guide

## ✅ Integration Complete!

The Kubernetes MCP (Model Context Protocol) server has been successfully integrated into KubeLensy, providing AI-powered diagnostics for your Kubernetes clusters.

## 🚀 How to Use

### 1. Start the Application

**For Development (Web):**
```bash
npm run dev:all
```
Then open http://localhost:5173

**For Electron App:**
```bash
npm run electron:dev
```

### 2. Access AI Diagnostics

1. **Connect to your cluster** - KubeLensy will automatically connect using your kubectl context
2. **Click the "AI Diagnostics" button** in the header (Brain icon 🧠)
3. **Ask questions** in natural language!

### 3. Example Queries

Try these queries to get started:

#### Health Checks
- "Check cluster health"
- "Is my cluster healthy?"
- "Give me a cluster overview"

#### Pod Diagnostics  
- "Show me all failing pods"
- "List pods with errors"
- "What pods are having issues?"

#### Troubleshooting
- "Troubleshoot pod [pod-name]"
- "Why is my pod crashing?"
- "Check pod health for [pod-name] in namespace [namespace]"

#### Events & Logs
- "Show recent warning events"
- "Analyze events in namespace default"
- "What errors are in the logs?"

## 🎯 Quick Actions

The UI provides quick action buttons for common queries:
- ✅ Check cluster health
- ⚠️ List failing pods
- 📊 Cluster overview
- 📝 Recent events

Just click a button to run that query instantly!

## 🔧 What Was Fixed for Electron

The integration now works in both web and Electron environments:

1. **Environment-aware API URLs** - Uses `import.meta.env.VITE_API_URL` to detect the correct backend URL
2. **Service abstraction** - All API calls go through `aiDiagnosticsService` for consistency
3. **Backend auto-start** - Electron automatically starts the backend server on launch

## 📊 Response Types

The AI diagnostics can return different types of results:

### Cluster Health
Shows overall cluster status with:
- Health status (Healthy/Warning/Critical)
- Total pods count
- Healthy vs unhealthy pods
- List of issues with recommendations

### Failing Pods
Lists all pods with problems:
- Pod name and namespace
- Current phase/status
- Restart count
- Reason for failure

### Cluster Overview
High-level metrics:
- Node count (total/ready)
- Namespace count
- Pod statistics (running/pending/failed)

### Troubleshooting
Deep analysis of specific pods:
- Current status
- Container states
- Recent events
- Log summary
- Actionable recommendations

## 🛠️ API Endpoints

You can also use the API programmatically:

```bash
# Natural language query
curl -X POST http://localhost:3001/api/ai/diagnose \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Check cluster health"}'

# Cluster health
curl -X POST http://localhost:3001/api/ai/cluster-health \
  -H "Content-Type: application/json" \
  -d '{}'

# List failing pods
curl http://localhost:3001/api/ai/failing-pods

# Cluster overview
curl http://localhost:3001/api/ai/cluster-overview

# Troubleshoot specific pod
curl -X POST http://localhost:3001/api/ai/troubleshoot-pod \
  -H "Content-Type: application/json" \
  -d '{"podName": "nginx-abc", "namespace": "default"}'
```

## 📖 Documentation

For detailed documentation, see:
- **[MCP_INTEGRATION.md](./MCP_INTEGRATION.md)** - Complete integration guide
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Technical implementation details
- **[README.md](./README.md)** - Main project README

## 🐛 Troubleshooting

### "Not connected to backend" in Electron app
- Make sure you're running `npm run electron:dev` which starts both frontend and backend
- Check that port 3001 is not in use by another process
- View backend logs at `/api/debug/logs`

### "Cannot POST /api/ai/diagnose"
- Restart the server: `npm run server`
- Verify the server is running on port 3001
- Check for TypeScript compilation errors

### No results returned
- Ensure kubectl is configured and accessible
- Verify you have permissions to access cluster resources
- Try a simpler query like "cluster overview"

### Timeout errors
- Large clusters may take longer to analyze
- Try narrowing the query to a specific namespace
- Default timeout is 30 seconds

## 💡 Tips

1. **Be specific** - Include namespace names when asking about specific resources
2. **Use quick actions** - Click the quick action buttons for common queries
3. **Check recommendations** - The AI provides actionable recommendations for fixing issues
4. **Combine with logs** - Use AI diagnostics alongside the log viewer for comprehensive debugging

## 🎉 Success!

You now have AI-powered Kubernetes diagnostics integrated into KubeLensy! 

Try asking: **"Check cluster health"** to see it in action!

---

**Need help?** Check the full documentation in [MCP_INTEGRATION.md](./MCP_INTEGRATION.md)
