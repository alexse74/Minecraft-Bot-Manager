
const mineflayer = require('@wp2508/mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const EventEmitter = require('events')


class BotManager extends EventEmitter {
  constructor() {
    super()
    this.bot = null
    this.movements = null
    this.following = false
    this.targetName = null
    this.followEntity = null
    this.vehicleOperation = 0
    this.vehicleAttemptActive = false
    this.followTargetBoatId = null
    this.lastKnownFollowBoatId = null
    this.autoBoardedVehicleId = null
    this.followBoatAwaySince = null
    this.autoVehicleRetryAt = 0
    this.autoVehiclePaused = false
    this.boatPassengers = new Map()
    this.confirmedFollowBoatId = null
    this.positionTimer = null
    this.playersTimer = null
    this.disconnecting = false
	this.authorizedPlayer = null
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
        this.emit('vehicle', Boolean(bot.vehicle))
      })
	  
	  
	bot.on('whisper', (username, message) => {
	  if (
		!this.authorizedPlayer ||
		username.toLowerCase() !== this.authorizedPlayer.toLowerCase()
	  ) {
		this.log(
		  `[${bot.username}] Commande privée ignorée : ${username} (non autorisé)`
		)
		return
	  }

	  this.log(
		`[${bot.username}] Commande privée de ${username} : ${message}`
	  )

	  this.executeCommand(message, username)
	})




      // L'état du bouton dépend des événements confirmés par le serveur.
      bot.on('mount', () => {
        this.vehicleOperation++
        this.vehicleAttemptActive = false
        bot.pathfinder.setGoal(null)
        bot.clearControlStates()
        if (bot.vehicle?.id === this.followTargetBoatId) {
          this.autoBoardedVehicleId = bot.vehicle.id
          this.autoBoardedAt = Date.now()
        }
        this.emit('vehicle', true)
        this.log(`[${bot.username}] Monté dans un véhicule.`)
      })

      bot.on('dismount', () => {
        this.vehicleOperation++
        this.vehicleAttemptActive = false
        this.autoBoardedVehicleId = null
        this.followBoatAwaySince = null
        this.emit('vehicle', false)
        this.log(`[${bot.username}] Descendu du véhicule.`)
        // Recréer l'objectif de suivi après la descente.
        this.followEntity = null
        this.updateFollowing()
      })

      // Source de vérité : paquet serveur avec la liste complète des passagers.
      // Contrairement aux positions, ce paquet indique directement qui est à bord.
      bot._client.on('packet', (packet, metadata) => {
        if (metadata?.name !== 'set_passengers') return
        if (!Number.isInteger(packet?.entityId) || !Array.isArray(packet.passengers)) return

        const ids = new Set(packet.passengers)
        this.boatPassengers.set(packet.entityId, ids)
        this.handlePassengerUpdate(packet.entityId, ids)
      })

	bot.on('playerJoined', () => {
	  this.updatePlayers()
	})

	bot.on('playerLeft', player => {
	  if (
		player &&
		this.authorizedPlayer &&
		player.username.toLowerCase() === this.authorizedPlayer.toLowerCase()
	  ) {
		this.authorizedPlayer = null
		this.emit('authorizedPlayer', null)
		this.log('Le joueur autorisé a quitté le serveur. Autorisation retirée.')
	  }

	  this.updatePlayers()
	})

	bot.on('entitySpawn', () => {
	  this.updatePlayers()
	})

	bot.on('entityGone', entity => {
      if (entity?.id != null) this.boatPassengers.delete(entity.id)
	  this.updatePlayers()
	})


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
  

	setAuthorizedPlayer(username) {
	  if (!this.bot?.entity) {
		throw new Error('Le bot doit être connecté.')
	  }

	  // Aucun joueur autorisé
	  if (username === null || username === '') {
		this.authorizedPlayer = null
		this.emit('authorizedPlayer', null)
		this.log('Aucun joueur autorisé pour les commandes privées.')
		return
	  }

	  if (typeof username !== 'string') {
		throw new Error('Pseudo invalide.')
	  }

	  // Recherche parmi TOUS les joueurs connus du serveur,
	  // même ceux qui sont trop loin pour être visibles.
	  const player = Object.entries(this.bot.players).find(
		([name]) =>
		  name.toLowerCase() === username.toLowerCase() &&
		  name !== this.bot.username
	  )

	  if (!player) {
		throw new Error('Joueur introuvable dans la liste des connectés.')
	  }

	  this.authorizedPlayer = player[0]

	  this.emit('authorizedPlayer', this.authorizedPlayer)
	  this.log(`Joueur autorisé : ${this.authorizedPlayer}`)
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
	  this.updateFollowing()
	}, 1000)

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

	  // Joueurs physiquement visibles : pour le suivi.
	  const visiblePlayers = Object.entries(this.bot.players)
		.filter(([name, player]) =>
		  name !== this.bot.username && player.entity
		)
		.map(([name]) => name)
		.sort((a, b) => a.localeCompare(b))

	  this.emit('players', visiblePlayers)

	  // Tous les joueurs connus comme connectés : pour les /msg.
	  const connectedPlayers = Object.keys(this.bot.players)
		.filter(name => name !== this.bot.username)
		.sort((a, b) => a.localeCompare(b))

	  this.emit('connectedPlayers', connectedPlayers)
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
        'Commandes : suivre PSEUDO, arreter, vehicule, pos, sauter, dire MESSAGE, deconnecter',
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
		this.followEntity = null
        this.followTargetBoatId = null
        this.lastKnownFollowBoatId = null
        this.confirmedFollowBoatId = null
        return
      }

      
		this.targetName = targetName
		this.following = true
		this.followEntity = null
        this.followTargetBoatId = null
        this.lastKnownFollowBoatId = null
        this.autoBoardedVehicleId = null
        this.confirmedFollowBoatId = null
        this.autoVehiclePaused = false
        this.autoVehicleRetryAt = 0
        // Récupérer l’état déjà connu si le joueur était dans un bateau.
        for (const [boatId, passengers] of this.boatPassengers) {
          if (passengers.has(target.id) && this.isBoat(bot.entities[boatId])) {
            this.handlePassengerUpdate(boatId, passengers)
            break
          }
        }

		// Démarrer le suivi avec l'entité actuelle.
		this.updateFollowing()


      this.reply('Je suis maintenant ' + targetName + ' !', player)
    }

    else if (command === 'arreter') {
      this.stopFollowing()
      this.reply('J’ai arrêté de suivre.', player)
    }

    else if (command === 'vehicule' || command === 'véhicule') {
      this.toggleVehicle()
        .then(() => this.reply('Action véhicule demandée.', player))
        .catch(error => this.reply('Véhicule : ' + error.message, player))
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

	
  // ========================================
  // REPRISE AUTOMATIQUE DU SUIVI
  // ========================================

  // Identifie le joueur à partir de son pseudo, indépendamment de la distance.
  getFollowedEntity() {
    return this.targetName ? this.bot?.players[this.targetName]?.entity : null
  }

  // Seule une liste de passagers explicitement reçue du serveur fait foi.
  // Une liste manquante (ou une entité temporairement absente) ne signifie pas
  // que le joueur a quitté le bateau.
  findFollowedPlayerBoat() {
    const bot = this.bot
    const target = this.getFollowedEntity()
    if (!bot || !target) return null

    for (const [boatId, passengerIds] of this.boatPassengers) {
      if (!passengerIds.has(target.id)) continue
      const boat = bot.entities[boatId]
      if (this.isBoat(boat)) return boat
    }

    return null
  }

  // Traite une mise à jour CONFIRMÉE, pas une estimation par distance.
  handlePassengerUpdate(vehicleId, passengerIds) {
    const bot = this.bot
    if (!bot || !this.following || !this.targetName) return
    const target = this.getFollowedEntity()
    if (!target) return

    const boat = bot.entities[vehicleId]
    if (!this.isBoat(boat) && vehicleId !== this.confirmedFollowBoatId) return

    if (passengerIds.has(target.id)) {
      // Le joueur suivi est confirmé à bord de CE bateau.
      if (this.confirmedFollowBoatId !== vehicleId) {
        this.log(`[${bot.username}] ${this.targetName} est confirmé dans le bateau ${vehicleId}.`)
      }
      this.confirmedFollowBoatId = vehicleId
      this.followTargetBoatId = vehicleId
      this.lastKnownFollowBoatId = vehicleId
      this.autoVehiclePaused = false
      this.autoVehicleRetryAt = 0
      return
    }

    // Un paquet pour un autre bateau ne prouve rien sur le joueur suivi.
    if (this.confirmedFollowBoatId !== vehicleId) return

    // Le serveur a explicitement retiré le joueur des passagers du bateau.
    this.log(`[${bot.username}] ${this.targetName} a quitté son bateau (passagers confirmés).`)
    this.confirmedFollowBoatId = null
    this.followTargetBoatId = null
    this.lastKnownFollowBoatId = null
    this.autoVehiclePaused = false
    this.autoVehicleRetryAt = 0

    if (bot.vehicle?.id === vehicleId && this.autoBoardedVehicleId === vehicleId) {
      this.leaveVehicle(false)
    }

    this.autoBoardedVehicleId = null
    this.followEntity = null
    if (!bot.vehicle) this.updateFollowing()
  }

  updateFollowing() {
    const bot = this.bot
    if (!bot?.entity || !this.following || !this.targetName) return

    if (bot.vehicle || this.vehicleAttemptActive) return

    const boat = this.findFollowedPlayerBoat()
    if (boat && !this.autoVehiclePaused) {
      if (this.followTargetBoatId !== boat.id) {
        this.followTargetBoatId = boat.id
        this.log(`[${bot.username}] Bateau de ${this.targetName} détecté (ID ${boat.id}).`)
      }
      if (Date.now() >= this.autoVehicleRetryAt) {
        this.autoVehicleRetryAt = Date.now() + 5000
        this.toggleVehicle(boat, true).catch(error => {
          if (this.bot === bot) {
            this.log(`[${bot.username}] Impossible de rejoindre le bateau : ${error.message}`)
          }
        })
      }
      return
    }

    if (!boat && this.followTargetBoatId !== null) {
      this.followTargetBoatId = null
    }

    // Retrouver l'entité actuelle grâce au pseudo.
    const target = bot.players[this.targetName]?.entity
    if (!target) {
      if (this.followEntity !== null) {
        this.followEntity = null
        bot.pathfinder.setGoal(null)
        bot.clearControlStates()
        this.log(`[${bot.username}] ${this.targetName} n'est plus visible. Suivi en attente...`)
      }
      return
    }

    if (this.followEntity === target) return

    this.followEntity = target
    bot.pathfinder.setMovements(this.movements)
    bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true)
    this.log(`[${bot.username}] ${this.targetName} est visible. Suivi repris !`)
  }


  // Bateaux standards, coffres et radeaux.
  isBoat(entity) {
    if (!entity?.position) return false
    const name = String(entity.name || entity.displayName || '').toLowerCase()
    return name.includes('boat') || name.includes('raft')
  }

  isRideableVehicle(entity) {
    if (!entity?.position) return false
    const name = String(entity.name || entity.displayName || '').toLowerCase()
    return this.isBoat(entity) || name.includes('minecart')
  }

  // Descente : demande Mineflayer, puis impulsion courte de sneak
  // si le serveur ne confirme pas. Ne laisse jamais sneak actif.
  leaveVehicle(manual = true) {
    const bot = this.bot
    if (!bot?.entity || !bot.vehicle) return

    const oldVehicle = bot.vehicle
    this.vehicleOperation++
    this.vehicleAttemptActive = false
    if (manual && this.followTargetBoatId === oldVehicle.id) {
      this.autoVehiclePaused = true
    }

    try {
      bot.dismount()
      this.log(`[${bot.username}] Demande de descente envoyée.`)
    } catch (error) {
      this.log(`[${bot.username}] Descente Mineflayer : ${error.message}`)
    }

    // Certains serveurs / versions exigent une touche sneak
    // maintenue un instant pour accepter la descente.
    setTimeout(() => {
      if (this.bot !== bot || !bot.entity) return
      if (!bot.vehicle) {
        bot.setControlState('sneak', false)
        return
      }
      bot.setControlState('sneak', true)
      setTimeout(() => {
        if (this.bot === bot && bot.entity) {
          bot.setControlState('sneak', false)
        }
      }, 200)
    }, 250)

    setTimeout(() => {
      if (this.bot !== bot || !bot.entity) return
      bot.setControlState('sneak', false)
      if (bot.vehicle) {
        this.log(`[${bot.username}] Descente non confirmée : le serveur garde le bot dans le véhicule.`)
      }
    }, 1200)
  }

  // Sans argument : véhicule visible le plus proche.
  // Avec un bateau imposé : uniquement celui du joueur suivi.
  async toggleVehicle(targetVehicle = null, automatic = false) {
    const bot = this.bot
    if (!bot?.entity || !this.movements) {
      throw new Error('Le bot doit être connecté.')
    }

    // Pendant le suivi, le véhicule est géré automatiquement.
    if (this.following && !automatic) {
      throw new Error('Arrête le suivi avant d’utiliser manuellement un véhicule.')
    }

    if (bot.vehicle) {
      if (!automatic) this.leaveVehicle(true)
      return
    }

    if (this.vehicleAttemptActive) {
      throw new Error('Une montée dans un véhicule est déjà en cours.')
    }

    const vehicles = Object.values(bot.entities)
      .filter(entity => this.isRideableVehicle(entity))
      .map(entity => ({
        entity,
        distance: bot.entity.position.distanceTo(entity.position)
      }))
      .sort((a, b) => a.distance - b.distance)

    const vehicle = targetVehicle
      ? bot.entities[targetVehicle.id]
      : vehicles[0]?.entity

    if (!vehicle || !this.isRideableVehicle(vehicle)) {
      throw new Error('Aucun bateau ou minecart visible à proximité.')
    }

    if (automatic && (!this.isBoat(vehicle) || vehicle.id !== this.followTargetBoatId)) {
      return
    }

    this.vehicleAttemptActive = true
    const operation = ++this.vehicleOperation
    bot.pathfinder.setGoal(null)
    bot.clearControlStates()
    this.followEntity = null
    this.log(`[${bot.username}] Déplacement vers ${automatic ? 'le bateau du joueur suivi' : 'un véhicule'}...`)

    try {
      if (bot.entity.position.distanceTo(vehicle.position) > 2.5) {
        await bot.pathfinder.goto(
          new goals.GoalNear(
            Math.floor(vehicle.position.x),
            Math.floor(vehicle.position.y),
            Math.floor(vehicle.position.z),
            2
          )
        )
      }

      if (this.bot !== bot || operation !== this.vehicleOperation || bot.vehicle) return

      const currentVehicle = bot.entities[vehicle.id]
      if (!currentVehicle || !this.isRideableVehicle(currentVehicle)) {
        throw new Error('Le véhicule a disparu.')
      }
      if (automatic && currentVehicle.id !== this.followTargetBoatId) return
      if (bot.entity.position.distanceTo(currentVehicle.position) > 4) {
        throw new Error('Le véhicule est trop loin pour monter.')
      }

      bot.mount(currentVehicle)
      this.log(`[${bot.username}] Demande de montée envoyée.`)
      // L'interface ne change qu'au retour de l'événement "mount".
    } catch (error) {
      if (this.bot === bot && operation === this.vehicleOperation) {
        this.log(`[${bot.username}] Impossible de monter : ${error.message}`)
        throw error
      }
    } finally {
      if (this.bot === bot && operation === this.vehicleOperation) {
        this.vehicleAttemptActive = false
        this.followEntity = null
        if (!automatic) this.updateFollowing()
      }
    }
  }

  stopFollowing() {
    this.followTargetBoatId = null
    this.lastKnownFollowBoatId = null
    this.confirmedFollowBoatId = null
    this.autoBoardedVehicleId = null
    this.autoVehiclePaused = false
    this.vehicleOperation++
    this.vehicleAttemptActive = false
    this.following = false
    this.targetName = null
	this.followEntity = null

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

    this.vehicleOperation++
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
    this.vehicleAttemptActive = false
    this.followTargetBoatId = null
    this.lastKnownFollowBoatId = null
    this.autoBoardedVehicleId = null
    this.confirmedFollowBoatId = null
    this.boatPassengers.clear()
    this.autoVehiclePaused = false
    this.vehicleOperation++
    this.emit('vehicle', false)
    this.stopUpdates()
    this.following = false
    this.targetName = null
	this.followEntity = null
    this.movements = null
    this.bot = null
    this.disconnecting = false
	this.authorizedPlayer = null

  }
}

module.exports = BotManager
