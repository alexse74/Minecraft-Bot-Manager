
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('minecraftBot', {

  // ========================================
  // GESTION DU BOT
  // ========================================

  startBot: config => ipcRenderer.invoke('bot:start', config),

  command: input => ipcRenderer.invoke('bot:command', input),

  disconnect: () => ipcRenderer.invoke('bot:disconnect'),
  
  
  // Monter dans le véhicule le plus proche ou en descendre
  toggleVehicle: () => ipcRenderer.invoke('bot:toggle-vehicle'),

  // Recevoir les changements d'état du véhicule
  onVehicle: callback => {
    const listener = (_event, mounted) => callback(mounted)

    ipcRenderer.on('bot:vehicle', listener)

    return () => {
      ipcRenderer.removeListener('bot:vehicle', listener)
    }
  },

  
setAuthorizedPlayer: username =>
  ipcRenderer.invoke('bot:set-authorized-player', username),


  getLastUsername: () => ipcRenderer.invoke('config:get-username'),
  
  
  // ========================================
  // GESTION DU THÈME
  // ========================================

  syncTheme: theme => {
    ipcRenderer.send('app:theme-sync', theme)
  },

  onThemeChanged: callback => {
    const listener = (_event, theme) => callback(theme)

    ipcRenderer.on('app:theme-changed', listener)

    return () => {
      ipcRenderer.removeListener('app:theme-changed', listener)
    }
  },


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
},

onConnectedPlayers: callback => {
  const listener = (_event, players) => callback(players)
  ipcRenderer.on('bot:connected-players', listener)

  return () => ipcRenderer.removeListener('bot:connected-players', listener)
},

onAuthorizedPlayer: callback => {
  const listener = (_event, username) => callback(username)
  ipcRenderer.on('bot:authorized-player', listener)

  return () => ipcRenderer.removeListener('bot:authorized-player', listener)
}


})
