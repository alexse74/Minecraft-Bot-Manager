const net = require('net')
const dns = require('dns').promises
const path = require('path')
// Réutiliser le protocole déjà fourni par Mineflayer, sans dépendance ajoutée.
const protocol = require(require.resolve('minecraft-protocol', {
  paths: [path.dirname(require.resolve('@wp2508/mineflayer'))]
}))

async function checkServerStatus({ host, port }) {
  let finished = false
  let client
  let socket
  let timer
  try {
    const timeout = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Délai dépassé')), 5000)
    })
    const response = await Promise.race([timeout, protocol.ping({
      host,
      port: Number(port),
      closeTimeout: 5000,
      noPongTimeout: 500,
      connect: connection => {
        client = connection
        // Même résolution SRV que la connexion Minecraft sur le port par défaut.
        const connect = async () => {
          let address = host
          let targetPort = Number(port)
          if (targetPort === 25565 && !net.isIP(host) && host !== 'localhost') {
            try {
              const records = await dns.resolveSrv('_minecraft._tcp.' + host)
              if (records.length) {
                address = records[0].name
                targetPort = records[0].port
              }
            } catch { /* Sans SRV, utiliser l'adresse enregistrée. */ }
          }
          if (finished) return
          socket = net.connect(targetPort, address)
          connection.setSocket(socket)
        }
        connect().catch(error => connection.emit('error', error))
      }
    })])
    const count = response?.players?.online
    return {
      status: 'online',
      onlinePlayers: Number.isSafeInteger(count) && count >= 0 ? count : null
    }
  } catch {
    return { status: 'offline', onlinePlayers: null }
  } finally {
    finished = true
    clearTimeout(timer)
    client?.end()
    socket?.destroy()
  }
}

module.exports = checkServerStatus
