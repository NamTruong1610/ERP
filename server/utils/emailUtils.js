exports.sendAccountActivationEmail = async (email, tokenId) => {
  await console.log(`Account Activation Token ${tokenId} send to email ${email} successfully!`);
}

exports.sendAccountRecoveryEmail = async (email, tokenId) => {
  await console.log(`Account Recovery Token ${tokenId} send to email ${email} successfully!`);
}