// ========================================
// ÉLÉMENTS DE L'INTERFACE
// ========================================

const serverScreen = document.getElementById('server-screen')
const serverEditorScreen = document.getElementById('server-editor-screen')
const usernameScreen = document.getElementById('username-screen')
const controlScreen = document.getElementById('control-screen')

// Gestion des serveurs
const savedServerList = document.getElementById('saved-server-list')
const emptyServerList = document.getElementById('empty-server-list')
const addServerButton = document.getElementById('add-server-button')
const refreshServerStatusButton = document.getElementById('refresh-server-status')
const serverError = document.getElementById('server-error')

// Formulaire d'ajout / modification
const serverEditorTitle = document.getElementById('server-editor-title')
const serverEditorForm = document.getElementById('server-editor-form')
const serverNameInput = document.getElementById('server-name')
const serverHostInput = document.getElementById('server-host')
const serverPortInput = document.getElementById('server-port')
const serverIconPicker = document.getElementById('server-icon-picker')
const serverEditorError = document.getElementById('server-editor-error')
const cancelServerButton = document.getElementById('cancel-server-button')
const saveServerButton = document.getElementById('save-server-button')

// Pseudo
const selectedServer = document.getElementById('selected-server')
const usernameInput = document.getElementById('bot-username')
const usernameError = document.getElementById('username-error')
const backButton = document.getElementById('back-to-servers')
const connectButton = document.getElementById('connect-button')

// Informations du bot
const connectionStatus = document.getElementById('connection-status')
const currentUsername = document.getElementById('current-username')
const currentServer = document.getElementById('current-server')

const posX = document.getElementById('pos-x')
const posY = document.getElementById('pos-y')
const posZ = document.getElementById('pos-z')

// Suivi
const playerSelect = document.getElementById('player-select')
const followButton = document.getElementById('follow-button')

// Véhicule
const vehicleButton = document.getElementById('vehicle-btn')


// Joueur autorisé pour les commandes privées
const authorizedPlayerSelect = document.getElementById('authorized-player-select')
const authorizedPlayerStatus = document.getElementById('authorized-player-status')

let authorizedPlayer = null
let updatingAuthorization = false


// Console
const consoleOutput = document.getElementById('console-output')
const commandForm = document.getElementById('command-form')
const commandInput = document.getElementById('command-input')

// Chat
const chatForm = document.getElementById('chat-form')
const chatInput = document.getElementById('chat-input')

// Déconnexion
const disconnectButton = document.getElementById('disconnect-button')



// ========================================
// VARIABLES
// ========================================

let servers = []
let serverConfig = null
let editingServerId = null
let selectedIcon = 'flask'

let botStatus = 'disconnected'
let following = false
let followedPlayer = null
let isDisconnecting = false
let isMounted = false
let vehicleRequestPending = false

// ========================================
// GESTION DES THÈMES
// ========================================


const savedTheme = localStorage.getItem('app-theme')

const initialTheme = savedTheme === 'normal'
  ? 'normal'
  : 'minecraft'

// Appliquer le thème et conserver le choix.
function applyTheme(theme) {
  if (theme !== 'normal' && theme !== 'minecraft') return

  document.body.dataset.theme = theme
  localStorage.setItem('app-theme', theme)

  // Synchroniser la coche du menu Windows.
  window.minecraftBot.syncTheme(theme)
}

// Thème au démarrage.
applyTheme(initialTheme)

// Réagir aux changements depuis Affichage > Thème.
window.minecraftBot.onThemeChanged(theme => {
  applyTheme(theme)
})


// ========================================
// CHANGEMENT D'ÉCRAN
// ========================================

function showScreen(screen) {
  serverScreen.classList.add('hidden')
  serverEditorScreen.classList.add('hidden')
  usernameScreen.classList.add('hidden')
  controlScreen.classList.add('hidden')

  screen.classList.remove('hidden')
}

// ========================================
// ICÔNES DES SERVEURS
// ========================================

// On réutilise exactement les SVG présents
// dans le sélecteur d'icônes de index.html.

