const fs = require('fs');
const { ethers } = require('ethers');

const inputFile = 'wallet-monad.json';
const outputFile = 'wallet-balances.csv';

const provider = new ethers.providers.JsonRpcProvider('https://testnet-rpc.monad.xyz');

const wallets = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

fs.writeFileSync(outputFile, 'address,balance\n');

async function checkBalances() {
  for (const wallet of wallets) {
    const address = wallet.address;
    try {
      const balanceWei = await provider.getBalance(address);
      const balanceEth = ethers.utils.formatEther(balanceWei);
      fs.appendFileSync(outputFile, `${address},${balanceEth}\n`);
      console.log(`✅ ${address}: ${balanceEth} ETH`);
    } catch (err) {
      console.error(`❌ Failed to fetch balance for ${address}`);
      fs.appendFileSync(outputFile, `${address},ERROR\n`);
    }
  }

  console.log(`✅ All balances saved to "${outputFile}"`);
}

checkBalances();