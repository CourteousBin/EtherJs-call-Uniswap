const { ethers, Contract } = require('ethers')
const { abi: NonfungiblePositionManagerABI } = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json')
const ERC20ABI = require('./abi.json')
const WETHABI = require('./wethAbi.json')

require('dotenv').config()
const INFURA_URL_TESTNET = process.env.INFURA_URL_TESTNET
const WALLET_ADDRESS = process.env.WALLET_ADDRESS
const WALLET_SECRET = process.env.WALLET_SECRET

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET) // BASE
const uniswapV3Factory = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24' // uniswap

// nonFungiblePositionManager 流动性位置的创建和管理 增加/移除流动性
// https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/mint-a-position
const NPMCA = "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2";

// 交易对
const name0 = 'Uni Token'
const symbol0 = 'ETJ'
const decimals0 = 18
const address0 = '0x34Ce960295CD0B0A02E2553D8D3815A257368897'
// 交易对
const name1 = 'Wrapped Ether'
const symbol1 = 'WETH9'
const decimals1 = 18
const address1 = '0x4200000000000000000000000000000000000006'

const amount0 = ethers.utils.parseUnits('0.01', decimals0);
const amount1 = ethers.utils.parseUnits('0.01', decimals1);

async function main() {

  // 创建钱包,并且签名
  const wallet = new ethers.Wallet(WALLET_SECRET)
  // connectedWallet 已经继承 singer 
  const connectedWallet = wallet.connect(provider)

  const positionManager = new Contract(NPMCA, NonfungiblePositionManagerABI, connectedWallet)

  // get tokenId
  const numPositions = await positionManager.balanceOf(WALLET_ADDRESS)

  var nftTokenIds = []

  for (var i = 0;i < numPositions;i++) {
    const tokenId = await positionManager.tokenOfOwnerByIndex(WALLET_ADDRESS, i)
    nftTokenIds.push(tokenId)
  }

  let tokenId = nftTokenIds[0].toString()
  console.log("tokenId:", tokenId)

  // approve
  var token0 = new ethers.Contract(address0, ERC20ABI, connectedWallet);
  var token1 = new ethers.Contract(address1, WETHABI, connectedWallet);

  let approveWETH = await token0.approve(NPMCA, amount0);
  await approveWETH.wait()

  let approveETJ = await token1.approve(NPMCA, amount1);
  await approveETJ.wait()
  console.log('批准完成')

  // increaseLiquidity
  // amount0Desired,amount1Desired 不可以超过初次添加流动性数量
  const increaseLiquidityParams = {
    tokenId,
    amount0Desired: amount0.toString(),
    amount1Desired: amount1.toString(),
    amount0Min: 0,
    amount1Min: 0,
    deadline: Math.floor(Date.now() / 1000) + 60 * 10
  }

  console.log(increaseLiquidityParams);

  let increaseLiquidityRes = await positionManager.increaseLiquidity(increaseLiquidityParams, {
    gasLimit: ethers.utils.hexlify(1000000)
  })

  await increaseLiquidityRes.wait()

  console.log('Liquidity increased successfully!');

}

main()