function createServerIcon(iconName) {
  const container = document.createElement('span')
  container.className = 'saved-server-icon'

  const iconButton = Array.from(
    serverIconPicker.querySelectorAll('[data-icon]')
  ).find(button => button.dataset.icon === iconName)

  const fallback = serverIconPicker.querySelector(
    '[data-icon="server"]'
  )

  const svg = (iconButton || fallback)?.querySelector('svg')

  if (svg) {
    container.appendChild(svg.cloneNode(true))
  }

  return container
}

function selectServerIcon(iconName) {
  selectedIcon = iconName

  serverIconPicker.querySelectorAll('.server-icon-option')
    .forEach(button => {
      const isSelected = button.dataset.icon === iconName

      button.classList.toggle('selected', isSelected)
      button.setAttribute('aria-pressed', String(isSelected))
    })
}

serverIconPicker.addEventListener('click', event => {
  const button = event.target.closest('.server-icon-option')

  if (!button) return

  selectServerIcon(button.dataset.icon)
})

// ========================================
// CHARGEMENT DES SERVEURS
// ========================================

async function loadServers() {
  try {
    const result = await window.minecraftBot.getServers()

    if (!result.success) {
      serverError.textContent = result.error
      return
    }

    serverError.textContent = ''
    servers = result.servers

    renderServers()
  } catch (error) {
    serverError.textContent =
      'Impossible de charger les serveurs : ' + error.message
  }
}

// ========================================
// AFFICHAGE DES SERVEURS
// ========================================

let serverStatusGeneration = 0

function renderServers() {
  const generation = ++serverStatusGeneration
  const checks = []
  savedServerList.replaceChildren()

  emptyServerList.classList.toggle(
    'hidden',
    servers.length > 0
  )

  for (const server of servers) {
    const card = document.createElement('div')
    card.className = 'saved-server-card'

    // Logo
    const icon = createServerIcon(server.icon)

    // Informations
    const details = document.createElement('div')
    details.className = 'saved-server-details'

    const name = document.createElement('strong')
    name.textContent = server.name

    const address = document.createElement('span')
    address.textContent = `${server.host}:${server.port}`

    const status = document.createElement('span')
    status.className = 'server-status'
    status.dataset.status = 'checking'
    status.textContent = 'Vérification…'
    status.title = 'Vérification sans connecter le bot.'
    details.append(name, address, status)
    checks.push({ id: server.id, element: status })

    // Boutons
    const actions = document.createElement('div')
    actions.className = 'saved-server-actions'

    const connect = document.createElement('button')
    connect.className = 'primary-button'
    connect.textContent = 'Connecter'

    connect.addEventListener('click', () => {
      chooseServer(server)
    })

    const edit = document.createElement('button')
    edit.className = 'secondary-button'
    edit.textContent = 'Modifier'

    edit.addEventListener('click', () => {
      openServerEditor(server)
    })

    const remove = document.createElement('button')
    remove.className = 'danger-button'
    remove.textContent = 'Supprimer'

    remove.addEventListener('click', () => {
      deleteServer(server)
    })

    actions.append(connect, edit, remove)

    card.append(icon, details, actions)
    savedServerList.appendChild(card)
  }
  refreshServerStatusButton.disabled = checks.length === 0
  refreshServerStatuses(checks, generation)
}

