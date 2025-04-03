const { ethers } = require('ethers')
const crypto = require('crypto')
const bip39 = require('bip39')
const generalHelper = require('../helpers/general')
const config = require('config')
const web3 = require('web3')
const fs = require('fs').promises;

let provider = new ethers.providers.JsonRpcProvider(config.get('rpc'))

let EthersUtil = {
  generateRandomBytes: (l) => {
    return crypto.randomBytes(l)
  },
  generateMnemonic: () => {
    return bip39.generateMnemonic()
  },

  // Validate Mnemonic. return boolean
  validateMnemonic: (mnemonic) => {
    return bip39.validateMnemonic(mnemonic)
  },

  checkBalance: async (address) => {
    let balance = await provider.getBalance(address)
    balance = ethers.utils.formatEther(balance)
    return balance
  },

  createWallet: async () => {
    try {
      const mnemonic = bip39.generateMnemonic()
      const newWallet = await ethers.Wallet.fromMnemonic(mnemonic)
      return {
        address: newWallet.address,
        mnemonic: newWallet.mnemonic.phrase,
        privateKey: newWallet.privateKey,
        lastUpdated: generalHelper.now(),
      }
    } catch (e) {
      console.log(e)
    }
  },

  createAndSaveWallet: async () => {
    try {
      let _wallet = await EthersUtil.createWallet();
      const walletsFile = 'wallets.json';
      let wallets = [];

      try {
        const data = await fs.readFile(walletsFile, 'utf8');
        wallets = JSON.parse(data);

        if (!Array.isArray(wallets)) {
          wallets = [];
        }
      } catch (err) {
        wallets = [];
      }

      wallets.push(_wallet);
      await fs.writeFile(walletsFile, JSON.stringify(wallets, null, 2), 'utf8');

      console.log(`Wallet created and saved. Total wallets: ${wallets.length}`);
      return _wallet;
    } catch (e) {
      console.log('Error creating or saving wallet:', e);
      await generalHelper.sleep(5 * 1000);
      return null;
    }
  },

  /**
   * Send native token(SHM)
   * @param  {string} privateKey Private Key.
   * @param  {string} receiveAccount Receive Account.
   * @param  {boolean} sendAll true if you want to send all token to receive account. Default: false.
   * @param  {string} amount Amount you want to send. If you set sendAll: true, it doesn't matter anymore.
   * @param  {number} sleepTime The time sleep after run function.
   * @param  {number} minus Number of tokens you want to keep in your wallet. Default: 1
   * @return {number} Status of transaction.
   */
  sendToken: async (privateKey, receiveAccount, sendAll = false, amount = '10', sleepTime = 15, minus = 0.5) => {
    let wallet = new ethers.Wallet(privateKey)
    let walletSigner = wallet.connect(provider)
    const sendAccount = wallet.address
    let balance = await provider.getBalance(sendAccount)
    let _amount
    if (sendAll) {
      // Send All = Balance - 0.5 SHM
      balance = ethers.utils.formatEther(balance)
      balance = Number(balance) - minus
      balance = ethers.utils.parseEther(balance.toString())
      _amount = balance
    } else {
      _amount = ethers.utils.parseEther(amount.toString())
    }

    // transaction info
    let tx = {
      from: sendAccount,
      to: receiveAccount,
      gasLimit: web3.utils.toHex(2100000),
      gasPrice: web3.utils.toHex(web3.utils.toWei('30', 'gwei')),
      value: _amount,
      nonce: await provider.getTransactionCount(sendAccount, 'latest'),
    }

    try {
      await walletSigner.sendTransaction(tx).then((transaction) => {
        console.log(`Send ${amount}SHM - ${generalHelper.now()}`)
        console.log('transaction', transaction)
        console.log('successfully')
        return 'successfully'
      })
    } catch (e) {
      return 'failed'
    } finally {
      console.log(`sleep 60 seconds and wait to continue`)
      console.log('================================================')
      await generalHelper.sleep(60 * 1000)
    }
  },

  /**
   * Check and update data balance for all wallet on database
   */
  updateBalanceBatch: async (addresses) => {
    for (const address of addresses) {
      const balance = await EthersUtil.checkBalance(address.address)
      // await db.Wallet.updateOne(
      //   { address: address },
      //   {
      //     $set: {
      //       balance: balance.toString(),
      //       lastUpdated: generalHelper.now(),
      //     },
      //   },
      //   { upsert: true, new: true },
      // )
      console.log(`${address.name} balance of ${address.address} `, balance)
      await generalHelper.sleep(2 * 1000)
    }
  },

  /**
   * Get wallet address from private key
   * @param  {string} privateKey Private Key.
   * @return {string} Wallet address.
   */
  getAddressFromPrivateKey: (privateKey) => {
    const wallet = new ethers.Wallet(privateKey)
    return wallet.address
  },
}

module.exports = EthersUtil
