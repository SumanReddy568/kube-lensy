const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fixPath = require("fix-path");

// Fix PATH for GUI apps on Mac
fixPath();

const isDev = !app.isPackaged;

let mainWindow;
let serverProcess;

function startServer() {
  if (isDev) {
    console.log("Server should already be running in dev mode");
    return;
  }

  const serverPath = path.join(__dirname, "../dist-server/server.js");
  console.log(`Starting server from: ${serverPath}`);

  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
      USER_DATA_PATH: app.getPath("userData"),
    },
  });

  serverProcess.stdout.on("data", (data) => {
    console.log(`[Backend]: ${data}`);
  });

  serverProcess.stderr.on("data", (data) => {
    console.error(`[Backend Error]: ${data}`);
  });

  serverProcess.on("error", (err) => {
    console.error("[Backend Process Error]:", err);
  });

  serverProcess.on("close", (code) => {
    console.log(`[Backend Process] exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: "hiddenInset", // Makes it look like a modern Mac app
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "../public/k8s.png"), // We'll need an icon later
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    const url = require("url");
    const indexPath = path.join(__dirname, "../dist/index.html");
    mainWindow
      .loadURL(
        url.format({
          pathname: indexPath,
          protocol: "file:",
          slashes: true,
        })
      )
      .catch((err) => {
        console.error("Failed to load index.html:", err);
      });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
  if (serverProcess) serverProcess.kill();
});

app.on("quit", () => {
  if (serverProcess) serverProcess.kill();
});
