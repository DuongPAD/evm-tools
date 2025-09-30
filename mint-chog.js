// mint-contract.js
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const CONTRACT_ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  {
    "inputs": [
      { "internalType": "address", "name": "sender", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "address", "name": "owner", "type": "address" }
    ],
    "name": "ERC721IncorrectOwner",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "operator", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "ERC721InsufficientApproval",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "approver", "type": "address" }
    ],
    "name": "ERC721InvalidApprover",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "operator", "type": "address" }
    ],
    "name": "ERC721InvalidOperator",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" }
    ],
    "name": "ERC721InvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "receiver", "type": "address" }
    ],
    "name": "ERC721InvalidReceiver",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "sender", "type": "address" }
    ],
    "name": "ERC721InvalidSender",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "ERC721NonexistentToken",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "approved", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "operator", "type": "address" },
      { "indexed": false, "internalType": "bool", "name": "approved", "type": "bool" }
    ],
    "name": "ApprovalForAll",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "SBTBurned",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "SBTMinted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" }
    ],
    "name": "balanceOf",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address[]", "name": "recipients", "type": "address[]" }
    ],
    "name": "batchMintSBT",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "burnSBT",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "getApproved",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" }
    ],
    "name": "getTokenId",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" }
    ],
    "name": "hasSBT",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "operator", "type": "address" }
    ],
    "name": "isApprovedForAll",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "mintSBT",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" }
    ],
    "name": "mintSBTTo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "ownerOf",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "from", "type": "address" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "from", "type": "address" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "bytes", "name": "data", "type": "bytes" }
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "name": "setApprovalForAll",
    "outputs": [],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes4", "name": "interfaceId", "type": "bytes4" }
    ],
    "name": "supportsInterface",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "tokenURI",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "from", "type": "address" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "transferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "newOwner", "type": "address" }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "newImageURI", "type": "string" }
    ],
    "name": "updateImageURI",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const contractInterface = new ethers.utils.Interface(CONTRACT_ABI);
const DEFAULT_GAS_LIMIT = 120674;

/**
 * Hàm helper để tạm dừng thực thi trong một khoảng thời gian
 * @param {number} ms - Thời gian chờ tính bằng milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Đọc danh sách ví từ file JSON
 * @param {string} filePath - Đường dẫn đến file JSON
 */
