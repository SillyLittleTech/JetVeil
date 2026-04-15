import { app, BrowserWindow, shell, dialog, Menu } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let mainWindow = null;
let serverHandle = null;
let isQuitting = false;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function shutdownLocalServer() {
  if (!serverHandle) return;

  const handle = serverHandle;
  serverHandle = null;

  try {
    await handle.close();
  } catch {
    // Ignore close errors during shutdown; the goal is to release the port.
  }
}

async function getServerApi() {
  const serverEntry = app.isPackaged
    ? path.join(process.resourcesPath, "server", "src", "index.js")
    : path.join(__dirname, "..", "server", "src", "index.js");

  return import(pathToFileURL(serverEntry).href);
}

async function bootLocalServer() {
  const { startJetVeilServer } = await getServerApi();
  serverHandle = await startJetVeilServer({
    port: 54312,
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
  // Create application menu with quit handler
  const template = [
    {
      label: "JetVeil",
      submenu: [
        {
          label: "Quit JetVeil",
          accelerator: "CmdOrCtrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

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
  shutdownLocalServer().finally(() => {
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (!isQuitting) {
    isQuitting = true;
    shutdownLocalServer().finally(() => {
      app.quit();
    });
  }
});
