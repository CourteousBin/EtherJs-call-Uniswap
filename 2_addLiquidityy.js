const { ethers } = require('ethers')
const { abi: IUniswapV3PoolABI } = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json')
const { abi: IUniswapV3Factory } = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json')
const { abi: NonfungiblePositionManagerABI } = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json')
const { nearestUsableTick, Position, Pool } = require("@uniswap/v3-sdk");
const { Token } = require("@uniswap/sdk-core");
const ERC20ABI = require('./abi.json')
const WETHABI = require('./wethAbi.json')

require('dotenv').config()
const INFURA_URL_TESTNET = process.env.INFURA_URL_TESTNET
const WALLET_ADDRESS = process.env.WALLET_ADDRESS
const WALLET_SECRET = process.env.WALLET_SECRET

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET) // Ropsten
const uniswapV3Factory = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24' // uniswap

// nonFungiblePositionManager 流动性位置的创建和管理 增加/移除流动性
// https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/mint-a-position
var npmca = "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2";

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
// 交易对 0.01:10000
const amount0 = ethers.utils.parseUnits('0.1', decimals0);
const amount1 = ethers.utils.parseUnits('0.1', decimals1);

async function main() {

  // 创建钱包,并且签名
  const wallet = new ethers.Wallet(WALLET_SECRET)
  // connectedWallet 已经继承 singer 
  const connectedWallet = wallet.connect(provider)

  // 添加流动性

  // 1. 读取合约注意 WETHABI ABI与传统 ERC20 不同
  var token0 = new ethers.Contract(address0, ERC20ABI, connectedWallet);
  var token1 = new ethers.Contract(address1, WETHABI, connectedWallet);

  // 3. 批准合约
  let approveWETH = await token0.approve(npmca, amount0);
  await approveWETH.wait()

  let approveETJ = await token1.approve(npmca, amount1);
  await approveETJ.wait()
  console.log('批准完成')

  const factoryFee = 3000
  const factory = new ethers.Contract(uniswapV3Factory, IUniswapV3Factory, connectedWallet)
  var poolAddress = await factory.getPool(address0, address1, factoryFee);

  const poolContract = new ethers.Contract(
    poolAddress,
    IUniswapV3PoolABI,
    connectedWallet
  )

  const poolData = await getPoolData(poolContract);
  const chainId = 84532
  const TokenWETH = new Token(chainId, address1, decimals1)
  const TokenETJ = new Token(chainId, address0, decimals0)

  const slot = await poolContract.slot0();

  const configuredPool = new Pool(
    TokenETJ,
    TokenWETH,
    poolData.fee,
    poolData.sqrtPriceX96.toString(),
    poolData.liquidity.toString(),
    poolData.tick
  )

  const position = new Position({
    pool: configuredPool,
    liquidity: ethers.utils.parseEther("0.1"),
    tickLower:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 2,
    tickUpper:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 2,
  })

  const { amount0: amount0Desired, amount1: amount1Desired } = position.mintAmounts;

  params = {
    token0: address0,
    token1: address1,
    fee: poolData.fee,
    tickLower:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) -
      poolData.tickSpacing * 2,
    tickUpper:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) +
      poolData.tickSpacing * 2,
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
    amount0Min: 0,
    amount1Min: 0,
    recipient: WALLET_ADDRESS,
    deadline: Math.floor(Date.now() / 1000) + 60 * 10,
  };

  const nonfungiblePositionManager = new ethers.Contract(
    npmca,
    NonfungiblePositionManagerABI,
    connectedWallet
  );

  const tx = await nonfungiblePositionManager.mint(params, { gasLimit: ethers.utils.hexlify(1000000) });
  const receipt = await tx.wait();

  const addLiquidityEvent = receipt.events.find(
    (event) => event.event === "IncreaseLiquidity"
  );
  const tokenId = addLiquidityEvent.args.tokenId;
  console.log("Minted position with tokenId:", tokenId.toString());

}

async function getPoolData(poolContract) {
  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  return {
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1]
  }
}
main()