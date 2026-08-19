#!/usr/bin/env node
"use strict";

/**
 * Maurya Automation Suite — CLI
 *
 * Usage:
 *   maurya run <workflow.json> [--secrets file.json] [--var key=value]...
 *   maurya validate <workflow.json>
 *   maurya list
 */

const fs = require("fs");
const path = require("path");
const { executeWorkflow, resolveSecrets } = require("../core/engine");

function help() {
  console.log(`
Maurya Automation Suite CLI
===========================

Commands:
  run <workflow.json>      Execute a workflow file
  validate <workflow.json> Validate workflow JSON structure
  list                     List available local workflows (./*.maurya.json)

Options (run):
  --secrets <file>         JSON file with API keys / SMTP config
  --var KEY=VALUE          Set a variable (repeatable)
  --json                   Print final results as JSON
  --quiet                  Only print errors

Secrets can also come from environment variables: MAURYA_ai_openai=sk-... etc.
`);
}

function loadWorkflow(file) {
  const raw = fs.readFileSync(file, "utf8");
  const wf = JSON.parse(raw);
  if (!wf.nodes || !Array.isArray(wf.nodes)) {
    throw new Error("Workflow must have a 'nodes' array");
  }
  return wf;
}

async function cmdRun(file, argv) {
  const wf = loadWorkflow(file);
  const secrets = await resolveSecrets({
    file: argv.secrets,
  });
  const vars = {};
  (argv.var || []).forEach((v) => {
    const [k, ...rest] = v.split("=");
    vars[k] = rest.join("=");
  });

  const useJson = argv.json;
  const quiet = argv.quiet;

  const onLog = (level, msg) => {
    if (quiet && level !== "error") return;
    const tag = { info: "•", success: "✓", error: "✗", warn: "!" }[level] || "•";
    if (!useJson) console.log(`${tag} ${msg}`);
  };

  const result = await executeWorkflow(wf, {
    secrets,
    onLog,
    onNode: (id, status) => {
      if (useJson) return;
    },
  });

  if (useJson) {
    console.log(JSON.stringify({ status: result.status, durationMs: result.durationMs, results: result.results }, null, 2));
  } else {
    console.log(`\nResult: ${result.status} (${result.durationMs}ms)`);
  }
  process.exit(result.status === "success" ? 0 : 1);
}

function cmdValidate(file) {
  try {
    const wf = loadWorkflow(file);
    const triggers = wf.nodes.filter((n) => n.type === "trigger").length;
    const actions = wf.nodes.filter((n) => n.type === "action").length;
    console.log(`✓ Valid workflow: "${wf.name || "untitled"}"`);
    console.log(`  nodes: ${wf.nodes.length}, connections: ${wf.connections?.length || 0}`);
    console.log(`  triggers: ${triggers}, actions: ${actions}`);
  } catch (e) {
    console.error(`✗ Invalid: ${e.message}`);
    process.exit(1);
  }
}

function cmdList() {
  const files = fs.readdirSync(process.cwd()).filter((f) => f.endsWith(".maurya.json") || f.endsWith(".workflow.json"));
  if (!files.length) {
    console.log("No local workflow files (*.maurya.json) found in current directory.");
    return;
  }
  files.forEach((f) => console.log(`  ${f}`));
}

function parseArgs(args) {
  const out = { _: [], var: [], secrets: null, json: false, quiet: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--secrets") out.secrets = args[++i];
    else if (a === "--var") out.var.push(args[++i]);
    else if (a === "--json") out.json = true;
    else if (a === "--quiet") out.quiet = true;
    else out._.push(a);
  }
  return out;
}

async function main() {
  const [cmd, file, ...rest] = process.argv.slice(2);
  const argv = parseArgs(rest);

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    help();
    process.exit(0);
  }
  if (cmd === "list") {
    cmdList();
    process.exit(0);
  }
  if (!file) {
    console.error("Missing workflow file.\n");
    help();
    process.exit(1);
  }
  try {
    if (cmd === "run") await cmdRun(file, argv);
    else if (cmd === "validate") cmdValidate(file);
    else {
      console.error(`Unknown command: ${cmd}\n`);
      help();
      process.exit(1);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

main();
