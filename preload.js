const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fitnessAPI', {
  init: () => ipcRenderer.invoke('init'),
  chooseFile: () => ipcRenderer.invoke('choose-file'),
  createFile: () => ipcRenderer.invoke('create-file'),
  saveEntries: (entries) => ipcRenderer.invoke('save-entries', entries),
  getCurrentFile: () => ipcRenderer.invoke('get-current-file'),
  setDarkMode: (enabled) => ipcRenderer.invoke('set-dark-mode', enabled)
});
