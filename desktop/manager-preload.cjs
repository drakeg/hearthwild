const { contextBridge, ipcRenderer } = require("electron");
// The Server Manager's only access to the app: these calls, each checked in the main process.
contextBridge.exposeInMainWorld("serverManager", {
  status: () => ipcRenderer.invoke("server:status"),
  save: (config) => ipcRenderer.invoke("server:save", config),
  start: () => ipcRenderer.invoke("server:start"),
  stop: () => ipcRenderer.invoke("server:stop"),
  restart: () => ipcRenderer.invoke("server:restart"),
  pick: (kind) => ipcRenderer.invoke("server:pick", kind),
  openFolder: () => ipcRenderer.invoke("server:open-folder"),
  backup: () => ipcRenderer.invoke("server:backup"),
  copy: (text) => ipcRenderer.invoke("server:copy", text),
  announce: (text) => ipcRenderer.invoke("server:announce", text),
  kick: (name) => ipcRenderer.invoke("server:kick", name),
  ban: (username, reason) => ipcRenderer.invoke("server:ban", username, reason),
  unban: (username) => ipcRenderer.invoke("server:unban", username),
  resetPassword: (username, password) => ipcRenderer.invoke("server:reset-password", username, password),
  onChange: (fn) => ipcRenderer.on("server:changed", () => fn()),
});
