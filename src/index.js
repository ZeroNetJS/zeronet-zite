'use strict'

const pull = require('pull-stream')

const verify = require('zeronet-common/lib/verify')
const Nonces = require('zeronet-common/lib/nonce')

const Pool = require('zeronet-common/lib/peer/pool').ZitePool
const Queue = require('./queue')
const Tree = require('./tree')
const PeerStream = require('./peer-stream')

const series = require('async/series')
const each = require('async/each')

const Discovery = require('./discovery')
const Dtracker = require('./discovery/tracker')
const Dpex = require('./discovery/pex')
const Ddht = require('./discovery/dht')

const JSONStream = require('./file/json')

/**
 * ZeroNet Zite
 * @param {object} config - configuration of the Zite
 * @param {ZeroNetNode} node - ZeroNet Node
 * @namespace Zite
 * @constructor
 */
const Zite = module.exports = function Zite (config, node) { // describes a single zite
  const self = this

  if (!verify.verifyAddress(config.address)) {
    throw new Error('Invalid address')
  }

  if (!config.wrapper_key) config.wrapper_key = verify.genNonce()

  self.config = config

  const address = self.address = config.address
  node.addZite(address, self)

  /* Nonce */

  const nonce = new Nonces()
  self.getNonce = nonce.add
  self.redemNonce = nonce.redem

  /* Peers */

  const discovery = self.discovery = new Discovery(self, node, config.discovery || [
    Dtracker,
    Dpex,
    Ddht
  ])
  self.pool = new Pool(node.peerPool, address)
  const tree = self.tree = new Tree(self, config.tree)
  const queue = self.queue = new Queue(self, node)
  tree.attach(node.storage)
  const fs = self.fs = tree.fs
  new PeerStream(self) // eslint-disable-line no-new

  /* App */

  /* function handleGet(req, res, next) {
    //const path=req.url
  } */

  function liftOff (cb) { // ...and the zite is downloading
    if (tree.get('content.json').dummy) {
      fs.getFile('content.json', (err, stream) => { // load the content json first time
        if (err) return cb(err)
        pull(
          stream,
          JSONStream.parse(),
          pull.drain(data => tree.handleContentJSON('content.json', data) && cb())
        )
      })
    } else {
      self.downloadLoop()
    }
  }

  self.downloadLoop = () => {
    if (config.manual) return
    each(tree.getAll(), (path, next) => {
      if (queue.inQueue(path)) return next()
      const i = tree.get(path)
      if (i.files) return next()
      if (i.file.optional) return next()
      if (i.version) return next()
      queue.add(i.file.info, (err, stream) => {
        if (err) return next()
        pull(
          stream,
          pull.through(() => {}, e => {
            if (e) return console.error(e)
            i.version = i.authority.version
            node.logger('node')('Downloaded %s', i.path)
          }),
          tree.storage.writeStream(tree.zite.address, 0, i.path.replace(/^\//, ''))
        )
      })
    }, err => err ? console.error(err) : null)
  }

  /* Main */

  self.start = cb => series([
    discovery.start,
    cb => tree.build(cb),
    queue.start,
    config.manual ? cb => cb() : liftOff
  ], cb)

  self.stop = cb => series([
    queue.stop,
    discovery.stop
  ], cb)

  /* JSON */

  /**
   * Converts the site to json
   * @returns {object}
   * @category Zite
   */
  self.toJSON = () => {
    config.tree = tree.toJSON()
    return config
  }
}

module.exports.fromJSON = zeronet =>
  (data, cb) =>
    cb(null, new Zite(data, zeronet))
