"use strict";

/**
 * Maurya Automation Suite — Core Execution Engine (Electron-independent)
 *
 * Pure Node.js workflow runner. Used by both the CLI tool and (optionally)
 * the Electron main process for scheduled/headless runs.
 *
 * Supported node types:
 *   trigger  → manual | schedule | webhook | file-watch | mqtt
 *   action   → http | email | script | file-write | notify | ai | delay
 *             | pdf-generate | pdf-extract | ocr | database | telegram | slack
 *   condition→ evaluates a JS expression against the previous output
 *   transform→ runs a JS transform on the previous output
 *   filter   → keeps array items matching a JS expression
 *   setvar   → assigns a variable from {{data}} or a literal
 *   loop     → repeats the downstream body once per item in an array
 *   custom   → runs a JS script
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const nodemailer = require("nodemailer");

async function resolveSecrets(secretSource) {
  const secrets = {};
  // 1. File
  if (secretSource && secretSource.file) {
    try {
      Object.assign(secrets, JSON.parse(fs.readFileSync(secretSource.file, "utf8")));
    } catch (_) {}
  }
  // 2. Env vars: MAURYA_<KEY>
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("MAURYA_")) {
      secrets[k.slice(7).toLowerCase()] = v;
    }
  }
  return secrets;
}

function buildOrder(nodes, connections) {
  // Simple dependency order: start from trigger nodes, follow connections.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map();
  connections.forEach((c) => {
    if (!outgoing.has(c.from)) outgoing.set(c.from, []);
    outgoing.get(c.from).push(c.to);
  });

  const order = [];
  const visited = new Set();
  const startNodes = nodes.filter((n) => n.type === "trigger");

  function walk(id) {
    if (visited.has(id)) return;
    visited.add(id);
    const node = byId.get(id);
    if (node) order.push(node);
    (outgoing.get(id) || []).forEach(walk);
  }

  if (startNodes.length) {
    startNodes.forEach((n) => walk(n.id));
  }
  // Include any disconnected nodes at the end
  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      visited.add(n.id);
      order.push(n);
    }
  });
  return order;
}

async function handleAction(type, config, ctx, secrets, log) {
  const normalized = {
    "http request": "http",
    "send email": "email",
    "run script": "script",
    "write file": "file-write",
    "ai query": "ai",
    "delay": "delay",
    "notify": "notify",
    "pdf generate": "pdf-generate",
    "pdf extract": "pdf-extract",
    "ocr": "ocr",
    "database": "database",
    "telegram": "telegram",
    "telegram bot": "telegram",
    "slack": "slack",
    "slack message": "slack",
  }[String(type || "").toLowerCase().trim()] || String(type || "").toLowerCase();

  switch (normalized) {
    case "http": {
      const { url, method = "GET", headers = {}, body } = config;
      if (!url) throw new Error("HTTP request requires a URL");
      const opts = {
        method: method.toUpperCase(),
        headers: { "User-Agent": "MauryaAutomation-CLI/1.0", ...headers },
      };
      if (body && opts.method !== "GET" && opts.method !== "HEAD") {
        if (typeof body === "object") {
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
      } catch (_) {}
      return { status: res.status, ok: res.ok, body: json || text };
    }
    case "file-read": {
      return fs.readFileSync(config.path, "utf8");
    }
    case "file-write": {
      fs.mkdirSync(path.dirname(config.path), { recursive: true });
      const content = interpolate(config.content || "", ctx);
      fs.writeFileSync(config.path, content, "utf8");
      return { written: true, path: config.path, bytes: Buffer.byteLength(content) };
    }
    case "script": {
      const lang = config.lang || "javascript";
      if (lang === "javascript" || lang === "node") {
        const sandbox = { console, fetch, setTimeout, Buffer, require, process, data: ctx.lastOutput, vars: ctx.vars };
        vm.createContext(sandbox);
        return vm.runInContext(config.script || "", sandbox, { timeout: 10000 });
      }
      if (lang === "bash" || lang === "shell" || lang === "cmd") {
        const { execSync } = require("child_process");
        const out = execSync(config.script || "", { encoding: "utf8", timeout: 15000 });
        return { output: out };
      }
      throw new Error(`Unsupported script language: ${lang}`);
    }
    case "email": {
      const { to, html, from } = config;
      const subject = interpolate(config.subject || "", ctx);
      const text = interpolate(config.text || "", ctx);
      if (!to || !subject) throw new Error("Email requires to + subject");
      const s = secrets["smtp"] || {};
      if (!s.host || !s.user || !s.pass) {
        log("warn", `No SMTP secret; skipping email to ${to}`);
        return { skipped: true, reason: "no-smtp-secret" };
      }
      const t = nodemailer.createTransport({ host: s.host, port: s.port || 587, secure: s.secure || false, auth: { user: s.user, pass: s.pass } });
      const info = await t.sendMail({ from: from || s.user, to, subject, text, html });
      return { sent: true, messageId: info.messageId };
    }
    case "ai": {
      const provider = config.provider || "openai";
      const key = secrets[`ai_${provider}`] || secrets["ai_key"];
      if (!key) throw new Error(`No API key for ${provider} (set MAURYA_ai_${provider} or secrets file)`);
      let url, headers, body;
      if (provider === "anthropic") {
        url = "https://api.anthropic.com/v1/messages";
        headers = { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" };
        body = { model: config.model || "claude-3-haiku-20240307", max_tokens: config.maxTokens || 1024, system: config.system, messages: [{ role: "user", content: interpolate(config.prompt, ctx) }] };
      } else {
        url = secrets[`ai_${provider}_url`] || "https://api.openai.com/v1/chat/completions";
        headers = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
        body = { model: config.model || "gpt-3.5-turbo", messages: [...(config.system ? [{ role: "system", content: config.system }] : []), { role: "user", content: interpolate(config.prompt, ctx) }], max_tokens: config.maxTokens || 1024 };
      }
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      const data = await res.json();
      const text = provider === "anthropic" ? (data.content || []).map((c) => c.text).join("") : data.choices?.[0]?.message?.content || "";
      return { provider, text };
    }
    case "delay": {
      const ms = parseInt(config.duration || "1000", 10);
      await new Promise((r) => setTimeout(r, ms));
      return { delayed: true, ms };
    }
    case "notify": {
      return { notified: true, title: interpolate(config.title || "", ctx), message: interpolate(config.message || "", ctx) };
    }
    case "pdf-generate": {
      const PDFDocument = require("pdfkit");
      const doc = new PDFDocument();
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      const done = new Promise((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
      });
      const title = config.title || config.pdfTitle || "Maurya Automation Document";
      const content = interpolate(config.content || config.pdfContent || "", ctx);
      const footer = config.footer || config.pdfFooter;
      const outPath = config.path || config.pdfPath;
      doc.fontSize(20).text(title, { underline: true });
      doc.moveDown();
      doc.fontSize(12).text(content);
      if (footer) {
        doc.moveDown(2).fontSize(9).fillColor("#888").text(footer);
      }
      doc.end();
      const buf = await done;
      if (outPath) {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, buf);
        return { generated: true, path: outPath, bytes: buf.length };
      }
      return { generated: true, bytes: buf.length, buffer: buf.toString("base64") };
    }
    case "pdf-extract": {
      const { extractText } = require("unpdf");
      const file = config.path || config.pdfExtractPath;
      if (!file) throw new Error("PDF extract requires a path");
      const dataBuffer = new Uint8Array(fs.readFileSync(file));
      const { text, totalPages } = await extractText(dataBuffer, { mergePages: true });
      const out = { text: Array.isArray(text) ? text.join("\n") : text, pages: totalPages };
      const saveTo = config.saveTo || config.pdfExtractSave;
      if (saveTo) {
        fs.writeFileSync(saveTo, out.text, "utf8");
        out.saved = saveTo;
      }
      return out;
    }
    case "ocr": {
      // OCR via AI vision provider (image -> text)
      const provider = config.provider || config.ocrProvider || secrets["ai_provider"] || "openai";
      const key = secrets[`ai_${provider}`] || secrets["ai_key"];
      if (!key) throw new Error(`OCR needs an AI vision key (set MAURYA_ai_${provider})`);
      const imgPath = config.path || config.ocrPath;
      if (!imgPath) throw new Error("OCR requires an image path");
      const b64 = fs.readFileSync(imgPath).toString("base64");
      const prompt = config.prompt || config.ocrPrompt || "Extract all text from this image.";
      const model = config.model || config.ocrModel;
      let url, headers, body;
      if (provider === "anthropic") {
        url = "https://api.anthropic.com/v1/messages";
        headers = { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" };
        body = { model: model || "claude-3-haiku-20240307", max_tokens: 1024, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: b64 } }, { type: "text", text: prompt }] }] };
      } else {
        url = "https://api.openai.com/v1/chat/completions";
        headers = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
        const mime = imgPath.endsWith(".png") ? "image/png" : "image/jpeg";
        body = { model: model || "gpt-4o-mini", messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }] }], max_tokens: 1024 };
      }
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      const data = await res.json();
      const text = provider === "anthropic" ? (data.content || []).map((c) => c.text).join("") : data.choices?.[0]?.message?.content || "";
      const saveTo = config.saveTo || config.ocrSave;
      if (saveTo) fs.writeFileSync(saveTo, text, "utf8");
      return { text, provider };
    }
    case "database": {
      const dbType = (config.dbType || "sqlite").toLowerCase();
      const query = config.query || config.dbQuery;
      if (dbType === "sqlite") {
        const initSqlJs = require("sql.js");
        const SQL = await initSqlJs();
        const dbFile = config.dbPath;
        if (!dbFile) throw new Error("SQLite requires dbPath");
        const bytes = fs.readFileSync(dbFile);
        const db = new SQL.Database(bytes);
        const result = db.exec(query || "");
        db.close();
        const rows = result.length ? result[0].values.map((row) => Object.fromEntries(row.map((v, i) => [result[0].columns[i], v]))) : [];
        const writeTo = config.writeTo || config.dbWrite;
        if (writeTo) fs.writeFileSync(writeTo, JSON.stringify(rows, null, 2));
        return { rows, count: rows.length };
      }
      // Postgres / MySQL via installed drivers (optional)
      const conn = secrets["db_connection"] || config.connection;
      if (dbType === "postgres" && conn) {
        const { Client } = require("pg");
        const client = new Client({ connectionString: conn });
        await client.connect();
        const r = await client.query(config.query || "");
        await client.end();
        return { rows: r.rows, count: r.rows.length };
      }
      if (dbType === "mysql" && conn) {
        const mysql = require("mysql2/promise");
        const conn2 = await mysql.createConnection(conn);
        const [rows] = await conn2.query(config.query || "");
        await conn2.end();
        return { rows, count: rows.length };
      }
      throw new Error(`Database type '${dbType}' not supported locally. Use sqlite, or set db_connection secret for postgres/mysql (drivers optional).`);
    }
    case "telegram": {
      const token = secrets["telegram_token"] || config.token;
      if (!token) throw new Error("Telegram needs telegram_token secret");
      const chatId = config.chatId || secrets["telegram_chat"];
      if (!chatId) throw new Error("Telegram needs a chat id (config.chatId or telegram_chat secret)");
      const text = interpolate(config.message || config.text || "", ctx);
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: config.parseMode || "Markdown" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(`Telegram error: ${data.description}`);
      return { sent: true, messageId: data.result?.message_id };
    }
    case "slack": {
      const webhook = config.webhook || secrets["slack_webhook"];
      if (!webhook) throw new Error("Slack needs a webhook URL (config.webhook or slack_webhook secret)");
      const text = interpolate(config.message || config.text || "", ctx);
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, username: config.username || "Maurya Automation", blocks: config.blocks ? JSON.parse(config.blocks) : undefined }),
      });
      if (!res.ok) throw new Error(`Slack error: ${res.status}`);
      return { sent: true, status: res.status };
    }
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

function interpolate(str, ctx) {
  if (!str) return str;
  return String(str).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const parts = k.split(".");
    const resolve = (root) => {
      let v = root;
      for (const p of parts.slice(1)) v = v == null ? undefined : v[p];
      if (v === undefined) return "";
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    };
    if (parts[0] === "data") return resolve(ctx.lastOutput);
    if (parts[0] === "vars") return resolve(ctx.vars);
    return "";
  });
}

/**
 * Execute a workflow.
 * @param {object} workflow - { name, nodes: [], connections: [] }
 * @param {object} options - { secrets, onLog, onNode }
 * @returns {Promise<{status, results, durationMs}>}
 */