async function refreshServerStatuses(checks, generation) {
  refreshServerStatusButton.disabled = true
  let next = 0
  async function worker() {
    while (next < checks.length && generation === serverStatusGeneration) {
      const { id, element } = checks[next++]
      let state = 'unknown'
      let onlinePlayers = null
      try {
        const result = await window.minecraftBot.getServerStatus(id)
        if (result.success) {
          state = result.status === 'online' ? 'online' : 'offline'
          if (Number.isSafeInteger(result.onlinePlayers) && result.onlinePlayers >= 0) {
            onlinePlayers = result.onlinePlayers
          }
        }
      } catch { /* Une erreur IPC n'est pas une preuve que le serveur est hors ligne. */ }
      if (generation !== serverStatusGeneration) return
      element.dataset.status = state
      const onlineText = onlinePlayers === null ? 'En ligne'
        : `En ligne — ${onlinePlayers} joueur${onlinePlayers > 1 ? 's' : ''} connecté${onlinePlayers > 1 ? 's' : ''}`
      element.textContent = state === 'online' ? onlineText
        : state === 'offline' ? 'Hors ligne ou inaccessible' : 'Statut indisponible'
      element.title = state === 'offline'
        ? 'Aucune réponse Minecraft : serveur arrêté, réseau indisponible ou vérifications bloquées.'
        : 'Dernière vérification : ' + new Date().toLocaleTimeString()
    }
  }
  // Limiter les connexions simultanées, même avec une longue liste.
  await Promise.all(Array.from({ length: Math.min(4, checks.length) }, worker))
  if (generation === serverStatusGeneration) {
    refreshServerStatusButton.disabled = checks.length === 0
  }
}

refreshServerStatusButton.addEventListener('click', () => renderServers())

// ========================================
// AJOUT / MODIFICATION D'UN SERVEUR
// ========================================

function openServerEditor(server = null) {
  serverEditorError.textContent = ''

  if (server) {
    editingServerId = server.id

    serverEditorTitle.textContent = 'Modifier le serveur'

    serverNameInput.value = server.name
    serverHostInput.value = server.host
    serverPortInput.value = server.port

    selectServerIcon(server.icon)
  } else {
    editingServerId = null

    serverEditorTitle.textContent = 'Ajouter un serveur'

    serverEditorForm.reset()
    serverPortInput.value = '25565'

    selectServerIcon('flask')
  }

  showScreen(serverEditorScreen)
  serverNameInput.focus()
}

addServerButton.addEventListener('click', () => {
  openServerEditor()
})

cancelServerButton.addEventListener('click', () => {
  renderServers()
  showScreen(serverScreen)
})

// ========================================
// ENREGISTRER UN SERVEUR
// ========================================

serverEditorForm.addEventListener('submit', async event => {
  event.preventDefault()

  const name = serverNameInput.value.trim()
  const host = serverHostInput.value.trim()
  const port = Number(serverPortInput.value)

  serverEditorError.textContent = ''

  if (!name) {
    serverEditorError.textContent =
      'Entre un nom de serveur.'
    return
  }

  if (!host || /\s/.test(host)) {
    serverEditorError.textContent =
      'Entre une adresse valide, sans espace.'
    return
  }

  if (!Number.isInteger(port) ||
      port < 1 ||
      port > 65535) {
    serverEditorError.textContent =
      'Le port doit être compris entre 1 et 65535.'
    return
  }

  const data = {
    name,
    host,
    port,
    icon: selectedIcon
  }

  // Si on modifie un serveur existant,
  // on transmet son identifiant.
  if (editingServerId !== null) {
    data.id = editingServerId
  }

  saveServerButton.disabled = true

  try {
    const result = await window.minecraftBot.saveServer(data)

    if (!result.success) {
      serverEditorError.textContent = result.error
      return
    }

    servers = result.servers

    renderServers()
    showScreen(serverScreen)
  } catch (error) {
    serverEditorError.textContent = error.message
  } finally {
    saveServerButton.disabled = false
  }
})

// ========================================
// SUPPRIMER UN SERVEUR
// ========================================

async function deleteServer(server) {
  const confirmed = confirm(
    `Supprimer le serveur "${server.name}" ?\n\n` +
    'Cette action est irréversible.'
  )

  if (!confirmed) return

  try {
    const result = await window.minecraftBot.deleteServer(
      server.id
    )

    if (!result.success) {
      serverError.textContent = result.error
      return
    }

    serverError.textContent = ''
    servers = result.servers

    renderServers()
  } catch (error) {
    serverError.textContent = error.message
  }
}

// ========================================
// SÉLECTION D'UN SERVEUR
// ========================================

