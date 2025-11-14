/**
 * Betting Contract Addresses and ABIs
 */

export const CONTRACTS = {
  babylonOracle: process.env.NEXT_PUBLIC_BABYLON_ORACLE as `0x${string}`,
  predimarket: process.env.NEXT_PUBLIC_PREDIMARKET as `0x${string}`,
  marketFactory: process.env.NEXT_PUBLIC_MARKET_FACTORY as `0x${string}`,
  testToken: process.env.NEXT_PUBLIC_TEST_TOKEN as `0x${string}`,
}

export { default as BabylonOracleABI } from './abi/BabylonGameOracle.json'
export { default as PredimarketABI } from './abi/Predimarket.json'
export { default as ERC20ABI } from './abi/ERC20.json'