async function executeWorkflow(workflow, options = {}) {
  const nodes = workflow.nodes || [];
  const connections = workflow.connections || [];
  const secrets = options.secrets || {};
  const log = options.onLog || (() => {});
  const onNode = options.onNode || (() => {});

  const order = buildOrder(nodes, connections);
  const ctx = { vars: {}, lastOutput: null };
  const results = {};
  const start = Date.now();

  log("info", `Workflow "${workflow.name || "untitled"}": ${order.length} nodes`);

  const env = { ctx, results, start, secrets, log, onNode, options };
  const triggerNode = order.find((n) => n.type === "trigger");
  const triggerType = String(triggerNode?.config?.triggerType || "").toLowerCase();

  // Watcher / server modes keep the process alive
  if (triggerType === "mqtt") return runMqttWatch(workflow, triggerNode, order, env);
  if (triggerType === "webhook") return runWebhook(workflow, triggerNode, order, env);
  if (triggerType === "file-watch" || triggerType === "filewatch") return runFileWatch(workflow, triggerNode, order, env);

  // Iteration mode: a "loop" node repeats the downstream body per item
  const loopNode = order.find((n) => n.type === "loop");
  if (loopNode) return runLoop(workflow, loopNode, order, env);

  const result = await runBody(order, env);
  log("info", `Workflow complete in ${Date.now() - start}ms`);
  return result;
}

