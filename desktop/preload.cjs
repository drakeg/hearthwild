const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("hearthwildDesktop", {
  quit: () => ipcRenderer.invoke("hearthwild:quit"),
});
