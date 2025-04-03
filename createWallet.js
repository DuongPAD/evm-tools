// const { ethers } = require('ethers')
const generalHelper = require('./helpers/general')
const EthersUtil = require('./helpers/ethers')

async function start() {
  while (true) {
    let numBatch = 10 // Number of wallets
    for (let i = 0; i < numBatch; i++) {
      await EthersUtil.createAndSaveWallet()
      await generalHelper.sleep(1 * 1000)
      if (i === numBatch - 1) return;
    }
  }
}

start()
