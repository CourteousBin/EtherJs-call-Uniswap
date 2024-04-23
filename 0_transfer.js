const { ethers } = require('ethers')
const ERC20ABI = require('./abi.json')

require('dotenv').config()
const INFURA_URL_TESTNET = process.env.INFURA_URL_TESTNET
const WALLET_ADDRESS = process.env.WALLET_ADDRESS
const WALLET_SECRET = process.env.WALLET_SECRET

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET) // Ropsten
const tokenAddress = "0x994E559dF84f62DB36e569B000205EA2B420C100" // TOKEN
const recipientAddress = '0xaBD3ee5dCF5d3E86ced652B94f185A853B834e40'; // 接收代币的地址

async function main() {

  // 创建钱包,并且签名
  const wallet = new ethers.Wallet(WALLET_SECRET)
  // connectedWallet 已经继承 singer 
  const connectedWallet = wallet.connect(provider)

  // 准备参数，访问uni池子拿到信息
  const tokenContract = new ethers.Contract(
    tokenAddress,
    ERC20ABI,
    connectedWallet
  )

  // 获取全部代币余额
  const balance = await tokenContract.balanceOf(WALLET_ADDRESS);
  console.log(`Burning all tokens: ${ethers.utils.formatEther(balance)} tokens`);

  const amount0 = ethers.utils.parseUnits(balance.toString(), 18);

  // 批准
  let approveRes = await tokenContract.approve(recipientAddress, amount0, {
    gasLimit: ethers.utils.hexlify(1000000)
  });

  await approveRes.wait()

  // 发送全部代币到零地址
  const tx = await tokenContract.transfer(recipientAddress, balance, {
    gasLimit: ethers.utils.hexlify(1000000)
  });
  console.log(`Transaction hash: ${tx.hash}`);

  // 等待交易确认
  await tx.wait();
  console.log('Tokens burned successfully.');

}

main()