'use strict'

const path = require('path')

module.exports = function File (zite, innerPath, cj, data) {
  const self = this
  /* const name = */ self.name = path.basename(innerPath)
  self.path = innerPath
  self.relpath = data.path
  self.info = data
  self.info.site = zite.address
}