function chooseServer(server) {
  serverConfig = {
    host: server.host,
    port: server.port
  }

  selectedServer.textContent =
    `${server.name} (${server.host}:${server.port})`

  usernameError.textContent = ''

  showScreen(usernameScreen)
  usernameInput.focus()
}

backButton.addEventListener('click', () => {
  renderServers()
  showScreen(serverScreen)
})

// ========================================
// DERNIER PSEUDO UTILISÉ
// ========================================

async function loadUsername() {
  try {
    const username = await window.minecraftBot.getLastUsername()

    usernameInput.value = username || 'Bot'
  } catch {
    usernameInput.value = 'Bot'
  }
}

// ========================================
// CONNEXION DU BOT
// ========================================

connectButton.addEventListener('click', async () => {
  const username = usernameInput.value.trim() || 'Bot'

  if (!/^[a-zA-Z0-9_]{1,16}$/.test(username)) {
    usernameError.textContent =
      'Pseudo invalide : 1 à 16 caractères (lettres, chiffres et _).'
    return
  }

  if (!serverConfig) {
    usernameError.textContent =
      'Aucun serveur sélectionné.'
    return
  }

  connectButton.disabled = true
  usernameError.textContent = ''

  // Nouvelle session : on efface la console précédente.
  consoleOutput.replaceChildren()

  resetControls()

  currentUsername.textContent = username
  currentServer.textContent =
    `${serverConfig.host}:${serverConfig.port}`

  showScreen(controlScreen)
  updateStatus('connecting')

  try {
    const result = await window.minecraftBot.startBot({
      host: serverConfig.host,
      port: serverConfig.port,
      username
    })

    if (!result.success) {
      addLog(`ERREUR : ${result.error}`)
      updateStatus('error')
    }
  } catch (error) {
    addLog(`ERREUR : ${error.message}`)
    updateStatus('error')
  } finally {
    connectButton.disabled = false
  }
})

// ========================================
// STATUT DE CONNEXION
// ========================================

function updateStatus(status) {
  botStatus = status

  const statuses = {
    connecting: {
      text: 'Connexion...',
      color: '#e8bf59'
    },
    connected: {
      text: 'Connecté',
      color: '#68d391'
    },
    disconnected: {
      text: 'Déconnecté',
      color: '#ff8181'
    },
    error: {
      text: 'Erreur de connexion',
      color: '#ff8181'
    }
  }

  const current = statuses[status] || statuses.disconnected

  connectionStatus.textContent = current.text
  connectionStatus.style.color = current.color

  const connected = status === 'connected'

  commandInput.disabled = !connected
  chatInput.disabled = !connected

  commandForm.querySelector('button').disabled = !connected
  chatForm.querySelector('button').disabled = !connected

  
	if (!connected) {
	  following = false
	  followedPlayer = null

	  playerSelect.replaceChildren(
		new Option('Aucun joueur visible', '')
	  )

	  authorizedPlayerSelect.replaceChildren(
		new Option('Aucun joueur autorisé', '')
	  )

	  updateAuthorizedPlayer(null)
	}

	authorizedPlayerSelect.disabled =
	  !connected || updatingAuthorization


  if (status === 'disconnected' || status === 'error') {
    posX.textContent = '-'
    posY.textContent = '-'
    posZ.textContent = '-'

    disconnectButton.textContent = 'Retour aux serveurs'
  } else {
    disconnectButton.textContent = 'Déconnecter le bot'
  }

  updateFollowButton()

  if (!connected) {
    isMounted = false
    vehicleRequestPending = false
  }
  updateVehicleButton()
}

window.minecraftBot.onStatus(status => {
  updateStatus(status)
})

// ========================================
// COORDONNÉES
// ========================================

window.minecraftBot.onPosition(position => {
  posX.textContent = Number(position.x).toFixed(2)
  posY.textContent = Number(position.y).toFixed(2)
  posZ.textContent = Number(position.z).toFixed(2)
})

// ========================================
// LISTE DES JOUEURS VISIBLES
// ========================================


