const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("maurya", {
  getSystemInfo: () => ipcRenderer.invoke("system:info")
});
