const fs = require('fs');
const csv = require('csv-parser');
const { ethers } = require('ethers');

const inputFile = 'WL_GPM.csv';
const outputFile = 'wallet-monad.json';

let finalInputFile = inputFile; // Mặc định dùng file gốc

// Đọc toàn bộ file và kiểm tra dấu phân cách
let fileContent = fs.readFileSync(inputFile, 'utf8');

// Nếu chứa dấu ; → replace thành ,
if (fileContent.includes(';')) {
  console.log('🔧 Detected ";" separator – converting to ","...');
  fileContent = fileContent.replace(/;/g, ',');
  fs.writeFileSync('__temp.csv', fileContent);
  finalInputFile = '__temp.csv'; // Chỉ set nếu có tạo file tạm
}

const results = [];

fs.createReadStream(finalInputFile)
  .pipe(csv())
  .on('data', (row) => {
    const lowerRow = {};
    for (const key in row) {
      lowerRow[key.toLowerCase()] = row[key]?.trim();
    }

    const profile = lowerRow['profile name'];
    const rawInput = lowerRow['mnemonic'];
    if (!rawInput) return;

    try {
      let wallet;
      if (rawInput.includes(' ')) {
        wallet = ethers.Wallet.fromMnemonic(rawInput);
      } else {
        const privKey = rawInput.startsWith('0x') ? rawInput : `0x${rawInput}`;
        wallet = new ethers.Wallet(privKey);
      }

      results.push({
        profile,
        source: rawInput,
        address: wallet.address,
        privateKey: wallet.privateKey,
      });
    } catch (err) {
      console.error(`⚠️ Invalid input in profile "${profile}"`);
      results.push({
        profile,
        source: rawInput,
        address: null,
        privateKey: null,
        error: 'Invalid mnemonic or private key',
      });
    }
  })
  .on('end', () => {
    const resultsWithIndex = results.map((item, idx) => ({
      index: String(idx + 1).padStart(3, '0'),
      ...item,
    }));

    fs.writeFileSync(outputFile, JSON.stringify(resultsWithIndex, null, 2));
    console.log(`✅ Done! Output saved to "${outputFile}"`);

    if (finalInputFile === '__temp.csv' && fs.existsSync('__temp.csv')) {
      fs.unlinkSync('__temp.csv');
    }
  });