window.minecraftBot.onPlayers(players => {
  const previousSelection = playerSelect.value

  playerSelect.replaceChildren()

  if (players.length === 0) {
    playerSelect.add(
      new Option('Aucun joueur visible', '')
    )
  } else {
    for (const player of players) {
      playerSelect.add(new Option(player, player))
    }

    if (players.includes(previousSelection)) {
      playerSelect.value = previousSelection
    } else if (players.includes(followedPlayer)) {
      playerSelect.value = followedPlayer
    }
  }

  updateFollowButton()
})


// ========================================
// JOUEURS CONNECTÉS POUR LES /MSG
// ========================================

window.minecraftBot.onConnectedPlayers(players => {
  authorizedPlayerSelect.replaceChildren()

  authorizedPlayerSelect.add(
    new Option('Aucun joueur autorisé', '')
  )

  for (const player of players) {
    authorizedPlayerSelect.add(
      new Option(player, player)
    )
  }

  // Conserver la sélection actuelle si possible.
  updateAuthorizedPlayer(authorizedPlayer)
})



playerSelect.addEventListener('change', () => {
  updateFollowButton()
})

// ========================================
// SUIVI D'UN JOUEUR
// ========================================

function updateFollowButton() {
  followButton.textContent = following
    ? 'Arrêter de suivre'
    : 'Suivre'

  followButton.classList.toggle('following', following)

  followButton.disabled =
    botStatus !== 'connected' ||
    (!following && !playerSelect.value)

  // Le contrôle manuel des véhicules est indisponible pendant le suivi.
  updateVehicleButton()
}

followButton.addEventListener('click', async () => {
  if (botStatus !== 'connected') return

  if (following) {
    await sendCommand('arreter')
    return
  }

  const player = playerSelect.value

  if (!player) return

  await sendCommand(`suivre ${player}`)
})


// ========================================
// GESTION DU VÉHICULE
// ========================================

function updateVehicleButton() {
  if (!vehicleButton) return

  vehicleButton.textContent = isMounted
    ? 'Quitter le véhicule'
    : 'Monter dans un véhicule'

  vehicleButton.classList.toggle('vehicle-active', isMounted)
  vehicleButton.disabled = botStatus !== 'connected' || vehicleRequestPending || following
  vehicleButton.title = following
    ? 'Arrête le suivi pour utiliser manuellement un véhicule.'
    : ''

}

// L'événement reflète l'état réel du bot, pas seulement le clic.
window.minecraftBot.onVehicle(mounted => {
  isMounted = Boolean(mounted)
  updateVehicleButton()
})

if (vehicleButton) {
  vehicleButton.addEventListener('click', async () => {
    if (botStatus !== 'connected' || vehicleRequestPending || following) return

    vehicleRequestPending = true
    updateVehicleButton()

    try {
      const result = await window.minecraftBot.toggleVehicle()

      if (result && result.success === false) {
        addLog(`ERREUR : ${result.error || 'Action impossible.'}`)
      }
    } catch (error) {
      addLog(`ERREUR : ${error.message}`)
    } finally {
      vehicleRequestPending = false
      updateVehicleButton()
    }
  })
}

// ========================================
// JOUEUR AUTORISÉ POUR LES /MSG
// ========================================

function updateAuthorizedPlayer(username) {
  authorizedPlayer = username || null

  authorizedPlayerStatus.textContent =
    authorizedPlayer || 'Aucune'

  authorizedPlayerStatus.style.color =
    authorizedPlayer ? '#68d391' : ''

  // Synchroniser la liste avec le joueur autorisé.
  const available = Array.from(authorizedPlayerSelect.options)
    .some(option => option.value === authorizedPlayer)

  authorizedPlayerSelect.value =
    authorizedPlayer && available ? authorizedPlayer : ''
}

// Quand le bot confirme une modification.
window.minecraftBot.onAuthorizedPlayer(username => {
  updateAuthorizedPlayer(username)
})

