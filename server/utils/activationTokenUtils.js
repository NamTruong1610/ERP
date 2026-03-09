const { v4: uuidv4 } = require('uuid')

exports.generateActivationTokenId = async () => {
  return await uuidv4();
}