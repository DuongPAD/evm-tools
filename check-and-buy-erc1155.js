// check-and-buy-nft-multi-wallet.js
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
 * Kiểm tra NFT ERC1155 với ID cụ thể
 */
async function checkSpecificERC1155Token(walletAddress, contractAddress, tokenId, provider, name = '') {
  try {
    const erc1155ABI = [
      "function balanceOf(address account, uint256 id) view returns (uint256)",
      "function uri(uint256 id) view returns (string)"
    ];

    const nftContract = new ethers.Contract(contractAddress, erc1155ABI, provider);

    const balance = await nftContract.balanceOf(walletAddress, tokenId);
    const balanceValue = balance.toString();

    if (balanceValue > 0) {
      let tokenUri = "";
      try {
        tokenUri = await nftContract.uri(tokenId);
        tokenUri = tokenUri.replace("{id}", ethers.utils.hexZeroPad(ethers.utils.hexlify(tokenId), 32).slice(2));
      } catch (error) {
        tokenUri = "can not get URI";
      }

      return {
        contractAddress,
        id: tokenId,
        balance: balanceValue,
        uri: tokenUri,
        owned: true,
        name: name || ''
      };
    } else {
      return {
        contractAddress,
        id: tokenId,
        balance: "0", 
        uri: "",
        owned: false,
        name: name || ''
      };
    }
  } catch (error) {
    console.error(`Error: token ID ${tokenId} of ${contractAddress}:`, error.message);
    return {
      contractAddress,
      id: tokenId,
      balance: "0",
      uri: "",
      owned: false,
      error: error.message,
      name: name || ''
    };
  }
}

/**
 * Kiểm tra nhiều NFT ERC1155 với ID cụ thể
 */
async function checkMultipleSpecificERC1155Tokens(walletAddress, nftList, provider) {
  try {
    const results = [];
    
    console.log(`Checking ${nftList.length} NFT of wallet: ${walletAddress}`);
    
    for (const nft of nftList) {
      const { contractAddress, tokenId, name } = nft;

      if (tokenId !== undefined) {
        console.log(`Checking NFT ${name || ''}: ${contractAddress}:${tokenId}`);
        const result = await checkSpecificERC1155Token(walletAddress, contractAddress, tokenId, provider, name);
        results.push(result);
        
        // Chờ một chút giữa các lần kiểm tra để tránh rate limit blockchain
        await sleep(300);
      }
    }
    
    return results;
  } catch (error) {
    console.error('An error occurred while checking the NFT list:', error);
    throw error;
  }
}

/**
 * Thực hiện giao dịch mua NFT từ MagicEden
 */
async function executeMagicEdenBuy(privateKey, transactionData, provider) {
  try {
    // Tạo ví từ private key
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`Using address: ${wallet.address}`);
    
    // Lấy dữ liệu từ response API
    const { from, to, data, value } = transactionData;
    
    // Kiểm tra xem người gửi có đúng với ví hiện tại không
    if (wallet.address.toLowerCase() !== from.toLowerCase()) {
      console.warn(`Warning: Wallet address (${wallet.address}) is different from "from" address in data (${from})`);
    }
    
    // Kiểm tra số dư
    const balance = await wallet.getBalance();
    const valueInWei = ethers.BigNumber.from(value);
    const valueInMON = parseFloat(ethers.utils.formatEther(valueInWei));
    if (valueInMON > 70) {
      throw new Error(`Price ${valueInMON} MON exceeds maximum limit of 70 MON`);
    }
    
    if (balance.lt(valueInWei)) {
      throw new Error(`Insufficient balance. Need ${ethers.utils.formatEther(valueInWei)} but only have ${ethers.utils.formatEther(balance)}`);
    }
    
    // Tạo giao dịch
    const tx = {
      to: to,
      data: data,
      value: valueInWei,
      gasLimit: ethers.BigNumber.from(300000) // Tăng giới hạn gas để đảm bảo an toàn
    };
    
    // Ước tính phí gas
    try {
      const gasEstimate = await provider.estimateGas(tx);
      console.log(`Gas estimate: ${gasEstimate.toString()}`);
      
      // Cập nhật giới hạn gas dựa trên ước tính
      tx.gasLimit = gasEstimate.mul(12).div(10); // Thêm 20% buffer
    } catch (error) {
      console.warn(`Cannot estimate gas, using default value: ${tx.gasLimit.toString()}`);
      console.warn(`Gas estimation error: ${error.message}`);
    }
    
    // Gửi giao dịch
    console.log(`Sending transaction to buy NFT...`);
    console.log(`Value: ${ethers.utils.formatEther(valueInWei)} ETH/MON`);
    
    const txResponse = await wallet.sendTransaction(tx);
    console.log(`Transaction sent: ${txResponse.hash}`);
    console.log(`Waiting for confirmation...`);
    
    // Chờ giao dịch được xác nhận
    const receipt = await txResponse.wait();
    console.log(`Transaction successful! Block: ${receipt.blockNumber}`);
    
    // Kiểm tra trạng thái giao dịch
    if (receipt.status === 1) {
      console.log(`✅ Transaction successful!`);
    } else {
      console.error(`❌ Transaction failed!`);
    }
    
    return receipt;
  } catch (error) {
    console.error('Error executing transaction:', error);
    throw error;
  }
}

