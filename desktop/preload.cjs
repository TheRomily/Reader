const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("readerDesktop", {
  platform: process.platform,
  calibreStatus: () => ipcRenderer.invoke("converter:status"),
  chooseCalibre: () => ipcRenderer.invoke("converter:choose"),
  pickConversionSource: () => ipcRenderer.invoke("converter:source"),
  convert: (options) =>
    ipcRenderer.invoke("converter:run", {
      token: options?.token,
      format: options?.format,
    }),
  cancelConversion: () => ipcRenderer.invoke("converter:cancel"),
});