async function runOneNode(node, ctx, env) {
  const { secrets, log, onNode, results } = env;
  const cfg = node.config || {};
  onNode(node.id, "running");
  log("info", `▶ ${node.name} (${node.type})`);
  const retries = parseInt(cfg.retries || "0", 10);
  const retryDelay = parseInt(cfg.retryDelay || "1000", 10);

  let output;
  let ok = false;
  const run = async () => {
    switch (node.type) {
      case "trigger": {
        const t = cfg.triggerType || "Manual";
        if (t === "Schedule") return { triggered: true, type: "schedule" };
        if (t === "Webhook") return { triggered: true, type: "webhook" };
        if (t === "File Watch" || t === "FileWatch") return { triggered: true, type: "file-watch", path: cfg.path };
        return { triggered: true, type: "manual" };
      }
      case "action":
        return handleAction(cfg.actionType || "HTTP Request", cfg, ctx, secrets, log);
      case "condition": {
        const expr = cfg.condition || "true";
        const pass = !!new Function("data", "vars", `return (${expr});`)(ctx.lastOutput, ctx.vars);
        node.branch = pass ? "true" : "false";
        log("info", `  condition "${expr}" → ${pass ? "PASS" : "FAIL"}`);
        return { passed: pass, expression: expr };
      }
      case "transform": {
        const fn = new Function("data", "vars", cfg.transform || "return data;");
        return fn(ctx.lastOutput, ctx.vars);
      }
      case "filter": {
        const arr = Array.isArray(ctx.lastOutput) ? ctx.lastOutput : JSON.parse(JSON.stringify(ctx.lastOutput || []));
        const expr = cfg.expression || "true";
        const filtered = arr.filter((item, i) => !!new Function("item", "index", "vars", `return (${expr});`)(item, i, ctx.vars));
        return filtered;
      }
      case "setvar": {
        const name = cfg.name || "value";
        const value = cfg.value !== undefined && cfg.value !== "" ? interpolate(String(cfg.value), ctx) : ctx.lastOutput;
        ctx.vars[name] = value;
        return { set: name, value };
      }
      case "custom":
        return handleAction("script", { script: cfg.script, lang: "javascript" }, ctx, secrets, log);
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  };

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      output = await run();
      ok = true;
      break;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        log("warn", `  retry ${attempt + 1}/${retries} in ${retryDelay}ms (${e.message})`);
        await new Promise((r) => setTimeout(r, retryDelay));
      }
    }
  }
  if (!ok) throw lastErr;

  node.output = output;
  node.status = "success";
  results[node.id] = output;
  ctx.lastOutput = output;
  onNode(node.id, "success");
  log("success", `  ✓ ${node.name}: ${summarize(output)}`);
  return output;
}