function loadWalletsFromJson(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    console.log(`Loading wallets from: ${fullPath}`);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Wallet file not found: ${fullPath}`);
    }
    
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const wallets = JSON.parse(fileContent);
    
    console.log(`Loaded ${wallets.length} wallet(s) from file`);
    return wallets;
  } catch (error) {
    console.error('Error loading wallets from JSON:', error);
    throw error;
  }
}

/**
 * Gọi hàm mintSBT của smart contract
 * @param {string} privateKey - Private key của ví
 * @param {string} walletAddress - Địa chỉ ví người gọi
 * @param {string} contractAddress - Địa chỉ smart contract
 * @param {ethers.providers.Provider} provider - Provider đã kết nối
*/
async function mintToken(privateKey, walletAddress, contractAddress, provider) {
  try {
    // Tạo ví từ private key
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Kiểm tra xem địa chỉ ví có khớp không
    if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
      console.warn(`Warning: Provided wallet address ${walletAddress} does not match the derived address ${wallet.address} from private key`);
    }
    
    console.log(`Using wallet: ${wallet.address}`);
    
    // Kết nối với smart contract bằng ABI đầy đủ
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
    
    console.log('Calling mintSBT()');
    
    const options = {
      gasLimit: DEFAULT_GAS_LIMIT,
    };

    try {
      const gasEstimate = await contract.estimateGas.mintSBT();
      console.log(`Estimated gas: ${gasEstimate.toString()}`);
      options.gasLimit = gasEstimate;
    } catch (error) {
      console.warn(`Could not estimate gas via contract: ${error.message}`);
      console.warn(`Using default gas limit: ${DEFAULT_GAS_LIMIT}`);
    }
    
    const tx = await contract.mintSBT(options);
    console.log(`Transaction sent: ${tx.hash}`);
    
    // Chờ transaction được xác nhận
    console.log("Waiting for confirmation...");
    const receipt = await tx.wait();
    
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
    if (receipt.status === 1) {
      console.log("✅ Mint successful!");
    } else {
      console.log("❌ Mint failed!");
    }
    
    return {
      success: receipt.status === 1,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    };
  } catch (error) {
    console.error("Error minting token:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Thực hiện mintSBT qua data thuần
 * @param {string} privateKey - Private key của ví
 * @param {string} walletAddress - Địa chỉ ví người gọi
 * @param {string} contractAddress - Địa chỉ smart contract
 * @param {string} data - Data đã được encode cho transaction
 * @param {ethers.providers.Provider} provider - Provider đã kết nối
 */
async function mintWithRawData(privateKey, walletAddress, contractAddress, data, provider) {
  try {
    // Tạo ví từ private key
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Kiểm tra xem địa chỉ ví có khớp không
    if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
      console.warn(`Warning: Provided wallet address ${walletAddress} does not match the derived address ${wallet.address} from private key`);
    }
    
    console.log(`Using wallet: ${wallet.address}`);
    console.log(`Calling contract: ${contractAddress}`);
    console.log(`With data: ${data}`);
    
    // Phân tích data (chỉ để hiển thị)
    try {
      const parsedTx = contractInterface.parseTransaction({ data });
      console.log(`Recognized function: ${parsedTx.signature}`);

      if (parsedTx.args && parsedTx.args.length > 0) {
        const decoded = parsedTx.functionFragment.inputs
          .map((input, index) => {
            const label = input?.name || `arg${index}`;
            return `${label}=${parsedTx.args[index]}`;
          })
          .join(', ');

        console.log(`Decoded params: ${decoded}`);
      }
    } catch (decodeError) {
      console.warn('Could not parse transaction data with provided ABI');
    }
    
    // Tạo transaction
    const tx = {
      to: contractAddress,
      data: data,
      gasLimit: DEFAULT_GAS_LIMIT
    };

    // Ước tính gas nếu có thể
    try {
      const gasEstimate = await provider.estimateGas({
        ...tx,
        from: wallet.address
      });
      
      console.log(`Estimated gas: ${gasEstimate.toString()}`);
      tx.gasLimit = gasEstimate;
    } catch (error) {
      console.warn(`Could not estimate gas: ${error.message}`);
      console.warn(`Using default gas limit: ${DEFAULT_GAS_LIMIT}`);
    }
    
    // Gửi transaction
    const txResponse = await wallet.sendTransaction(tx);
    console.log(`Transaction sent: ${txResponse.hash}`);
    
    // Chờ transaction được xác nhận
    console.log("Waiting for confirmation...");
    const receipt = await txResponse.wait();
    
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
    if (receipt.status === 1) {
      console.log("✅ Transaction successful!");
    } else {
      console.log("❌ Transaction failed!");
    }
    
    return {
      success: receipt.status === 1,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    };
  } catch (error) {
    console.error("Error executing transaction:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Xử lý mint cho nhiều ví
 */
async function processMintForMultipleWallets(
  walletsFilePath,
  contractAddress,
  providerUrl,
  useRawData = false,
  walletDelayMs = 15000
) {
  try {
    // Đọc file JSON
    const wallets = loadWalletsFromJson(walletsFilePath);
    
    // Kiểm tra định dạng dữ liệu
    if (!Array.isArray(wallets)) {
      throw new Error('Wallet data must be an array');
    }
    
    console.log(`Processing ${wallets.length} wallet(s) for minting...`);
    console.log(`Contract: ${contractAddress}`);
    
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);
    const allResults = [];
    
    // Chuẩn bị raw data nếu sử dụng phương pháp này
    let rawData = "";
    if (useRawData) {
      rawData = '0x6798379c';
      console.log(`Using fixed raw data for mintSBT(): ${rawData}`);
    }
    
    // Xử lý từng ví
    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      
      // Kiểm tra dữ liệu ví
      if (!wallet.privateKey || !wallet.address) {
        console.error(`Skipping wallet ${i+1}: Missing privateKey or address`);
        continue;
      }
      
      console.log(`\n===== PROCESSING WALLET ${i+1}/${wallets.length}: ${wallet.address} =====`);
      
      // Thực hiện mint
      let result;
      if (useRawData) {
        result = await mintWithRawData(
          wallet.privateKey,
          wallet.address,
          contractAddress,
          rawData,
          provider
        );
      } else {
        result = await mintToken(
          wallet.privateKey,
          wallet.address,
          contractAddress,
          provider
        );
      }
      
      // Lưu kết quả
      allResults.push({
        walletAddress: wallet.address,
        ...result
      });
      
      // Chờ trước khi chuyển sang ví tiếp theo
      if (i < wallets.length - 1) {
        console.log(`\nWaiting ${walletDelayMs/1000} seconds before processing next wallet...`);
        await sleep(walletDelayMs);
      }
    }
    
    return allResults;
  } catch (error) {
    console.error('Error processing multiple wallets for minting:', error);
    throw error;
  }
}

// Hàm main để chạy script
async function main() {
  // Cấu hình
  const walletsFilePath = './wallet-monad.json'; // Đường dẫn đến file JSON chứa danh sách ví
  const providerUrl = 'https://testnet-rpc.monad.xyz'; // URL RPC của Monad testnet
  
  // Thông tin mint
  const contractAddress = "0x33C229aF3a6EAF37fF2F6aEA8cfD45f5431EeBf4"; // Địa chỉ contract
  
  // Sử dụng phương pháp nào (raw data hoặc hàm contract)
  const useRawData = true; // true: sử dụng data thuần, false: sử dụng contract interface
  
  // Thời gian chờ giữa các ví
  const walletDelayMs = 15000; // 15 giây
  
  try {
    console.log('===== MINT TOKENS FOR MULTIPLE WALLETS =====');
    console.log(`Provider: ${providerUrl}`);
    console.log(`Contract: ${contractAddress}`);
    console.log(`Method: ${useRawData ? 'Raw Data' : 'Contract Interface'}`);
    
    // Nếu sử dụng raw data, hiển thị data cố định
    if (useRawData) {
      console.log(`Using raw data for mintSBT(): 0x6798379c`);
    } else {
      console.log('Mint parameters: using mintSBT()');
    }
    
    // Chạy quy trình xử lý mint cho nhiều ví
    const results = await processMintForMultipleWallets(
      walletsFilePath,
      contractAddress,
      providerUrl,
      useRawData,
      walletDelayMs
    );
    
    // Tổng kết kết quả
    console.log('\n===== FINAL SUMMARY =====');
    console.log(`Total wallets processed: ${results.length}`);
    
    const successfulMints = results.filter(r => r.success).length;
    const failedMints = results.filter(r => !r.success).length;
    
    console.log(`Successful mints: ${successfulMints}`);
    console.log(`Failed mints: ${failedMints}`);
    
    // Lưu kết quả vào file
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const resultFilePath = `./mint-results-${timestamp}.json`;
    
    fs.writeFileSync(resultFilePath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${resultFilePath}`);
    
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Chạy script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
