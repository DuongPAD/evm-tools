// mint-contract.js
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

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
 * Gọi hàm mint của smart contract
 * @param {string} privateKey - Private key của ví
 * @param {string} walletAddress - Địa chỉ ví người gọi
 * @param {string} contractAddress - Địa chỉ smart contract
 * @param {number} quantity - Số lượng token muốn mint (tham số #1)
 * @param {string} referralAddress - Địa chỉ ví giới thiệu (tham số #2)
 * @param {ethers.providers.Provider} provider - Provider đã kết nối
 * @param {ethers.BigNumber|string} value - Số lượng MON gửi đi (nếu cần)
 */
async function mintToken(privateKey, walletAddress, contractAddress, quantity, referralAddress, provider, value = "0") {
  try {
    // Tạo ví từ private key
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Kiểm tra xem địa chỉ ví có khớp không
    if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
      console.warn(`Warning: Provided wallet address ${walletAddress} does not match the derived address ${wallet.address} from private key`);
    }
    
    console.log(`Using wallet: ${wallet.address}`);
    
    // ABI cho hàm mint - chỉ định nghĩa hàm mint mà chúng ta cần gọi
    const mintABI = [
      "function mint(uint256 _quantity, address _referral) payable"
    ];
    
    // Kết nối với smart contract
    const contract = new ethers.Contract(contractAddress, mintABI, wallet);
    
    // Chuyển đổi value sang BigNumber nếu cần
    const valueToSend = typeof value === 'string' ? ethers.utils.parseEther(value) : value;
    
    console.log(`Minting ${quantity} token(s) with referral: ${referralAddress}`);
    console.log(`Sending value: ${ethers.utils.formatEther(valueToSend)} MON`);
    
    // Tạo transaction option
    const options = {
      gasLimit: 300000, // Gas limit mặc định
      value: valueToSend
    };
    
    // Gọi hàm mint với các tham số
    const tx = await contract.mint(quantity, referralAddress, options);
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
 * Thực hiện mint qua data thuần
 * @param {string} privateKey - Private key của ví
 * @param {string} walletAddress - Địa chỉ ví người gọi
 * @param {string} contractAddress - Địa chỉ smart contract
 * @param {string} data - Data đã được encode cho transaction
 * @param {ethers.providers.Provider} provider - Provider đã kết nối
 * @param {ethers.BigNumber|string} value - Số lượng MON gửi đi (nếu cần)
 */
async function mintWithRawData(privateKey, walletAddress, contractAddress, data, provider, value = "0") {
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
    if (data.startsWith('0x94bf804d')) {
      console.log("Recognized function: mint(uint256,address)");
      
      // Hiển thị các tham số từ data
      try {
        const abiCoder = new ethers.utils.AbiCoder();
        const functionSig = data.slice(0, 10); // 0x + 8 ký tự
        const paramsData = '0x' + data.slice(10);
        
        const decodedParams = abiCoder.decode(['uint256', 'address'], paramsData);
        console.log(`Decoded params: quantity=${decodedParams[0]}, referral=${decodedParams[1]}`);
      } catch (e) {
        console.log("Could not decode parameters from data");
      }
    }
    
    // Chuyển đổi value sang BigNumber nếu cần
    const valueToSend = typeof value === 'string' ? ethers.utils.parseEther(value) : value;
    
    console.log(`Sending value: ${ethers.utils.formatEther(valueToSend)} MON`);
    
    // Tạo transaction
    const tx = {
      to: contractAddress,
      data: data,
      value: valueToSend,
      gasLimit: 300000 // Gas limit mặc định
    };
    
    // Ước tính gas nếu có thể
    try {
      const gasEstimate = await provider.estimateGas({
        ...tx,
        from: wallet.address
      });
      
      console.log(`Estimated gas: ${gasEstimate.toString()}`);
      tx.gasLimit = gasEstimate.mul(120).div(100); // Thêm 20% buffer
    } catch (error) {
      console.warn(`Could not estimate gas: ${error.message}`);
      console.warn("Using default gas limit");
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
  quantity,
  referralAddress,
  providerUrl,
  valuePerMint = "3.49",
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
    console.log(`Quantity: ${quantity}`);
    console.log(`Referral: ${referralAddress}`);
    
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);
    const allResults = [];
    
    // Chuẩn bị raw data nếu sử dụng phương pháp này
    let rawData = "";
    if (useRawData) {
      // Encode tham số cho hàm mint(uint256,address)
      const abiCoder = new ethers.utils.AbiCoder();
      const functionSelector = "0x94bf804d"; // Selector cho hàm mint(uint256,address)
      
      // Encode các tham số
      const params = abiCoder.encode(
        ['uint256', 'address'],
        [quantity, referralAddress]
      );
      
      // Loại bỏ '0x' từ params để nối với function selector
      rawData = functionSelector + params.slice(2);
      console.log(`Generated raw data: ${rawData}`);
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
          provider,
          valuePerMint
        );
      } else {
        result = await mintToken(
          wallet.privateKey,
          wallet.address,
          contractAddress,
          quantity,
          referralAddress,
          provider,
          valuePerMint
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
  const contractAddress = "0xDF658971bA939e142853f21DA600561754399B8A"; // Địa chỉ contract
  const quantity = 1; // Số lượng token muốn mint (param #1)
  const referralAddress = "0xB0C3B4C608a786a5c1B65dab42945Ca4bbDCD7F4"; // Địa chỉ ví giới thiệu (param #2)
  const valuePerMint = "3.49"; // Số MON gửi kèm mỗi giao dịch mint (nếu cần)
  
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
      console.log(`Using raw data: 0x94bf804d0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000f8dd242cf234ecfcbfaba05e35fef5ff57cb9c0b`);
    } else {
      console.log(`Mint parameters: quantity=${quantity}, referral=${referralAddress}`);
    }
    
    // Chạy quy trình xử lý mint cho nhiều ví
    const results = await processMintForMultipleWallets(
      walletsFilePath,
      contractAddress,
      quantity,
      referralAddress,
      providerUrl,
      valuePerMint,
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