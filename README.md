# KubeLensy ☸️

KubeLensy is a high-performance, beautiful, and developer-friendly Kubernetes Log Viewer. It runs locally as a lightweight binary or via Node.js, connecting directly to your `kubectl` context to provide a seamless log analysis experience without the overhead of heavy dashboards.

## Features

- 🚀 **Zero Configuration**: Uses your existing `.kube/config`.
- 📊 **Multi-Cluster Support**: Switch between Kubernetes contexts directly from the UI.
- 🔍 **Powerful Filtering**: Filter by namespace, pod, container, and log levels.
- ⚡ **Real-time Streaming**: Watch logs as they happen with auto-scroll support.
- 🤖 **AI-Powered Diagnostics**: Natural language queries for cluster health and troubleshooting.
- 🎨 **Modern Interface**: Built with React, Tailwind CSS, and shadcn/ui.
- 📦 **No Proxy Needed**: Communicates directly with your cluster using an integrated backend.

## Quick Start

### 1. Prerequisites
Ensure you have `kubectl` installed and configured with your clusters.

### 2. Installation
Clone the repository and install dependencies:
```sh
git clone https://github.com/SumanReddy18/kube-lensy.git
cd kube-lensy
npm install
```

### 3. Running for Development
Starts both the frontend (Vite) and the backend server:
```sh
npm run dev:all
```
Open [http://localhost:8080](http://localhost:8080)

### 4. Running as a Production Tool
Build the project and start the integrated server:
```sh
npm run start
```
Open [http://localhost:3001](http://localhost:3001)

## Global Setup (Recommended)
You can set up KubeLensy as a global command to launch it from any terminal.

### For Zsh (macOS/Linux)
Add an alias to your `~/.zshrc`:
```sh
echo "alias kubelensy='cd $(pwd) && npm run server'" >> ~/.zshrc
source ~/.zshrc
```

Now you can just type `kubelensy` any time you need to debug your clusters.

## Tech Stack
- **Frontend**: Vite, React, TypeScript, Radix UI, Lucide Icons.
- **Backend**: Express.js (Node.js) wrapper for `kubectl`.
- **Styling**: Tailwind CSS with custom branding.

## Performance & Memory
KubeLensy is designed for stability. It uses a sliding window (latest 500 lines) for the frontend logs to ensure your browser remains responsive even when streaming high-volume pod logs.

## AI-Powered Diagnostics 🤖

KubeLensy includes an integrated **Kubernetes MCP (Model Context Protocol) Server** that provides intelligent cluster diagnostics through natural language queries.

### Quick Examples:
- "Check cluster health"
- "Show me all failing pods"
- "Troubleshoot pod nginx-abc123"
- "What's wrong with my cluster?"

### Features:
- 🔍 Automatic issue detection across pods, nodes, and namespaces
- 💡 Intelligent recommendations for fixing problems
- 📊 Comprehensive cluster health analysis
- 🚨 Real-time event and log analysis
- 📈 Resource usage monitoring

**[📖 Read the full MCP Integration Guide](./MCP_INTEGRATION.md)** for detailed usage, API reference, and examples.

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
MIT
