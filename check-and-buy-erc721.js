// buy-erc721-nft.js
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
 * Kiểm tra nếu ví đã sở hữu bất kỳ NFT nào từ contract
 * @param {string} walletAddress - Địa chỉ ví cần kiểm tra
 * @param {string} contractAddress - Địa chỉ hợp đồng ERC721
 * @param {ethers.providers.Provider} provider - Provider đã kết nối
 */
async function checkERC721Ownership(walletAddress, contractAddress, provider) {
  try {
    // ABI của ERC721 với các hàm cần thiết
    const erc721ABI = [
      "function balanceOf(address owner) view returns (uint256)",
      "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
      "function ownerOf(uint256 tokenId) view returns (address)"
    ];
    
    // Kết nối với smart contract
    const nftContract = new ethers.Contract(contractAddress, erc721ABI, provider);
    
    // Kiểm tra số lượng NFT mà ví sở hữu
    const balance = await nftContract.balanceOf(walletAddress);
    const balanceValue = balance.toString();
    
    console.log(`Balance of ${walletAddress} for contract ${contractAddress}: ${balanceValue} NFTs`);
    
    // Nếu balance > 0, tức là đã sở hữu ít nhất 1 NFT từ contract này
    return {
      contractAddress,
      owned: balanceValue > 0,
      balance: balanceValue
    };
  } catch (error) {
    console.error(`Error checking ERC721 ownership for ${contractAddress}:`, error.message);
    // Nếu có lỗi, giả định là chưa sở hữu
    return {
      contractAddress,
      owned: false,
      balance: "0",
      error: error.message
    };
  }
}

/**
 * Lấy thông tin floor listing từ MagicEden API
 * @param {string} contractAddress - Địa chỉ hợp đồng ERC721
 */
async function getFloorListing(contractAddress, maxRetries = 3, retryDelay = 5000) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetching floor listing for contract ${contractAddress} (Attempt ${attempt}/${maxRetries})`);
      
      // Tạo headers ngẫu nhiên để tránh bị coi là bot
      const headers = {
        'User-Agent': `Mozilla/5.0 NFT-Buyer/1.0 (Attempt ${attempt})`,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'X-Request-ID': `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
      };
      
      // URL API cho floor listing
      const apiUrl = `https://api-mainnet.magiceden.dev/v3/rtp/monad-testnet/collections/v7?id=${contractAddress}&includeMintStages=false&includeSecurityConfigs=false&normalizeRoyalties=false&useNonFlaggedFloorAsk=false&sortBy=allTimeVolume&limit=1`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: headers
      });
      
      // Kiểm tra lỗi HTTP
      if (!response.ok) {
        const statusText = `API responded with status: ${response.status} (${response.statusText})`;
        
        if (response.status === 403 || response.status === 429) {
          const waitTime = retryDelay * attempt; // Tăng thời gian chờ theo số lần thử
          console.warn(`❌ Rate limit error received. Waiting for ${waitTime/1000} seconds...`);
          await sleep(waitTime);
          continue; // Thử lại
        }
        
        throw new Error(statusText);
      }
      
      // Xử lý dữ liệu trả về
      const responseData = await response.json();
      
      // Kiểm tra nếu có collections và floor ask
      if (!responseData.collections || responseData.collections.length === 0) {
        throw new Error(`No collection data found for ${contractAddress}`);
      }
      
      const collection = responseData.collections[0];
      
      // Kiểm tra xem có floor ask không
      if (!collection.floorAsk || !collection.floorAsk.token) {
        throw new Error(`No floor listing found for ${contractAddress}`);
      }
      
      // Trả về thông tin token và floor ask
      return {
        token: collection.floorAsk.token,
        floorAsk: collection.floorAsk,
        collection: {
          name: collection.name,
          contractAddress: collection.primaryContract
        }
      };
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
 * Chức năng chính: Kiểm tra và mua NFT ERC721
 * @param {string} privateKey - Private key của ví
 * @param {string} walletAddress - Địa chỉ ví
 * @param {Array} nftList - Danh sách contract address của NFT cần kiểm tra và mua
 * @param {string} providerUrl - URL của provider
 * @param {string} apiUrl - URL của API MagicEden
 * @param {number} transactionDelayMs - Thời gian chờ giữa các giao dịch
 */
