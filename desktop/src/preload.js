const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("maurya", {
  getSystemInfo: () => ipcRenderer.invoke("system:info"),

  // Generic action executor
  executeAction: (type, config) => ipcRenderer.invoke("action:execute", { type, config }),

  // HTTP
  httpRequest: (config) => ipcRenderer.invoke("http:request", config),

  // Filesystem
  readFile: (filePath) => ipcRenderer.invoke("fs:read", filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke("fs:write", filePath, content),
  listDirectory: (dirPath) => ipcRenderer.invoke("fs:list", dirPath),
  pickFile: () => ipcRenderer.invoke("dialog:pickFile"),

  // Email
  sendEmail: (config) => ipcRenderer.invoke("email:send", config),

  // Script execution
  runScript: (script, lang) => ipcRenderer.invoke("script:run", { script, lang }),

  // AI / LLM
  aiQuery: (config) => ipcRenderer.invoke("ai:query", config),

  // Secrets vault
  getSecret: (key) => ipcRenderer.invoke("secret:get", key),
  setSecret: (key, value) => ipcRenderer.invoke("secret:set", key, value),

  // Scheduler
  getSchedules: () => ipcRenderer.invoke("scheduler:list"),
  addSchedule: (schedule) => ipcRenderer.invoke("scheduler:add", schedule),
  removeSchedule: (id) => ipcRenderer.invoke("scheduler:remove", id),
  runScheduledNow: (id) => ipcRenderer.invoke("scheduler:runNow", id),
  onScheduleExecute: (cb) => ipcRenderer.on("schedule:execute", (_e, workflow) => cb(workflow)),
});
