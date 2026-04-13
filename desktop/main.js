import { app, BrowserWindow, shell, dialog } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let mainWindow = null;
let serverHandle = null;
let isQuitting = false;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getServerApi() {
  const serverEntry = app.isPackaged
    ? path.join(process.resourcesPath, "server", "src", "index.js")
    : path.join(__dirname, "..", "server", "src", "index.js");

  return import(pathToFileURL(serverEntry).href);
}

async function bootLocalServer() {
  const { startJetVeilServer } = await getServerApi();
  serverHandle = await startJetVeilServer({
    port: 0,
    host: "127.0.0.1",
  });
}

function createMainWindow() {
  if (!serverHandle) {
    throw new Error("Server is not started.");
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    title: "JetVeil",
    backgroundColor: "#0D0D17",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(serverHandle.url);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await bootLocalServer();
    createMainWindow();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox("JetVeil startup failed", message);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", (event) => {
  if (isQuitting || !serverHandle) {
    return;
  }

  event.preventDefault();
  isQuitting = true;
  serverHandle
    .close()
    .catch(() => {
      // Ignore close errors during app shutdown.
    })
    .finally(() => {
      app.quit();
    });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
