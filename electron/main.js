const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fixPath = require("fix-path");

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
  const userDataPath = app.getPath("userData");
  const logPath = path.join(userDataPath, "backend.log");
  const fs = require("fs");
  const logStream = fs.createWriteStream(logPath, { flags: "w" });

  console.log(`Starting server from: ${serverPath}`);
  console.log(`Logging to: ${logPath}`);

  logStream.write(`\n--- Session Started: ${new Date().toISOString()} ---\n`);

  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
      USER_DATA_PATH: userDataPath,
    },
  });

  serverProcess.stdout.on("data", (data) => {
    process.stdout.write(`[Backend STDOUT] ${data}`);
  });

  serverProcess.stderr.on("data", (data) => {
    process.stderr.write(`[Backend STDERR] ${data}`);
  });

  serverProcess.on("error", (err) => {
    const msg = `[Backend Process Error]: ${err.message}\n`;
    console.error(msg);
    logStream.write(msg);
  });

  serverProcess.on("close", (code) => {
    const msg = `[Backend Process] exited with code ${code}\n`;
    console.log(msg);
    logStream.write(msg);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "../public/k8s.png"),
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
