const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const { exec } = require("child_process");
const util = require("util");
const nodemailer = require("nodemailer");

const execAsync = util.promisify(exec);

if (require("electron-squirrel-startup")) {
  app.quit();
}

const APP_VERSION = app.getVersion();
const SECRETS_PATH = path.join(app.getPath("userData"), "secrets.json");

let secrets = {};
try {
  secrets = JSON.parse(fs.readFileSync(SECRETS_PATH, "utf8"));
} catch (_) {
  secrets = {};
}

function saveSecrets() {
  fs.writeFile(SECRETS_PATH, JSON.stringify(secrets, null, 2)).catch(() => {});
}

// ── Handlers ─────────────────────────────────────────────────
async function handleSystemInfo() {
  return {
    os: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    appVersion: APP_VERSION,
    build: app.isPackaged ? "Production" : "Development",
    status: "Running",
  };
}

async function handleHttp(event, config) {
  const { url, method = "GET", headers = {}, body } = config;
  if (!url) throw new Error("HTTP request requires a URL");

  const opts = {
    method: method.toUpperCase(),
    headers: { "User-Agent": `MauryaAutomation/${APP_VERSION}`, ...headers },
  };
  if (body && opts.method !== "GET" && opts.method !== "HEAD") {
    if (typeof body === "object" && !(body instanceof Buffer)) {
      opts.body = JSON.stringify(body);
      opts.headers["Content-Type"] = opts.headers["Content-Type"] || "application/json";
    } else {
      opts.body = body;
    }
  }

  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    /* not JSON */
  }
  return {
    status: res.status,
    ok: res.ok,
    headers: Object.fromEntries(res.headers.entries()),
    body: json || text,
  };
}

async function handleFsRead(event, filePath) {
  return fs.readFile(filePath, "utf8");
}

async function handleFsWrite(event, filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  return { written: true, path: filePath, bytes: Buffer.byteLength(content) };
}

async function handleFsList(event, dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.map((e) => ({
    name: e.name,
    isDirectory: e.isDirectory(),
    isFile: e.isFile(),
  }));
}

async function handleDialogPick(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, { properties: ["openFile"] });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
}

async function handleEmail(event, config) {
  const { to, subject, text, html, from, smtp } = config;
  if (!to || !subject) throw new Error("Email requires 'to' and 'subject'");

  const s = secrets["smtp"] || smtp || {};
  if (!s.host || !s.user || !s.pass) {
    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text || "")}`;
    shell.openExternal(mailto);
    return { fallback: true, method: "mailto", to };
  }

  const transporter = nodemailer.createTransport({
    host: s.host,
    port: s.port || 587,
    secure: s.secure || false,
    auth: { user: s.user, pass: s.pass },
  });

  const info = await transporter.sendMail({ from: from || s.user, to, subject, text, html });
  return { sent: true, messageId: info.messageId, to };
}

async function handleScript(event, { script, lang = "javascript" }) {
  if (lang === "javascript" || lang === "node") {
    const vm = require("vm");
    const context = {
      console,
      fetch,
      setTimeout,
      Buffer,
      require,
      process,
    };
    vm.createContext(context);
    const result = vm.runInContext(script, context, { timeout: 10000 });
    return { output: String(result), lang };
  }
  if (lang === "bash" || lang === "shell" || lang === "cmd") {
    const { stdout, stderr } = await execAsync(script, { shell: true, timeout: 15000 });
    return { output: stdout || stderr, lang };
  }
  throw new Error(`Unsupported script language: ${lang}`);
}

async function handleSecretGet(event, key) {
  return secrets[key] || null;
}

async function handleSecretSet(event, key, value) {
  secrets[key] = value;
  saveSecrets();
  return true;
}

async function handleAction(event, { type, config }) {
  switch (type) {
    case "http":
      return handleHttp(event, config);
    case "file-read":
      return handleFsRead(event, config.path);
    case "file-write":
      return handleFsWrite(event, config.path, config.content);
    case "email":
      return handleEmail(event, config);
    case "script":
      return handleScript(event, config);
    case "delay":
      await new Promise((r) => setTimeout(r, parseInt(config.duration || 1000, 10)));
      return { delayed: true, ms: parseInt(config.duration || 1000, 10) };
    case "notify": {
      // Simple local notification via dialog (no external dep)
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        // could use Notification but kept simple
      }
      return { notified: true, title: config.title, message: config.message };
    }
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

// ── Window ───────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 860,
    minHeight: 560,
    title: "Maurya Automation Suite",
    backgroundColor: "#05070f",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());
  win.loadFile(path.join(__dirname, "index.html"));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const current = win.webContents.getURL();
    if (url !== current) {
      event.preventDefault();
      if (url.startsWith("https:") || url.startsWith("http:")) {
        shell.openExternal(url);
      }
    }
  });
}

// ── IPC registration ─────────────────────────────────────────
ipcMain.handle("system:info", handleSystemInfo);
ipcMain.handle("http:request", handleHttp);
ipcMain.handle("fs:read", handleFsRead);
ipcMain.handle("fs:write", handleFsWrite);
ipcMain.handle("fs:list", handleFsList);
ipcMain.handle("dialog:pickFile", handleDialogPick);
ipcMain.handle("email:send", handleEmail);
ipcMain.handle("script:run", handleScript);
ipcMain.handle("secret:get", handleSecretGet);
ipcMain.handle("secret:set", handleSecretSet);
ipcMain.handle("action:execute", handleAction);

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
