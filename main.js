
const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const { randomUUID } = require('crypto')
const BotManager = require('./bot')
const checkServerStatus = require('./server-status')

let mainWindow = null
let isQuitting = false

const botManager = new BotManager()


// ========================================
// MENU AFFICHAGE / THÈME
// ========================================

let selectedTheme = 'minecraft'

function setApplicationTheme(theme, notifyRenderer = false) {
  if (theme !== 'minecraft' && theme !== 'normal') {
    return
  }

  selectedTheme = theme

  // Met à jour la coche dans le menu.
  createApplicationMenu()

  // Envoie le changement à l'interface.
  if (notifyRenderer) {
    sendToInterface('app:theme-changed', theme)
  }
}

function createApplicationMenu() {
  const template = [
    {
      label: 'Affichage',
      submenu: [
        {
          label: 'Thème',
          submenu: [
            {
              label: 'Défaut',
              type: 'radio',
              checked: selectedTheme === 'minecraft',
              click: () => {
                setApplicationTheme('minecraft', true)
              }
            },
            {
              label: 'Classique',
              type: 'radio',
              checked: selectedTheme === 'normal',
              click: () => {
                setApplicationTheme('normal', true)
              }
            }
          ]
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// Synchronise le menu avec le thème sauvegardé
// dans l'interface au démarrage.
ipcMain.on('app:theme-sync', (event, theme) => {
  if (event.sender !== mainWindow?.webContents) {
    return
  }

  setApplicationTheme(theme)
})


// ========================================
// COMMUNICATION AVEC L'INTERFACE
// ========================================

function sendToInterface(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

botManager.on('log', message => {
  sendToInterface('bot:log', message)
})

botManager.on('status', status => {
  sendToInterface('bot:status', status)
})

botManager.on('position', position => {
  sendToInterface('bot:position', position)
})

botManager.on('players', players => {
  sendToInterface('bot:players', players)
})
botManager.on('authorizedPlayer', username => {
  sendToInterface('bot:authorized-player', username)
})
botManager.on('connectedPlayers', players => {
  sendToInterface('bot:connected-players', players)
})

// Informe l'interface quand le bot monte ou descend
botManager.on('vehicle', mounted => {
  sendToInterface('bot:vehicle', mounted)
})

// ========================================
// DOSSIER DE SAUVEGARDE
// ========================================

function getDataPath(filename) {
  return path.join(app.getPath('userData'), filename)
}

// ========================================
// DERNIER PSEUDO UTILISÉ
// ========================================

function loadLastUsername() {
  try {
    const config = JSON.parse(
      fs.readFileSync(getDataPath('config.json'), 'utf8')
    )

    return typeof config.lastUsername === 'string'
      ? config.lastUsername
      : 'Bot'
  } catch {
    return 'Bot'
  }
}

function saveLastUsername(username) {
  const configPath = getDataPath('config.json')

  fs.mkdirSync(path.dirname(configPath), {
    recursive: true
  })

  fs.writeFileSync(
    configPath,
    JSON.stringify({ lastUsername: username }, null, 2),
    'utf8'
  )
}

// ========================================
// GESTION DES SERVEURS ENREGISTRÉS
// ========================================

const ALLOWED_ICONS = [
  'flask',
  'gamepad',
  'server',
  'globe',
  'shield'
]

function loadServers() {
  const filePath = getDataPath('servers.json')

  if (!fs.existsSync(filePath)) {
    return []
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const servers = JSON.parse(content)

  if (!Array.isArray(servers)) {
    throw new Error('Le fichier des serveurs est invalide.')
  }

  return servers
}

function saveServers(servers) {
  const filePath = getDataPath('servers.json')

  fs.mkdirSync(path.dirname(filePath), {
    recursive: true
  })

  const temporaryPath = filePath + '.tmp'

  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(servers, null, 2),
    'utf8'
  )

  fs.renameSync(temporaryPath, filePath)
}

function validateServer(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Données du serveur invalides.')
  }

  const name = String(data.name || '').trim()
  const host = String(data.host || '').trim()
  const port = Number(data.port)
  const icon = String(data.icon || 'server')

  if (!name || name.length > 50) {
    throw new Error('Le nom doit contenir entre 1 et 50 caractères.')
  }

  if (!host || host.length > 255 || /\s/.test(host)) {
    throw new Error('Adresse IP ou domaine invalide.')
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Le port doit être compris entre 1 et 65535.')
  }

  if (!ALLOWED_ICONS.includes(icon)) {
    throw new Error('Icône invalide.')
  }

  return { name, host, port, icon }
}

ipcMain.handle('servers:list', () => {
  try {
    return {
      success: true,
      servers: loadServers()
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
})

// Le renderer transmet un identifiant ; seules les adresses sauvegardées sont sondées.
const pendingServerChecks = new Map()
ipcMain.handle('servers:status', async (event, id) => {
  if (event.sender !== mainWindow?.webContents) {
    return { success: false, error: 'Fenêtre non autorisée.' }
  }
  try {
    const server = loadServers().find(item => item.id === id)
    if (!server) throw new Error('Serveur introuvable.')
    const { host, port } = validateServer(server)
    const key = JSON.stringify([host, port])
    if (!pendingServerChecks.has(key)) {
      const request = checkServerStatus({ host, port })
        .finally(() => pendingServerChecks.delete(key))
      pendingServerChecks.set(key, request)
    }
    return { success: true, ...await pendingServerChecks.get(key) }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('servers:save', (_event, data) => {
  try {
    const validated = validateServer(data)
    const servers = loadServers()

    if (data.id != null) {
      const index = servers.findIndex(
        server => server.id === data.id
      )

      if (index === -1) {
        throw new Error('Serveur introuvable.')
      }

      servers[index] = {
        id: data.id,
        ...validated
      }
    } else {
      servers.push({
        id: randomUUID(),
        ...validated
      })
    }

    saveServers(servers)

    return {
      success: true,
      servers
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
})

ipcMain.handle('servers:delete', (_event, id) => {
  try {
    const servers = loadServers()
    const index = servers.findIndex(
      server => server.id === id
    )

    if (index === -1) {
      throw new Error('Serveur introuvable.')
    }

    servers.splice(index, 1)
    saveServers(servers)

    return {
      success: true,
      servers
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
})

// ========================================
// COMMANDES DU BOT
// ========================================

ipcMain.handle('bot:start', async (_event, config) => {
  try {
    botManager.start(config)

    if (typeof config.username === 'string') {
      saveLastUsername(config.username)
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
})

ipcMain.handle('bot:command', async (_event, input) => {
  try {
    botManager.command(input)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
})


// ========================================
// JOUEUR AUTORISÉ POUR LES /MSG
// ========================================

ipcMain.handle('bot:set-authorized-player', (_event, username) => {
  try {
    botManager.setAuthorizedPlayer(username)

    return {
      success: true,
      authorizedPlayer: botManager.authorizedPlayer
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
})


ipcMain.handle('bot:disconnect', async () => {
  try {
    await botManager.disconnect()

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
})

// Monter dans le véhicule le plus proche ou en descendre
ipcMain.handle('bot:toggle-vehicle', async () => {
  return await botManager.toggleVehicle()
})

ipcMain.handle('config:get-username', () => {
  return loadLastUsername()
})

// ========================================
// FENÊTRE ELECTRON
// ========================================


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1350,
	height: 900,
	minWidth: 1100,
	minHeight: 750,
	resizable: true,

    title: 'Minecraft Bot Manager',

    // Logo personnalisé
    icon: path.join(__dirname, 'assets', 'icon.ico'),

    backgroundColor: '#17191d',

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.loadFile('index.html')

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}


// ========================================
// DÉMARRAGE ET FERMETURE
// ========================================


app.whenReady().then(() => {
  createApplicationMenu()
  createWindow()


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', event => {
  if (isQuitting || !botManager.bot) return

  event.preventDefault()
  isQuitting = true

  botManager.disconnect()
    .catch(error => {
      console.error('Erreur à la fermeture :', error)
    })
    .finally(() => {
      app.quit()
    })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
