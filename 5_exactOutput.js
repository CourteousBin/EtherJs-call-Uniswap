const { ethers } = require('ethers')
const { abi: IUniswapV3PoolABI } = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json')
const { abi: SwapRouterABI } = require('@uniswap/swap-router-contracts/artifacts/contracts/SwapRouter02.sol/SwapRouter02.json')

const ERC20ABI = require('./abi.json')

require('dotenv').config()
const INFURA_URL_TESTNET = process.env.INFURA_URL_TESTNET
const WALLET_ADDRESS = process.env.WALLET_ADDRESS
const WALLET_SECRET = process.env.WALLET_SECRET

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET) // Ropsten
const swapRouterCa = '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4' // uniswap


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

  let poolAddress = '0xDd34DbD4378209B899D70eEeD9A1B7d69fd416ed'

  const poolContract = new ethers.Contract(
    poolAddress,
    IUniswapV3PoolABI,
    connectedWallet
  );

  var ETJ = new ethers.Contract(address0, ERC20ABI, connectedWallet);

  // 批准合约
  const amount1 = ethers.utils.parseUnits('0.005', decimals1);
  const amount2 = ethers.utils.parseUnits('0.1', decimals1);

  // 批准最大愿意支付价格
  let approveETJ = await ETJ.approve(swapRouterCa, amount2);
  await approveETJ.wait()

  // 获取池子信息
  const poolData = await getPoolData(poolContract);

  const swapExactOutputparams = {
    tokenIn: address0,
    tokenOut: address1,
    fee: poolData.fee,
    recipient: WALLET_ADDRESS,
    deadline: Math.floor(Date.now() / 1000) + 60 * 10,
    amountOut: amount1, // 用户希望接收的输出代币数量
    amountInMaximum: amount2, // 用户愿意提供的最大输入代币数量，以防止市场波动导致的不利价格变动。
    sqrtPriceLimitX96: 0,
  };

  const swapTx = await swapRouter.exactOutputSingle(swapExactOutputparams, {
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