/**
 * Gọi API MagicEden để lấy dữ liệu giao dịch với xử lý thử lại
 */
async function fetchMagicEdenBuyData(buyParams, apiUrl, maxRetries = 3, retryDelay = 5000) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Calling MagicEden API for NFT: ${buyParams.items[0].key} (Attempt ${attempt}/${maxRetries})`);

      // Tạo request mới với headers ngẫu nhiên để tránh bị coi là bot
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': `Mozilla/5.0 NFT-Buyer/1.0 (Attempt ${attempt})`,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'X-Request-ID': `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(buyParams)
      });

      // Kiểm tra lỗi HTTP
      if (!response.ok) {
        const statusText = `API responded with status: ${response.status} (${response.statusText})`;
        
        if (response.status === 403) {
          console.warn(`❌ Forbidden (403) error received. MagicEden might be rate limiting requests.`);
          console.log(`Waiting for ${retryDelay/1000} seconds before retrying...`);
          await sleep(retryDelay);
          continue; // Thử lại
        }
        
        if (response.status === 429) {
          const waitTime = retryDelay * attempt; // Tăng thời gian chờ theo số lần thử
          console.warn(`❌ Rate limit (429) exceeded. Waiting for ${waitTime/1000} seconds...`);
          await sleep(waitTime);
          continue; // Thử lại
        }
        
        throw new Error(statusText);
      }
      
      // Xử lý dữ liệu trả về
      const responseData = await response.json();
      
      // Kiểm tra xem response có đúng định dạng không
      if (!responseData.steps || !responseData.steps[0] || !responseData.steps[0].items || !responseData.steps[0].items[0]) {
        throw new Error('Invalid response data format');
      }
      
      // Thành công, trả về dữ liệu
      return responseData.steps[0].items[0].data;
    } catch (error) {
      console.error(`Error on API call attempt ${attempt}:`, error.message);
      lastError = error;
      
      // Nếu không phải lần thử cuối cùng, chờ và thử lại
      if (attempt < maxRetries) {
        const waitTime = retryDelay * attempt; // Tăng thời gian chờ theo số lần thử
        console.log(`Waiting for ${waitTime/1000} seconds before retry...`);
        await sleep(waitTime);
      }
    }
  }
  
  // Nếu đã hết số lần thử, ném ra lỗi cuối cùng
  throw lastError || new Error('Maximum retry attempts reached');
}

/**
 * Tích hợp quy trình từ API đến thực hiện giao dịch
 */
async function fulfillMagicEdenOrder(privateKey, buyParams, provider, apiUrl) {
  try {
    // Bước 1: Gọi API để lấy dữ liệu giao dịch
    console.log('Calling MagicEden API to get transaction data...');
    const transactionData = await fetchMagicEdenBuyData(buyParams, apiUrl);
    
    // Bước 2: Thực hiện giao dịch với dữ liệu nhận được
    console.log('Got transaction data, executing NFT purchase...');
    const receipt = await executeMagicEdenBuy(privateKey, transactionData, provider);
    
    return {
      success: true,
      receipt: receipt,
      nftKey: buyParams.items[0].key
    };
  } catch (error) {
    console.error('Error buying NFT from MagicEden:', error);
    return {
      success: false,
      error: error.message,
      nftKey: buyParams.items[0].key
    };
  }
}

/**
 * Chức năng chính: Kiểm tra và mua NFT chưa sở hữu
 * @param {string} privateKey - Private key của ví
 * @param {string} walletAddress - Địa chỉ ví
 * @param {Array} nftList - Danh sách NFT cần kiểm tra và mua
 * @param {string} providerUrl - URL của provider
 * @param {string} apiUrl - URL của API MagicEden
 * @param {number} apiDelayMs - Thời gian chờ giữa các lần gọi API (mặc định: 10000ms)
 * @param {number} transactionDelayMs - Thời gian chờ giữa các giao dịch (mặc định: 10000ms)
 */
