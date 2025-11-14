/**
 * Check wallet status and pending transactions on Sepolia
 */

import { ethers } from 'ethers'

async function checkWalletStatus() {
  try {
    const gamePrivateKey = process.env.BABYLON_GAME_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
    const gameWalletAddress = process.env.BABYLON_GAME_WALLET_ADDRESS

    if (!gamePrivateKey || !gameWalletAddress) {
      throw new Error('Missing BABYLON_GAME_PRIVATE_KEY or BABYLON_GAME_WALLET_ADDRESS')
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const wallet = new ethers.Wallet(gamePrivateKey, provider)

    console.log('🔍 Checking wallet status on Sepolia...\n')
    console.log(`Wallet: ${wallet.address}`)
    console.log(`Expected: ${gameWalletAddress}\n`)

    // Check balance
    const balance = await provider.getBalance(wallet.address)
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`)

    // Check nonce (transaction count)
    const nonce = await provider.getTransactionCount(wallet.address, 'latest')
    const pendingNonce = await provider.getTransactionCount(wallet.address, 'pending')

    console.log(`📊 Nonce (confirmed): ${nonce}`)
    console.log(`📊 Nonce (pending): ${pendingNonce}`)

    if (pendingNonce > nonce) {
      console.log(`⚠️  ${pendingNonce - nonce} pending transaction(s) detected!\n`)
    } else {
      console.log(`✅ No pending transactions\n`)
    }

    // Check current gas price
    const feeData = await provider.getFeeData()
    console.log(`⛽ Current Gas Price:`)
    console.log(`   Max Fee: ${feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') : 'N/A'} gwei`)
    console.log(`   Max Priority Fee: ${feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : 'N/A'} gwei`)

    // Check network status
    const blockNumber = await provider.getBlockNumber()
    const block = await provider.getBlock(blockNumber)
    console.log(`\n🌐 Network Status:`)
    console.log(`   Latest Block: ${blockNumber}`)
    console.log(`   Block Time: ${new Date(block!.timestamp * 1000).toISOString()}`)
    console.log(`   Base Fee: ${block!.baseFeePerGas ? ethers.formatUnits(block!.baseFeePerGas, 'gwei') : 'N/A'} gwei`)

  } catch (error) {
    console.error('❌ Check failed:', error)
    process.exit(1)
  }
}

checkWalletStatus()
