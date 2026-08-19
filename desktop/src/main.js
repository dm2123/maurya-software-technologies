const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const { exec } = require("child_process");
const util = require("util");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

const execAsync = util.promisify(exec);

if (require("electron-squirrel-startup")) {
  app.quit();
}

const APP_VERSION = app.getVersion();
const USER_DATA = app.getPath("userData");
const SECRETS_PATH = path.join(USER_DATA, "secrets.json");
const SCHEDULES_PATH = path.join(USER_DATA, "schedules.json");

let secrets = {};
try {
  secrets = JSON.parse(fs.readFileSync(SECRETS_PATH, "utf8"));
} catch (_) {
  secrets = {};
}

let schedules = [];
try {
  schedules = JSON.parse(fs.readFileSync(SCHEDULES_PATH, "utf8"));
} catch (_) {
  schedules = [];
}

let tray = null;
let mainWindow = null;

function saveSecrets() {
  fs.writeFile(SECRETS_PATH, JSON.stringify(secrets, null, 2)).catch(() => {});
}

function saveSchedules() {
  fs.writeFile(SCHEDULES_PATH, JSON.stringify(schedules, null, 2)).catch(() => {});
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
    const context = { console, fetch, setTimeout, Buffer, require, process };
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

async function handleAi(event, config) {
  const { provider = "openai", prompt, model, system, maxTokens = 1024, temperature = 0.7 } = config;
  if (!prompt) throw new Error("AI query requires a prompt");

  const key = secrets[`ai_${provider}`] || secrets["ai_key"];
  if (!key) {
    throw new Error(`No API key for ${provider}. Set secret 'ai_${provider}' in Settings → Secrets.`);
  }

  let url, body, headers;
  if (provider === "openai" || provider === "openrouter" || provider === "compatible") {
    url = secrets[`ai_${provider}_url`] || "https://api.openai.com/v1/chat/completions";
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
    body = {
      model: model || "gpt-3.5-turbo",
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
      temperature,
    };
  } else if (provider === "anthropic" || provider === "claude") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    };
    body = {
      model: model || "claude-3-haiku-20240307",
      max_tokens: maxTokens,
      system: system || undefined,
      messages: [{ role: "user", content: prompt }],
    };
  } else {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json();

  let text;
  if (provider === "anthropic" || provider === "claude") {
    text = (data.content || []).map((c) => c.text).join("");
  } else {
    text = data.choices?.[0]?.message?.content || "";
  }
  return { provider, model: body.model, text, usage: data.usage || null };
}

async function handleSecretGet(event, key) {
  return secrets[key] || null;
}

async function handleSecretSet(event, key, value) {
  secrets[key] = value;
  saveSecrets();
  return true;
}

async function handleSchedulerList() {
  return schedules.map((s) => ({ ...s, nextRun: getNextCron(s.cron) }));
}

async function handleSchedulerAdd(event, schedule) {
  const id = `sched_${Date.now()}`;
  const entry = {
    id,
    name: schedule.name || "Untitled Schedule",
    cron: schedule.cron || "0 * * * *",
    workflow: schedule.workflow || null,
    enabled: schedule.enabled !== false,
    lastRun: null,
    createdAt: new Date().toISOString(),
  };
  schedules.push(entry);
  saveSchedules();
  registerCron(entry);
  updateTrayMenu();
  return entry;
}

async function handleSchedulerRemove(event, id) {
  schedules = schedules.filter((s) => s.id !== id);
  saveSchedules();
  if (cronTasks[id]) {
    cronTasks[id].stop();
    delete cronTasks[id];
  }
  updateTrayMenu();
  return true;
}