// Changement immédiat depuis la liste déroulante.
authorizedPlayerSelect.addEventListener('change', async () => {
  if (botStatus !== 'connected' || updatingAuthorization) return

  const username = authorizedPlayerSelect.value || null

  updatingAuthorization = true
  authorizedPlayerSelect.disabled = true

  try {
    const result = await window.minecraftBot.setAuthorizedPlayer(username)

    if (!result.success) {
      addLog(`ERREUR : ${result.error}`)
      updateAuthorizedPlayer(authorizedPlayer)
      return
    }

    updateAuthorizedPlayer(result.authorizedPlayer)
  } catch (error) {
    addLog(`ERREUR : ${error.message}`)
    updateAuthorizedPlayer(authorizedPlayer)
  } finally {
    updatingAuthorization = false
    authorizedPlayerSelect.disabled = botStatus !== 'connected'
  }
})


// ========================================
// CONSOLE CMD
// ========================================

function addLog(message) {
  const line = document.createElement('div')
  line.textContent = String(message)

  consoleOutput.appendChild(line)
  consoleOutput.scrollTop = consoleOutput.scrollHeight
}

window.minecraftBot.onLog(message => {
  const text = String(message)

  addLog(text)

  // Synchronise le bouton de suivi avec les
  // commandes de la console et les /msg en jeu.

  const followMatch = text.match(
    /Je suis maintenant (.+) !/
  )

  if (followMatch) {
    following = true
    followedPlayer = followMatch[1]

    if (Array.from(playerSelect.options).some(
      option => option.value === followedPlayer
    )) {
      playerSelect.value = followedPlayer
    }

    updateFollowButton()
  }

  if (text.includes('arrêté de suivre') ||
      text.includes('arrêté de suivre'.replace('ê', 'e')) ||
      text.includes('Joueur introuvable ou non visible')) {
    following = false
    followedPlayer = null
    updateFollowButton()
  }
})

async function sendCommand(command) {
  try {
    const result = await window.minecraftBot.command(command)

    if (!result.success) {
      addLog(`ERREUR : ${result.error}`)
      return false
    }

    return true
  } catch (error) {
    addLog(`ERREUR : ${error.message}`)
    return false
  }
}

commandForm.addEventListener('submit', async event => {
  event.preventDefault()

  const command = commandInput.value.trim()

  if (!command) return

  addLog(`> ${command}`)
  commandInput.value = ''

  await sendCommand(command)

  commandInput.focus()
})

// ========================================
// CHAT PUBLIC
// ========================================

chatForm.addEventListener('submit', async event => {
  event.preventDefault()

  const message = chatInput.value.trim()

  if (!message) return

  if (botStatus !== 'connected') {
    addLog('Impossible d’envoyer un message : bot déconnecté.')
    return
  }

  const success = await sendCommand(`dire ${message}`)

  if (success) {
    chatInput.value = ''
  }
})

// ========================================
// DÉCONNEXION
// ========================================

disconnectButton.addEventListener('click', async () => {
  if (isDisconnecting) return

  if (botStatus === 'disconnected' ||
      botStatus === 'error') {
    await loadServers()
    showScreen(serverScreen)
    return
  }

  isDisconnecting = true
  disconnectButton.disabled = true

  try {
    const result = await window.minecraftBot.disconnect()

    if (!result.success) {
      addLog(`ERREUR : ${result.error}`)
    } else {
      updateStatus('disconnected')
      await loadServers()
      showScreen(serverScreen)
    }
  } catch (error) {
    addLog(`ERREUR : ${error.message}`)
  } finally {
    isDisconnecting = false
    disconnectButton.disabled = false
  }
})

// ========================================
// RÉINITIALISATION
// ========================================

function resetControls() {
  following = false
  followedPlayer = null
  isMounted = false
  vehicleRequestPending = false

  posX.textContent = '-'
  posY.textContent = '-'
  posZ.textContent = '-'

  playerSelect.replaceChildren(
    new Option('Aucun joueur visible', '')
  )

  updateFollowButton()
  updateVehicleButton()
}

// ========================================
// INITIALISATION
// ========================================

updateStatus('disconnected')
showScreen(serverScreen)

loadUsername()
loadServers()
