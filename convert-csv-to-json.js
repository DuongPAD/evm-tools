const fs = require('fs');
const csv = require('csv-parser');
const { ethers } = require('ethers');

const inputFile = 'WL_GPM t.csv';
const outputFile = 'wallet-monad.json';

const results = [];

fs.createReadStream(inputFile)
  .pipe(csv())
  .on('headers', (headers) => {
    // Convert headers to lowercase
    for (let i = 0; i < headers.length; i++) {
      headers[i] = headers[i].toLowerCase();
    }
  })
  .on('data', (data) => {
    // Convert keys to lowercase
    const lowerCasedData = {};
    for (let key in data) {
      lowerCasedData[key.toLowerCase()] = data[key];
    }

    // Nếu có mnemonic, generate wallet address
    if (lowerCasedData.mnemonic) {
      try {
        const wallet = ethers.Wallet.fromMnemonic(lowerCasedData.mnemonic);
        lowerCasedData.address = wallet.address;
        lowerCasedData.privateKey = wallet.privateKey;
      } catch (err) {
        console.error(`⚠️ Invalid mnemonic at row:`, lowerCasedData);
        lowerCasedData.address = null;
      }
    }

    results.push(lowerCasedData);
  })
  .on('end', () => {
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`✅ Converted CSV to JSON with wallet addresses -> ${outputFile}`);
  });