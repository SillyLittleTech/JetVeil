import { app, BrowserWindow, shell, dialog, Menu } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let mainWindow = null;
let splashWindow = null;
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

function createSplashWindow() {
  const version = app.getVersion();
  splashWindow = new BrowserWindow({
    width: 460,
    height: 280,
    resizable: false,
    minimizable: false,
    maximizable: false,
    movable: false,
    frame: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: "#0D0D17",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const splashHtml = `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>JetVeil ${version}</title>
        <style>
          :root {
            color-scheme: dark;
            --bg: #0d0d17;
            --panel: rgba(20, 20, 32, 0.92);
            --accent: #00e5ff;
            --text: #e8e8f0;
            --muted: #9090a8;
          }
          * { box-sizing: border-box; }
          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            background: transparent;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          body {
            display: grid;
            place-items: center;
            padding: 18px;
          }
          .card {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            border-radius: 28px;
            background: linear-gradient(180deg, rgba(21, 21, 34, 0.98), rgba(13, 13, 23, 0.98));
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
            color: var(--text);
          }
          .logo {
            width: 68px;
            height: 68px;
            border-radius: 22px;
            display: grid;
            place-items: center;
            background: rgba(0, 229, 255, 0.12);
            box-shadow: 0 0 0 1px rgba(0, 229, 255, 0.14) inset;
          }
          .logo svg { width: 34px; height: 34px; }
          h1 {
            margin: 0;
            font-size: 1.8rem;
            letter-spacing: -0.04em;
          }
          .version {
            display: inline-flex;
            align-items: center;
            padding: 6px 12px;
            border-radius: 999px;
            background: rgba(0, 229, 255, 0.12);
            color: var(--accent);
            font-size: 0.85rem;
            font-weight: 700;
          }
          .note {
            margin: 0;
            color: var(--muted);
            font-size: 0.9rem;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L4 6V12C4 16.418 7.582 20.472 12 22C16.418 20.472 20 16.418 20 12V6L12 2Z" fill="#00E5FF"/>
            </svg>
          </div>
          <h1>JetVeil</h1>
          <div class="version">v${version}</div>
          <p class="note">Loading secure browsing environment…</p>
        </div>
      </body>
    </html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  splashWindow.once("ready-to-show", () => splashWindow?.show());
  splashWindow.on("closed", () => {
    splashWindow = null;
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
    show: false,
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

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    splashWindow?.close();
  });

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
    createSplashWindow();
    await bootLocalServer();
    createMainWindow();
  } catch (err) {
    splashWindow?.close();
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