async function checkAndBuyNFTs(privateKey, walletAddress, nftList, providerUrl, apiUrl, apiDelayMs = 3000, transactionDelayMs = 10000) {
  try {
    // Kết nối với blockchain
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);
    
    // Bước 1: Kiểm tra NFT nào chưa được sở hữu
    console.log('===== STEP 1: CHECKING NFT OWNERSHIP =====');
    const checkResults = await checkMultipleSpecificERC1155Tokens(walletAddress, nftList, provider);
    
    // Lọc ra các NFT chưa sở hữu
    const nftsNotOwned = checkResults.filter(result => !result.owned);
    
    console.log('\n===== NFT CHECK RESULTS =====');
    checkResults.forEach((result, index) => {
      console.log(`\n[${index + 1}] NFT: ${result.name || `${result.contractAddress}:${result.id}`}`);
      console.log(`    Status: ${result.owned ? '✅ Owned' : '❌ Not Owned'}`);
      console.log(`    Balance: ${result.balance}`);
    });
    
    // Nếu đã sở hữu tất cả NFT, kết thúc
    if (nftsNotOwned.length === 0) {
      console.log('\n✅ All NFTs are already owned. No purchase needed.');
      return {
        walletAddress,
        checkResults,
        purchaseResults: []
      };
    }
    
    // Bước 2: Mua những NFT chưa sở hữu
    console.log(`\n===== STEP 2: BUYING ${nftsNotOwned.length} NFTs NOT OWNED =====`);
    
    const purchaseResults = [];
    for (let i = 0; i < nftsNotOwned.length; i++) {
      const nft = nftsNotOwned[i];
      console.log(`\nAttempting to buy NFT: ${nft.name || `${nft.contractAddress}:${nft.id}`}`);
      
      // Tạo tham số cho API MagicEden
      const buyParams = {
        "currency": "0x0000000000000000000000000000000000000000",
        "currencyChainId": 10143,
        "items": [
          {
            "key": `${nft.contractAddress}:${nft.id}`,
            "token": `${nft.contractAddress}:${nft.id}`,
            "is1155": true,
            "source": "magiceden.io",
            "fillType": "trade",
            "quantity": 1
          }
        ],
        "taker": walletAddress,
        "source": "magiceden.io",
        "partial": true,
        "normalizeRoyalties": false
      };
      
      try {
        // Thực hiện mua NFT
        const purchaseResult = await fulfillMagicEdenOrder(privateKey, buyParams, provider, apiUrl);
        purchaseResult.nft = nft; // Thêm thông tin NFT vào kết quả
        purchaseResults.push(purchaseResult);
      } catch (error) {
        console.error(`Failed to buy NFT ${nft.name}: ${error.message}`);
        purchaseResults.push({
          success: false,
          error: error.message,
          nft: nft,
          nftKey: `${nft.contractAddress}:${nft.id}`
        });
      }

      // Chờ trước khi chuyển sang NFT tiếp theo - LUÔN CHỜ kể cả khi gặp lỗi
      if (i < nftsNotOwned.length - 1) {
        console.log(`\nWaiting ${transactionDelayMs/1000} seconds before next purchase to avoid rate limits...`);
        await sleep(transactionDelayMs);
      }
    }
    
    // Bước 3: Tổng kết kết quả
    console.log('\n===== STEP 3: PURCHASE SUMMARY =====');
    
    const successfulPurchases = purchaseResults.filter(result => result.success);
    const failedPurchases = purchaseResults.filter(result => !result.success);
    
    console.log(`Wallet: ${walletAddress}`);
    console.log(`Total NFTs checked: ${checkResults.length}`);
    console.log(`Already owned: ${checkResults.length - nftsNotOwned.length}`);
    console.log(`Needed to purchase: ${nftsNotOwned.length}`);
    console.log(`Successfully purchased: ${successfulPurchases.length}`);
    console.log(`Failed to purchase: ${failedPurchases.length}`);
    
    if (failedPurchases.length > 0) {
      console.log('\nFailed purchases:');
      failedPurchases.forEach((result, index) => {
        console.log(`  [${index + 1}] ${result.nft.name || `${result.nft.contractAddress}:${result.nft.id}`}`);
        console.log(`      Error: ${result.error}`);
      });
    }
    
    return {
      walletAddress,
      checkResults,
      purchaseResults
    };
    
  } catch (error) {
    console.error(`Error in checkAndBuyNFTs for wallet ${walletAddress}:`, error);
    return {
      walletAddress,
      error: error.message,
      success: false
    };
  }
}

/**
 * Xử lý nhiều ví từ file JSON
 */