async function runBody(nodes, env) {
  const { ctx, results, start, log } = env;
  for (const node of nodes) {
    try {
      await runOneNode(node, ctx, env);
    } catch (err) {
      node.status = "failed";
      node.error = err.message;
      env.onNode(node.id, "failed");
      log("error", `  ✗ ${node.name}: ${err.message}`);
      return { status: "failed", results, durationMs: Date.now() - start };
    }
  }
  return { status: "success", results, durationMs: Date.now() - start };
}

async function runMqttWatch(workflow, triggerNode, order, env) {
  const { ctx, results, start, secrets, log, onNode } = env;
  const mqtt = require("mqtt");
  const broker = triggerNode.config.broker || secrets["mqtt_broker"] || "mqtt://broker.emqx.io:1883";
  const topic = triggerNode.config.topic || "#";
  const client = mqtt.connect(broker, {
    username: secrets["mqtt_user"] || triggerNode.config.username,
    password: secrets["mqtt_pass"] || triggerNode.config.password,
    clientId: `maurya_${Date.now()}`,
  });

  const bodyNodes = order.filter((n) => n.id !== triggerNode.id);

  const control = {
    status: "watching",
    stop: () => client.end(true),
  };

  client.on("connect", () => {
    log("info", `MQTT connected → ${broker}, subscribed to "${topic}"`);
    client.subscribe(topic);
  });
  client.on("error", (e) => log("error", `MQTT error: ${e.message}`));

  client.on("message", async (t, payload) => {
    const msg = payload.toString();
    log("info", `▣ MQTT message on "${t}"`);
    ctx.lastOutput = { topic: t, message: msg, timestamp: new Date().toISOString() };
    if (triggerNode.config.variable) ctx.vars[triggerNode.config.variable] = msg;
    const runStart = Date.now();
    try {
      for (const node of bodyNodes) {
        const cfg = node.config || {};
        const retries = parseInt(cfg.retries || "0", 10);
        const retryDelay = parseInt(cfg.retryDelay || "1000", 10);
        onNode(node.id, "running");
        let output, ok = false, lastErr;
        const run = async () => {
          switch (node.type) {
            case "action":
              return handleAction(cfg.actionType || "HTTP Request", cfg, ctx, secrets, log);
            case "condition": {
              const pass = !!new Function("data", "vars", `return (${cfg.condition || "true"});`)(ctx.lastOutput, ctx.vars);
              node.branch = pass ? "true" : "false";
              return { passed: pass };
            }
            case "transform":
              return new Function("data", "vars", cfg.transform || "return data;")(ctx.lastOutput, ctx.vars);
            case "custom":
              return handleAction("script", { script: cfg.script, lang: "javascript" }, ctx, secrets, log);
            default:
              return null;
          }
        };
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            output = await run();
            ok = true;
            break;
          } catch (e) {
            lastErr = e;
            if (attempt < retries) await new Promise((r) => setTimeout(r, retryDelay));
          }
        }
        if (!ok) {
          onNode(node.id, "failed");
          log("error", `  ✗ ${node.name}: ${lastErr.message}`);
          return;
        }
        results[node.id] = output;
        ctx.lastOutput = output;
        onNode(node.id, "success");
        log("success", `  ✓ ${node.name} (${(Date.now() - runStart)}ms)`);
      }
      log("success", `MQTT cycle done (${(Date.now() - runStart)}ms)`);
    } catch (e) {
      log("error", `MQTT cycle error: ${e.message}`);
    }
  });

  return control;
}

