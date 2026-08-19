"use strict";

/**
 * Maurya Automation Suite — Core Execution Engine (Electron-independent)
 *
 * Pure Node.js workflow runner. Used by both the CLI tool and (optionally)
 * the Electron main process for scheduled/headless runs.
 *
 * Supported node types:
 *   trigger  → emits a context object
 *   action   → http | email | script | file-write | notify | ai | delay
 *   condition→ evaluates a JS expression against the previous output
 *   transform→ runs a JS transform on the previous output
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
      const { to, subject, text, html, from } = config;
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
      return { notified: true, title: config.title, message: config.message };
    }
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

function interpolate(str, ctx) {
  if (!str) return str;
  return String(str).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    if (k === "data") return JSON.stringify(ctx.lastOutput);
    if (ctx.vars && k in ctx.vars) return ctx.vars[k];
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

  for (const node of order) {
    const cfg = node.config || {};
    const retries = parseInt(cfg.retries || "0", 10);
    const retryDelay = parseInt(cfg.retryDelay || "1000", 10);

    onNode(node.id, "running");
    log("info", `▶ ${node.name} (${node.type})`);

    let output;
    let ok = false;
    try {
      const run = async () => {
        switch (node.type) {
          case "trigger": {
            const t = cfg.triggerType || "Manual";
            if (t === "Schedule") return { triggered: true, type: "schedule" };
            if (t === "Webhook") return { triggered: true, type: "webhook" };
            if (t === "File Watch") return { triggered: true, type: "file-watch", path: cfg.path };
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
    } catch (err) {
      node.status = "failed";
      node.error = err.message;
      onNode(node.id, "failed");
      log("error", `  ✗ ${node.name}: ${err.message}`);
      return { status: "failed", results, durationMs: Date.now() - start };
    }
  }

  log("info", `Workflow complete in ${Date.now() - start}ms`);
  return { status: "success", results, durationMs: Date.now() - start };
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