async function processMultipleWallets(walletsFilePath, nftList, providerUrl, apiUrl, apiDelayMs = 3000, transactionDelayMs = 10000, walletDelayMs = 15000) {
  try {
    // Đọc file JSON
    const wallets = loadWalletsFromJson(walletsFilePath);
    
    // Kiểm tra định dạng dữ liệu
    if (!Array.isArray(wallets)) {
      throw new Error('Wallet data must be an array');
    }
    
    console.log(`Processing ${wallets.length} wallets...`);
    
    const allResults = [];
    
    // Xử lý từng ví
    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      
      // Kiểm tra dữ liệu ví
      if (!wallet.privateKey || !wallet.address) {
        console.error(`Skipping wallet ${i+1}: Missing privateKey or address`);
        continue;
      }
      
      console.log(`\n===== PROCESSING WALLET ${i+1}/${wallets.length}: ${wallet.address} =====`);
      
      // Thực hiện kiểm tra và mua NFT
      const walletResult = await checkAndBuyNFTs(
        wallet.privateKey, 
        wallet.address, 
        nftList, 
        providerUrl, 
        apiUrl, 
        apiDelayMs, 
        transactionDelayMs
      );
      
      allResults.push(walletResult);
      
      // Chờ trước khi chuyển sang ví tiếp theo
      if (i < wallets.length - 1) {
        console.log(`\nWaiting ${walletDelayMs/1000} seconds before processing next wallet...`);
        await sleep(walletDelayMs);
      }
    }
    
    return allResults;
  } catch (error) {
    console.error('Error processing multiple wallets:', error);
    throw error;
  }
}

// Hàm main để chạy script
async function main() {
  // Cấu hình
  const walletsFilePath = './wallet-monad.json'; // Đường dẫn đến file JSON chứa danh sách ví
  const providerUrl = 'https://testnet-rpc.monad.xyz'; // URL RPC của Monad testnet
  const apiUrl = 'https://api-mainnet.magiceden.io/v3/rtp/monad-testnet/execute/buy/v7'; // URL API của MagicEden
  
  // Các tham số thời gian
  const apiDelayMs = 3000;        // Chờ 3 giây giữa các lần gọi API
  const transactionDelayMs = 10000; // Chờ 10 giây giữa các giao dịch
  const walletDelayMs = 15000;     // Chờ 15 giây giữa các ví
  
  // Danh sách NFT cần kiểm tra
  const nftList = [
    {
      contractAddress: '0xe25c57ff3eea05d0f8be9aaae3f522ddc803ca4e',
      tokenId: '1',
      name: 'Monadverse: Chapter 1'
    },
    {
      contractAddress: '0x3a9acc3be6e9678fa5d23810488c37a3192aaf75',
      tokenId: '2',
      name: 'Monadverse: Chapter 2'
    },
    {
      contractAddress: '0xcab08943346761701ec9757befe79ea88dd67670',
      tokenId: '3',
      name: 'Monadverse: Chapter 3'
    },
    {
      contractAddress: '0xba838e4cca4b852e1aebd32f248967ad98c3aa45',
      tokenId: '5',
      name: 'Monadverse: Chapter 4'
    },
    {
      contractAddress: '0x5d2a7412872f9dc5371d0cb54274fdb241171b95',
      tokenId: '6',
      name: 'Monadverse Chapter 5'
    },
    {
      contractAddress: '0x813fa68dd98f1e152f956ba004eb2413fcfa7a7d',
      tokenId: '7',
      name: 'Monadverse: Chapter 6'
    },
    {
      contractAddress: '0xc29b98dca561295bd18ac269d3d9ffdfcc8ad426',
      tokenId: '9',
      name: 'Monadverse: Chapter 7'
    },
    {
      contractAddress: '0xce3be27bdf0922e92bbf3c2eefbb26487946ed4c',
      tokenId: '12',
      name: 'Monadverse: Chapter 8'
    }
  ];
  
  try {
    console.log('===== NFT CHECKER AND BUYER FOR MULTIPLE WALLETS =====');
    console.log(`Provider: ${providerUrl}`);
    console.log(`API URL: ${apiUrl}`);
    console.log(`Transaction delay: ${transactionDelayMs/1000} seconds`);
    console.log(`Wallet processing delay: ${walletDelayMs/1000} seconds`);
    
    // Chạy quy trình xử lý nhiều ví
    const results = await processMultipleWallets(
      walletsFilePath,
      nftList,
      providerUrl,
      apiUrl,
      apiDelayMs,
      transactionDelayMs,
      walletDelayMs
    );
    
    // Tổng kết kết quả
    console.log('\n===== FINAL SUMMARY =====');
    console.log(`Total wallets processed: ${results.length}`);
    
    const successfulWallets = results.filter(r => !r.error);
    const failedWallets = results.filter(r => r.error);
    
    console.log(`Successful wallet processes: ${successfulWallets.length}`);
    console.log(`Failed wallet processes: ${failedWallets.length}`);
    
    // Lưu kết quả vào file
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const resultFilePath = `./results-${timestamp}.json`;
    
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