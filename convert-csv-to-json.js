const fs = require('fs');
const csv = require('csv-parser');
const { ethers } = require('ethers');
const inputFile = 'WL_GPM t.csv';
const outputFile = 'wallet-monad.json';

// Đọc toàn bộ file và kiểm tra dấu phân cách
let fileContent = fs.readFileSync(inputFile, 'utf8');

// Nếu chứa dấu ; → replace thành ,
if (fileContent.includes(';')) {
  console.log('🔧 Detected ";" separator – converting to ","...');
  fileContent = fileContent.replace(/;/g, ',');
  fs.writeFileSync('__temp.csv', fileContent); // File tạm để parse tiếp
}

const results = [];
const finalInputFile = fileContent.includes(',') ? '__temp.csv' : inputFile;

fs.createReadStream(finalInputFile)
  .pipe(csv()) // Dấu , mặc định
  .on('data', (row) => {
    // Lowercase toàn bộ key
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
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`✅ Done! Output saved to "${outputFile}"`);

    // Xoá file tạm nếu có
    if (fs.existsSync('__temp.csv')) {
      fs.unlinkSync('__temp.csv');
    }
  });