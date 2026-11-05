
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('minecraftBot', {

  // ========================================
  // GESTION DU BOT
  // ========================================

  startBot: config => ipcRenderer.invoke('bot:start', config),

  command: input => ipcRenderer.invoke('bot:command', input),

  disconnect: () => ipcRenderer.invoke('bot:disconnect'),

  getLastUsername: () => ipcRenderer.invoke('config:get-username'),

  // ========================================
  // GESTION DES SERVEURS
  // ========================================

  getServers: () => ipcRenderer.invoke('servers:list'),

  saveServer: server => ipcRenderer.invoke('servers:save', server),

  deleteServer: id => ipcRenderer.invoke('servers:delete', id),

  // ========================================
  // ÉVÉNEMENTS DU BOT
  // ========================================

  onLog: callback => {
    const listener = (_event, message) => callback(message)
    ipcRenderer.on('bot:log', listener)

    return () => ipcRenderer.removeListener('bot:log', listener)
  },

  onStatus: callback => {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('bot:status', listener)

    return () => ipcRenderer.removeListener('bot:status', listener)
  },

  onPosition: callback => {
    const listener = (_event, position) => callback(position)
    ipcRenderer.on('bot:position', listener)

    return () => ipcRenderer.removeListener('bot:position', listener)
  },

  onPlayers: callback => {
    const listener = (_event, players) => callback(players)
    ipcRenderer.on('bot:players', listener)

    return () => ipcRenderer.removeListener('bot:players', listener)
  }

})