async function handleSchedulerRunNow(event, id) {
  const s = schedules.find((x) => x.id === id);
  if (!s) throw new Error("Schedule not found");
  return executeScheduledWorkflow(s);
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
    case "ai":
      return handleAi(event, config);
    case "delay":
      await new Promise((r) => setTimeout(r, parseInt(config.duration || 1000, 10)));
      return { delayed: true, ms: parseInt(config.duration || 1000, 10) };
    case "notify": {
      const win = BrowserWindow.fromWebContents(event.sender);
      return { notified: true, title: config.title, message: config.message };
    }
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

// ── Scheduler ────────────────────────────────────────────────
const cronTasks = {};

function getNextCron(expr) {
  try {
    if (typeof cron.sendAt === "function") {
      return cron.sendAt(expr).toISOString();
    }
    return cron.validate(expr) ? "scheduled" : null;
  } catch {
    return null;
  }
}

async function executeScheduledWorkflow(schedule) {
  const result = {
    scheduleId: schedule.id,
    name: schedule.name,
    startedAt: new Date().toISOString(),
    status: "running",
  };
  schedule.lastRun = result.startedAt;
  saveSchedules();
  updateTrayMenu();

  // Notify the renderer if open
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("schedule:triggered", result);
  }

  try {
    // Run a stored workflow JSON if present
    if (schedule.workflow && schedule.workflow.nodes) {
      // The renderer owns the workflow graph; we emit to it for execution.
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("schedule:execute", schedule.workflow);
      }
    }
    result.status = "dispatched";
  } catch (e) {
    result.status = "failed";
    result.error = e.message;
  }
  return result;
}

function registerCron(schedule) {
  if (cronTasks[schedule.id]) {
    cronTasks[schedule.id].stop();
  }
  if (!schedule.enabled) return;
  try {
    cronTasks[schedule.id] = cron.schedule(schedule.cron, () => {
      executeScheduledWorkflow(schedule);
    });
  } catch (e) {
    console.error("Invalid cron:", schedule.cron, e.message);
  }
}

function registerAllCrons() {
  schedules.forEach(registerCron);
}

// ── Tray ─────────────────────────────────────────────────────
function buildTrayIcon() {
  // Minimal 16x16 cyan square as fallback
  const size = 16;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVR4nO3OMQEAAAgDoSf5b3cCq4wQZkZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZ+T3Y0gAAS8H0B6p0AAAAAElFTkSuQmCC",
    "base64"
  );
  try {
    return nativeImage.createFromBuffer(png);
  } catch {
    return nativeImage.createEmpty();
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const items = [
    { label: "Open Maurya Automation", click: () => mainWindow && mainWindow.show() },
    { type: "separator" },
    {
      label: `Schedules (${schedules.length})`,
      enabled: false,
    },
    ...schedules.slice(0, 8).map((s) => ({
      label: `${s.enabled ? "●" : "○"} ${s.name}`,
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send("schedule:open", s.id);
        }
      },
    })),
    { type: "separator" },
    {
      label: "Run All Enabled",
      click: () => schedules.filter((s) => s.enabled).forEach((s) => executeScheduledWorkflow(s)),
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function createTray() {
  try {
    tray = new Tray(buildTrayIcon());
    tray.setToolTip("Maurya Automation Suite");
    tray.on("click", () => mainWindow && mainWindow.show());
    updateTrayMenu();
  } catch (e) {
    console.error("Tray init failed:", e.message);
  }
}

// ── Window ───────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
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

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const current = mainWindow.webContents.getURL();
    if (url !== current) {
      event.preventDefault();
      if (url.startsWith("https:") || url.startsWith("http:")) {
        shell.openExternal(url);
      }
    }
  });

  mainWindow.on("close", (event) => {
    // Keep running in tray on close (minimize to tray)
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
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
ipcMain.handle("ai:query", handleAi);
ipcMain.handle("secret:get", handleSecretGet);
ipcMain.handle("secret:set", handleSecretSet);
ipcMain.handle("scheduler:list", handleSchedulerList);
ipcMain.handle("scheduler:add", handleSchedulerAdd);
ipcMain.handle("scheduler:remove", handleSchedulerRemove);
ipcMain.handle("scheduler:runNow", handleSchedulerRunNow);
ipcMain.handle("action:execute", handleAction);

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerAllCrons();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // On non-mac, keep running in tray; user quits from tray
  if (process.platform !== "darwin") {
    // do nothing — tray keeps app alive
  } else {
    app.quit();
  }
});

app.on("before-quit", () => {
  app.isQuiting = true;
});