async function checkAndBuyERC721NFTs(privateKey, walletAddress, nftList, providerUrl, apiUrl, transactionDelayMs = 10000) {
  try {
    // Kết nối với blockchain
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);
    
    console.log('===== CHECKING ERC721 OWNERSHIP AND BUYING FLOOR LISTINGS =====');
    console.log(`Wallet: ${walletAddress}`);
    console.log(`Checking ${nftList.length} NFT collections...`);
    
    const results = [];
    
    // Xử lý từng NFT contract trong danh sách
    for (let i = 0; i < nftList.length; i++) {
      const contractAddress = nftList[i].contractAddress;
      const collectionName = nftList[i].name || contractAddress;
      
      console.log(`\n[${i+1}/${nftList.length}] Checking collection: ${collectionName}`);
      
      // Bước 1: Kiểm tra xem ví đã sở hữu bất kỳ NFT nào từ contract này chưa
      const ownershipResult = await checkERC721Ownership(walletAddress, contractAddress, provider);
      
      // Nếu đã sở hữu NFT, bỏ qua và chuyển sang contract tiếp theo
      if (ownershipResult.owned) {
        console.log(`✅ Wallet already owns ${ownershipResult.balance} NFT(s) from this collection. Skipping.`);
        results.push({
          contractAddress,
          collectionName,
          alreadyOwned: true,
          balance: ownershipResult.balance,
          purchased: false
        });
        continue;
      }
      
      console.log(`❌ Wallet does not own any NFTs from this collection. Fetching floor listing...`);
      
      try {
        // Bước 2: Lấy thông tin floor listing từ MagicEden API
        const floorData = await getFloorListing(contractAddress);
        
        // Hiển thị thông tin listing
        console.log(`Found floor listing:`);
        console.log(`  Collection: ${floorData.collection.name}`);
        console.log(`  Token ID: ${floorData.token.tokenId}`);
        console.log(`  Price: ${floorData.floorAsk.price.amount.decimal} ${floorData.floorAsk.price.currency.symbol}`);
        
        // Tạo key cho token (contractAddress:tokenId)
        const tokenKey = `${contractAddress}:${floorData.token.tokenId}`;
        
        // Bước 3: Chuẩn bị payload cho API mua NFT
        const buyParams = {
          "currency": "0x0000000000000000000000000000000000000000",
          "currencyChainId": 10143,
          "items": [
            {
              "key": tokenKey,
              "token": tokenKey,
              "is1155": false, // Quan trọng: đây là ERC721
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
        
        // Bước 4: Thực hiện mua NFT
        console.log(`Attempting to buy NFT ${tokenKey}...`);
        const purchaseResult = await fulfillMagicEdenOrder(privateKey, buyParams, provider, apiUrl);
        
        // Thêm kết quả vào danh sách
        results.push({
          contractAddress,
          collectionName,
          alreadyOwned: false,
          purchased: purchaseResult.success,
          tokenId: floorData.token.tokenId,
          price: floorData.floorAsk.price.amount.decimal,
          currency: floorData.floorAsk.price.currency.symbol,
          purchaseResult: purchaseResult
        });
        
        // Hiển thị kết quả
        if (purchaseResult.success) {
          console.log(`✅ Successfully purchased NFT ${tokenKey}`);
        } else {
          console.log(`❌ Failed to purchase NFT ${tokenKey}: ${purchaseResult.error}`);
        }
      } catch (error) {
        console.error(`Error processing collection ${collectionName}:`, error.message);
        results.push({
          contractAddress,
          collectionName,
          alreadyOwned: false,
          purchased: false,
          error: error.message
        });
      }
      
      // Chờ trước khi chuyển sang NFT tiếp theo
      if (i < nftList.length - 1) {
        console.log(`\nWaiting ${transactionDelayMs/1000} seconds before checking next collection...`);
        await sleep(transactionDelayMs);
      }
    }
    
    // Tổng kết kết quả
    console.log('\n===== PURCHASE SUMMARY =====');
    console.log(`Total collections checked: ${nftList.length}`);
    
    const alreadyOwnedCount = results.filter(r => r.alreadyOwned).length;
    const successfulPurchases = results.filter(r => r.purchased).length;
    const failedPurchases = results.filter(r => !r.alreadyOwned && !r.purchased).length;
    
    console.log(`Already owned: ${alreadyOwnedCount}`);
    console.log(`Successfully purchased: ${successfulPurchases}`);
    console.log(`Failed to purchase: ${failedPurchases}`);
    
    return {
      walletAddress,
      totalChecked: nftList.length,
      alreadyOwned: alreadyOwnedCount,
      purchased: successfulPurchases,
      failed: failedPurchases,
      results: results
    };
  } catch (error) {
    console.error(`Error in checkAndBuyERC721NFTs for wallet ${walletAddress}:`, error);
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
async function processMultipleWallets(walletsFilePath, nftList, providerUrl, apiUrl, transactionDelayMs = 10000, walletDelayMs = 15000) {
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
      const walletResult = await checkAndBuyERC721NFTs(
        wallet.privateKey, 
        wallet.address, 
        nftList, 
        providerUrl, 
        apiUrl, 
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
  const transactionDelayMs = 10000; // Chờ 10 giây giữa các giao dịch
  const walletDelayMs = 15000;     // Chờ 15 giây giữa các ví
  
  // Danh sách NFT cần kiểm tra - chỉ cần contract address, không cần tokenId
  const nftList = [
    {
      contractAddress: '0xc1711ff6b4f81ae45c36f370a3914da53b98bcdc',
      name: 'MonAI Silent Aura'
    },
    {
      contractAddress: '0xcf9666810c3d9f8ffe912a40738a91e19040b84d',
      name: 'MonAI Chosen One'
    },
    {
      contractAddress: '0x252390af40ab02c0b8d05fe6f8bae145c6f26989',
      name: 'MonAI Qingyi'
    },
    {
      contractAddress: '0xde902fbf47253fc2680b7c206ec5a998e584cc75',
      name: 'MonAI Mystery'
    },
    {
      contractAddress: '0xd7e0b098a1ded27f76aa619a076a0c64a1066932',
      name: 'MonAI Genesis Seed'
    },
    {
      contractAddress: '0x97d6b5e3701c9c14c909bbd21d88c81a933c5320',
      name: 'MonAI Eclipsis'
    },
  ];
  
  try {
    console.log('===== ERC721 NFT CHECKER AND BUYER FOR MULTIPLE WALLETS =====');
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
    const resultFilePath = `./erc721-results-${timestamp}.json`;
    
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