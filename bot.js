
const mineflayer = require('@wp2508/mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const EventEmitter = require('events')

const AUTHORIZED_PLAYER = 'Alex_LeGrand74'

class BotManager extends EventEmitter {
  constructor() {
    super()
    this.bot = null
    this.movements = null
    this.following = false
    this.targetName = null
    this.positionTimer = null
    this.playersTimer = null
    this.disconnecting = false
  }

  log(message) {
    this.emit('log', String(message))
  }

  setStatus(status) {
    this.emit('status', status)
  }

  start(config) {
    if (this.bot) {
      throw new Error('Un bot est déjà lancé.')
    }

    const { host, port, username } = config

    if (!host || !username) {
      throw new Error('Adresse du serveur et pseudo obligatoires.')
    }

    if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
      throw new Error('Port invalide.')
    }

    this.log(`Connexion de ${username}...`)
    this.log(`Adresse : ${host}:${port}`)
    this.setStatus('connecting')

    this.disconnecting = false

    try {
      this.bot = mineflayer.createBot({
        host,
        port: Number(port),
        username,
        auth: 'offline',
        version: '26.3'
      })

      const bot = this.bot

      bot.loadPlugin(pathfinder)

      bot.on('resourcePack', () => {
        this.log(`[${bot.username}] Pack de ressources reçu.`)
        this.log('Tentative d’acceptation...')

        try {
          bot.acceptResourcePack()
          this.log(`[${bot.username}] Acceptation envoyée.`)
        } catch (error) {
          this.log(`Erreur pack de ressources : ${error.message}`)
        }
      })

      bot.on('connect', () => {
        this.log(`[${bot.username}] Connexion réseau établie !`)
      })

      bot.on('login', () => {
        this.log(`[${bot.username}] Authentification terminée.`)
      })

      bot.on('spawn', () => {
        const p = bot.entity.position

        this.log('')
        this.log('================================')
        this.log(` ${bot.username} EST CONNECTÉ !`)
        this.log(` Position : X ${p.x.toFixed(1)}, Y ${p.y.toFixed(1)}, Z ${p.z.toFixed(1)}`)
        this.log('================================')

        this.movements = new Movements(bot)
        this.movements.allowParkour = true
        this.movements.maxDropDown = 1
        this.movements.canDig = false
        this.movements.canPlaceBlocks = false
        this.movements.avoidDamageBlocks = true

        bot.pathfinder.setMovements(this.movements)

        this.log('Navigation activée.')
        this.log('Commandes privées activées.')

        this.setStatus('connected')
        this.updatePosition()
        this.updatePlayers()

        this.startUpdates()
      })

      bot.on('whisper', (username, message) => {
        if (username.toLowerCase() !== AUTHORIZED_PLAYER.toLowerCase()) {
          this.log(`[${bot.username}] Commande ignorée : joueur non autorisé (${username})`)
          return
        }

        this.log(`[${bot.username}] Commande privée de ${username} : ${message}`)
        this.executeCommand(message, username)
      })

      bot.on('playerJoined', () => this.updatePlayers())
      bot.on('playerLeft', () => this.updatePlayers())
      bot.on('entitySpawn', () => this.updatePlayers())
      bot.on('entityGone', () => this.updatePlayers())

      bot.on('kicked', reason => {
        this.log(`[${bot.username}] EXCLU : ${this.formatReason(reason)}`)
        this.setStatus('disconnected')
      })

      bot.on('error', error => {
        this.log(`[${bot.username}] ERREUR : ${error.message}`)
        this.setStatus('error')
      })

      bot.on('end', () => {
        this.log(`[${bot.username}] Déconnecté.`)
        this.cleanup()
        this.setStatus('disconnected')
      })
    } catch (error) {
      this.cleanup()
      this.setStatus('error')
      throw error
    }
  }

  formatReason(reason) {
    if (typeof reason === 'string') return reason

    try {
      return JSON.stringify(reason)
    } catch {
      return String(reason)
    }
  }

  startUpdates() {
    this.stopUpdates()

    this.positionTimer = setInterval(() => {
      this.updatePosition()
    }, 500)

    this.playersTimer = setInterval(() => {
      this.updatePlayers()
    }, 1500)
  }

  stopUpdates() {
    if (this.positionTimer) clearInterval(this.positionTimer)
    if (this.playersTimer) clearInterval(this.playersTimer)

    this.positionTimer = null
    this.playersTimer = null
  }

  updatePosition() {
    if (!this.bot?.entity) return

    const p = this.bot.entity.position

    this.emit('position', {
      x: Number(p.x.toFixed(1)),
      y: Number(p.y.toFixed(1)),
      z: Number(p.z.toFixed(1))
    })
  }

  updatePlayers() {
    if (!this.bot) return

    const players = Object.entries(this.bot.players)
      .filter(([name, player]) => name !== this.bot.username && player.entity)
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b))

    this.emit('players', players)
  }

  reply(message, player = null) {
    const botName = this.bot ? this.bot.username : 'Bot'

    this.log(`[${botName}] ${message}`)

    if (!this.bot?.entity) return

    if (player) {
      this.bot.whisper(player, message)
    }
  }

  executeCommand(input, player = null) {
    if (!this.bot) {
      this.log('Aucun bot connecté.')
      return
    }

    const args = input.trim().split(/\s+/)
    const command = (args.shift() || '').toLowerCase()
    const bot = this.bot

    if (!command) return

    if (command === 'aide') {
      this.reply(
        'Commandes : suivre PSEUDO, arreter, pos, sauter, dire MESSAGE, deconnecter',
        player
      )
    }

    else if (command === 'suivre') {
      if (!bot.entity || !this.movements) {
        this.reply('Le bot n’est pas encore prêt.', player)
        return
      }

      if (!args[0]) {
        this.reply('Utilisation : suivre PSEUDO', player)
        return
      }

      const targetName = args[0]
      const target = bot.players[targetName]?.entity

      if (!target) {
        this.reply('Joueur introuvable ou non visible : ' + targetName, player)
        this.following = false
        this.targetName = null
        return
      }

      this.targetName = targetName
      this.following = true

      bot.pathfinder.setMovements(this.movements)
      bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true)

      this.reply('Je suis maintenant ' + targetName + ' !', player)
    }

    else if (command === 'arreter') {
      this.stopFollowing()
      this.reply('J’ai arrêté de suivre.', player)
    }

    else if (command === 'pos') {
      if (!bot.entity) return

      const p = bot.entity.position

      this.reply(
        `Position : X ${p.x.toFixed(1)}, Y ${p.y.toFixed(1)}, Z ${p.z.toFixed(1)}`,
        player
      )
    }

    else if (command === 'sauter') {
      if (!bot.entity) return

      bot.setControlState('jump', true)

      setTimeout(() => {
        if (this.bot?.entity) {
          this.bot.setControlState('jump', false)
        }
      }, 500)

      this.reply('Je saute !', player)
    }

    else if (command === 'dire') {
      const message = args.join(' ')

      if (!message) {
        this.reply('Utilisation : dire MESSAGE', player)
        return
      }

      bot.chat(message)
      this.reply('Message envoyé dans le chat public.', player)
    }

    else if (command === 'deconnecter' || command === 'stop') {
      this.reply('Je me déconnecte !', player)
      this.disconnect()
    }

    else {
      this.reply('Commande inconnue. Tape aide.', player)
    }
  }

  stopFollowing() {
    this.following = false
    this.targetName = null

    if (this.bot?.pathfinder) {
      this.bot.pathfinder.setGoal(null)
    }

    if (this.bot?.entity) {
      this.bot.clearControlStates()
    }
  }

  command(input) {
    this.executeCommand(input)
  }

  async disconnect() {
    if (!this.bot) {
      this.setStatus('disconnected')
      return
    }

    if (this.disconnecting) return

    this.disconnecting = true
    this.log('Déconnexion du bot...')

    const bot = this.bot

    this.stopFollowing()
    this.stopUpdates()

    try {
      bot.quit()
    } catch (error) {
      this.log(`Erreur pendant la déconnexion : ${error.message}`)
      this.cleanup()
      this.setStatus('disconnected')
      return
    }

    await new Promise(resolve => setTimeout(resolve, 1000))

    if (this.bot === bot) {
      this.cleanup()
      this.setStatus('disconnected')
    }
  }

  cleanup() {
    this.stopUpdates()
    this.following = false
    this.targetName = null
    this.movements = null
    this.bot = null
    this.disconnecting = false
  }
}

module.exports = BotManager