async function runWebhook(workflow, triggerNode, order, env) {
  const { ctx, results, start, secrets, log, onNode } = env;
  const http = require("http");
  const port = parseInt(triggerNode.config.webhookPort || triggerNode.config.port || "3030", 10);
  const route = (triggerNode.config.webhookPath || triggerNode.config.path || "/webhook").split("?")[0];
  const method = (triggerNode.config.webhookMethod || triggerNode.config.method || "POST").toUpperCase();
  const bodyNodes = order.filter((n) => n.id !== triggerNode.id);

  const control = { status: "watching", stop: () => server.close() };
  const server = http.createServer((req, res) => {
    if (req.method.toUpperCase() !== method || !req.url.startsWith(route)) {
      res.writeHead(404).end("not found");
      return;
    }
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      let body = raw;
      try { body = JSON.parse(raw); } catch (_) {}
      const url = new URL(req.url, `http://localhost:${port}`);
      ctx.lastOutput = { method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), headers: req.headers, body };
      if (triggerNode.config.variable) ctx.vars[triggerNode.config.variable] = body;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ received: true }));
      log("info", `▣ Webhook ${req.method} ${url.pathname}`);
      const r = await runBody(bodyNodes, env);
      log("success", `Webhook cycle: ${r.status} (${(Date.now() - start)}ms)`);
    });
  });
  server.listen(port, () => log("info", `Webhook server listening on http://localhost:${port}${route} (${method})`));
  return control;
}

