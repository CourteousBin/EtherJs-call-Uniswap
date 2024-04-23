const { ethers } = require('ethers')
const { abi: IUniswapV3PoolABI } = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json')
const { abi: IUniswapV3Factory } = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json')
const { encodeSqrtRatioX96, nearestUsableTick, NonfungiblePositionManager, Position, Pool } = require("@uniswap/v3-sdk");
const { Percent, Token } = require("@uniswap/sdk-core");
const ERC20ABI = require('./abi.json')
const WETHABI = require('./wethAbi.json')
// const { NonceManager } = require("@ethersproject/experimental")

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
  var token0 = new ethers.Contract(address0, WETHABI, connectedWallet);
  var token1 = new ethers.Contract(address1, ERC20ABI, connectedWallet);


  // 2. 用ETH换成WETH 已转化成 0.01
  var wethSwap = await token0.deposit({ value: amount0 })
  await wethSwap.wait()

  //结束后查询一下余额
  var balance0 = await token0.balanceOf(WALLET_ADDRESS)
  var balance1 = await token1.balanceOf(WALLET_ADDRESS)
  console.log(balance0.toString(), balance1.toString());

  // 3. 批准合约
  let approveWETH = await token0.approve(npmca, amount0);
  await approveWETH.wait()

  let approveETJ = await token1.approve(npmca, amount1);
  await approveETJ.wait()
  console.log('批准完成')

  // 4. 调用工厂合约
  const factoryFee = 3000
  const factory = new ethers.Contract(uniswapV3Factory, IUniswapV3Factory, connectedWallet)
  // getPool factoryFee 必须要与创建时候一摸一样，否则就是返回 黑洞地址
  var poolAddress = await factory.getPool(address0, address1, factoryFee);
  console.log(poolAddress)
  console.log('调用工厂合约');

  // 5. 初始化池子
  const poolContract = new ethers.Contract(poolAddress, IUniswapV3PoolABI, connectedWallet)

  if (poolAddress === ethers.constants.AddressZero) {

    console.log(factory);
    console.log('创建新池子');
    // 创建新池子
    let pool = await factory.createPool(address0, address1, factoryFee * 10, {
      gasLimit: ethers.utils.hexlify(1000000)
    })
    await pool.wait()
    console.log("Creating pool");

    // 用于表示和计算流动性池中两种代币之间的价格
    // 假设你想要计算代币 A 相对于代币 B 的价格。如果你有 1 代币 A 对应 500 代币 B 的价格比率，那么你需要以这种方式填充参数：代币 A 的数量：1代币 B 的数量：500
    var priceRatio = encodeSqrtRatioX96(1, 1);
    var initializeTx = await poolContract.initialize(priceRatio.toString());
    await initializeTx.wait();
    console.log('initialize');
  }

  // 6. 获取池子状态
  const liquidity = await poolContract.liquidity();
  const slot = await poolContract.slot0();

  const PoolState = {
    liquidity,
    sqrtPriceX96: slot[0],
    tick: slot[1],
    observationIndex: slot[2],
    observationCardinality: slot[3],
    observationCardinalityNext: slot[4],
    feeProtocol: slot[5],
    unlocked: slot[6],
  };

  // 7. 配置池子

  // Base Sepolia Testnet
  const chainId = 84532
  // Token 类是一个高级的抽象，它封装了代币的基本信息，如链 ID、合约地址、小数位数、符号和名称。
  // 当你使用 Token 类时，你可以很容易地获取代币的基本信息，而无需直接与区块链交互。
  const TokenWETH = new Token(chainId, address1, decimals1)
  const TokenETJ = new Token(chainId, address0, decimals0)

  const configuredPool = new Pool(
    TokenETJ,
    TokenWETH,
    factoryFee,
    PoolState.sqrtPriceX96.toString(),
    PoolState.liquidity.toString(),
    PoolState.tick
  )

  // 8. 流动性配置
  const position = Position.fromAmounts({
    pool: configuredPool,
    tickLower:
      nearestUsableTick(configuredPool.tickCurrent, configuredPool.tickSpacing) -
      configuredPool.tickSpacing * 2, // 下限价格刻度
    tickUpper:
      nearestUsableTick(configuredPool.tickCurrent, configuredPool.tickSpacing) +
      configuredPool.tickSpacing * 2, // 上限价格刻度
    amount0: amount0.toString(),
    amount1: amount1.toString(),
    useFullPrecision: false,
  });

  // 在Uniswap V3中，NonfungiblePositionManager是一个关键的合约，它允许用户管理他们的流动性位置。
  // 不同于Uniswap V2，V3中的流动性提供者会获得一个非同质化代币（NFT）来代表他们在特定价格范围内的流动性位置。
  const mintOptions = {
    recipient: WALLET_ADDRESS,
    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
    slippageTolerance: new Percent(50, 10_000),
  };

  // 9. 执行首次添加流动性
  const { calldata, value } = NonfungiblePositionManager.addCallParameters(position, mintOptions);
  const transaction = {
    data: calldata,
    to: npmca,
    value: value,
    from: WALLET_ADDRESS,
    gasLimit: 10000000
  };
  console.log('Transacting');
  const txRes = await connectedWallet.sendTransaction(transaction);
  await txRes.wait();
  console.log('Added liquidity');

}

main()