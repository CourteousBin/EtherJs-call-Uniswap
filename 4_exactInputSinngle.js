const { ethers } = require('ethers')
const { abi: IUniswapV3PoolABI } = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json')
const { abi: SwapRouterABI } = require('@uniswap/swap-router-contracts/artifacts/contracts/SwapRouter02.sol/SwapRouter02.json')

const ERC20ABI = require('./abi.json')
const WETHABI = require('./wethAbi.json')

require('dotenv').config()
const INFURA_URL_TESTNET = process.env.INFURA_URL_TESTNET
const WALLET_ADDRESS = process.env.WALLET_ADDRESS
const WALLET_SECRET = process.env.WALLET_SECRET

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET) // Ropsten
const swapRouterCa = '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4' // uniswap
const uniswapV3Factory = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24' // uniswap


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

async function main() {

  // 创建钱包,并且签名
  const wallet = new ethers.Wallet(WALLET_SECRET)
  // connectedWallet 已经继承 singer 
  const connectedWallet = wallet.connect(provider)

  const swapRouter = new ethers.Contract(
    swapRouterCa,
    SwapRouterABI,
    connectedWallet
  );

  // const factoryFee = 3000
  // const factory = new ethers.Contract(uniswapV3Factory, IUniswapV3Factory, connectedWallet)
  // var poolAddress = await factory.getPool(address0, address1, factoryFee);

  let poolAddress = '0xDd34DbD4378209B899D70eEeD9A1B7d69fd416ed'

  const poolContract = new ethers.Contract(
    poolAddress,
    IUniswapV3PoolABI,
    connectedWallet
  );

  var token1 = new ethers.Contract(address1, WETHABI, connectedWallet);

  // 批准合约
  const amount1 = ethers.utils.parseUnits('0.005', decimals1);
  let approveWETH = await token1.approve(swapRouterCa, amount1);
  await approveWETH.wait()

  // 获取池子信息
  const poolData = await getPoolData(poolContract);
  console.log(poolData);

  const swapExactInputparams = {
    tokenIn: poolData.token1,
    tokenOut: poolData.token0,
    fee: poolData.fee,
    recipient: WALLET_ADDRESS,
    deadline: Math.floor(Date.now() / 1000) + 60 * 10,
    amountIn: amount1,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  };

  const swapTx = await swapRouter.exactInputSingle(swapExactInputparams, {
    gasLimit: ethers.utils.hexlify(1000000)
  });

  await swapTx.wait();

  console.log('swap success');

}

async function getPoolData(poolContract) {
  const [token0, token1, tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.token0(),
    poolContract.token1(),
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  return {
    token0: token0,
    token1: token1,
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1]
  }
}
main()