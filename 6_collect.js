const { ethers } = require('ethers')
const { abi: NonfungiblePositionManagerABI } = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json')
const { nearestUsableTick, Position, Pool } = require("@uniswap/v3-sdk");

require('dotenv').config()
const INFURA_URL_TESTNET = process.env.INFURA_URL_TESTNET
const WALLET_ADDRESS = process.env.WALLET_ADDRESS
const WALLET_SECRET = process.env.WALLET_SECRET

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET) // Ropsten

// nonFungiblePositionManager 流动性位置的创建和管理 增加/移除流动性
// https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/mint-a-position
var npmca = "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2";

async function main() {

  const wallet = new ethers.Wallet(WALLET_SECRET)
  
  const connectedWallet = wallet.connect(provider)

  const positionManager = new ethers.Contract(npmca, NonfungiblePositionManagerABI, connectedWallet)

  // get tokenId
  const numPositions = await positionManager.balanceOf(WALLET_ADDRESS)

  var nftTokenIds = []

  for (var i = 0;i < numPositions;i++) {
    const tokenId = await positionManager.tokenOfOwnerByIndex(WALLET_ADDRESS, i)
    nftTokenIds.push(tokenId.toString())
  }

  let tokenId = nftTokenIds[0]

  const positionData = await positionManager.positions(tokenId);
  /*  
  调用 positions(tokenId) 函数时，它会返回一系列信息，这通常包括：
  nonce: 用于防止重放攻击的随机数。
  operator: 被授权管理该位置的地址。
  token0 和 token1: 该流动性位置涉及的两种代币的地址。
  fee: 该位置的费率。
  tickLower 和 tickUpper: 该流动性位置的价格范围，以 tick 为单位表示。
  liquidity: 该位置的流动性量，一个无符号整数。
  feeGrowthInside0LastX128 和 feeGrowthInside1LastX128: 自上次收集费用以来，每单位流动性累积的费用增长量。
  tokensOwed0 和 tokensOwed1: 由于提供流动性而应收的 token0 和 token1 的数量。
  */

  //  tokensOwed0 和 tokensOwed1: 由于提供流动性而应收的 token0 和 token1 的数量。
  const amount0 = positionData[10];
  const amount1 = positionData[11];

  const collectParams = {
    tokenId: tokenId,
    recipient: WALLET_ADDRESS,
    amount0Max: amount0,
    amount1Max: amount1,
  };

  const collecttx = await positionManager.collect(collectParams, {
    gasLimit: ethers.utils.hexlify(1000000)
  });

  const receipt = await collecttx.wait();

  const collectEvent = receipt.events.find(
    (event) => event.event === "Collect"
  );

  console.log('Collect Success');

  //emit Collect(params.tokenId, recipient, amount0Collect, amount1Collect);
  console.log(collectEvent.args.tokenId);
  console.log(collectEvent.args.recipient);
  console.log(collectEvent.args.amount0Collect);
  console.log(collectEvent.args.amount1Collect);
  console.log(amount0);
  console.log(amount1);

}

main()