function runFileWatch(workflow, triggerNode, order, env) {
  const { ctx, log, onNode } = env;
  const dir = triggerNode.config.path || ".";
  const bodyNodes = order.filter((n) => n.id !== triggerNode.id);
  const watcher = fs.watch(dir, { recursive: true }, async (eventType, filename) => {
    if (!filename) return;
    log("info", `▣ File event "${eventType}" → ${filename}`);
    ctx.lastOutput = { event: eventType, filename, path: path.join(dir, filename), timestamp: new Date().toISOString() };
    if (triggerNode.config.variable) ctx.vars[triggerNode.config.variable] = filename;
    const r = await runBody(bodyNodes, env);
    log("success", `File-watch cycle: ${r.status}`);
  });
  log("info", `Watching "${dir}" for file changes`);
  return { status: "watching", stop: () => watcher.close() };
}

async function runLoop(workflow, loopNode, order, env) {
  const { ctx, log, start } = env;
  const source = loopNode.config.items;
  let items = [];
  try {
    items = JSON.parse(source);
  } catch (_) {
    items = new Function("data", "vars", `return (${source || "[]"});`)(ctx.lastOutput, ctx.vars);
  }
  if (!Array.isArray(items)) items = [items];
  const varName = loopNode.config.variable || "item";
  const bodyNodes = order.filter((n) => n.id !== loopNode.id && n.type !== "trigger");
  log("info", `Loop over ${items.length} item(s) → var "${varName}"`);
  let i = 0;
  for (const item of items) {
    ctx.vars[varName] = item;
    ctx.lastOutput = item;
    log("info", `— iteration ${i + 1}/${items.length}`);
    const r = await runBody(bodyNodes, env);
    if (r.status === "failed") {
      log("error", `Loop aborted at iteration ${i + 1}`);
      return { status: "failed", results: env.results, durationMs: Date.now() - start };
    }
    i++;
  }
  log("info", `Loop complete (${items.length} iterations)`);
  return { status: "success", results: env.results, durationMs: Date.now() - start };
}

function summarize(out) {
  if (out == null) return "null";
  if (typeof out === "string") return out.slice(0, 80);
  if (typeof out === "object") {
    if (out.status) return `HTTP ${out.status}`;
    if (out.sent) return "email sent";
    if (out.written) return `file ${out.path}`;
    if (out.text) return out.text.slice(0, 80);
    return JSON.stringify(out).slice(0, 80);
  }
  return String(out);
}

module.exports = { executeWorkflow, buildOrder, resolveSecrets };
