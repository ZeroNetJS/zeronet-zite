'use strict'

const crypto = require('zeronet-crypto')
const fallaby = require('zeronet-fallaby/lib')
const File = require('./file')
const path = require('path')

/**
 * Zite content.json
 * @param {Zite} zite
 * @param {string} innerPath - Path of the content.json
 * @param {object} data - JSON parsed data of the content.json
 * @namespace ContentJSON
 * @constructor
 */
module.exports = function ContentJSON (zite, innerPath, data) {
  const self = this

  const rules = self.rules = zite.tree.getRuleBook(innerPath, data)
  const newfmt = fallaby.contentJson.process(data)
  self.version = data.modified

  self.verifySelf = () => {
    /*
    data is an object.
    we need to get the signing data from the object and remove the signs
    it's keys need to be sorted alphapetically and then stringified without whitespace
    */
    const {
      signs,
      signers_sign
    } = data

    delete data.sign
    delete data.signs

    const real = crypto.PythonJSONDump(data) // the data that was actually signed

    const vs = rules.signs.getValidKeys() // GetValidSigners(address, innerPath, data) //valid signers
    const signsRequired = rules.signs.getSignsRequired()
    const signersSignData = crypto.GetSigners(vs, signsRequired) // construct signers_sign data from what we were given

    // these 2 functions throw on failure. no need for if checks
    rules.signers_sign.verifyManyToOne(signersSignData, signers_sign)
    rules.signs.verifyManyToMany(real, signs)

    return true
  }

  /* self.verifyFile = (path, hash, size) => {

  } */

  /* self.getValidSigners = () => {
    let valid_signers = []
    if (innerPath == "content.json") {
      if (data.signers) valid_signers = Object.keys(data.signers)
    } else {
      //TODO: multi-user
    }
    if (valid_signers.indexOf(address) == -1) valid_signers.push(address) //Address is always a valid signer
    return valid_signers
  } */

  self.files = newfmt.files.map(d => new File(zite, path.join(path.dirname(innerPath), d.path), self, d))
}
