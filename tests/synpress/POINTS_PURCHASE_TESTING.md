# Points Purchase E2E Testing Guide

This guide explains how to test the complete x402 payment flow for buying points with account abstraction (Privy embedded wallets).

## Overview

The points purchase system allows users to buy reputation points using native ETH through their Privy embedded wallets. The system:

1. Creates a payment request via x402 protocol
2. Handles wallet funding if needed (via Privy's fundWallet)
3. Sends the payment transaction through smart wallet
4. Verifies the transaction on-chain
5. Credits points to the user account

## Prerequisites

### Environment Variables

Ensure these environment variables are set in your `.env.local`:

```bash
# Privy Configuration
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id

# Payment Receiver (Treasury)
BABYLON_GAME_WALLET_ADDRESS=0x...  # Address that receives point purchases

# RPC Configuration
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_CHAIN_ID=84532  # Base Sepolia

# Test Account (for Synpress)
PRIVY_TEST_EMAIL=test@example.com
PRIVY_TEST_PASSWORD=testpassword123
```

### Required Setup

1. **Payment Receiver**: Set `BABYLON_GAME_WALLET_ADDRESS` to a valid Ethereum address
2. **Test Account**: Create a Privy account for testing
3. **Wallet Funding**: Ensure test wallet has some Base Sepolia ETH for testing

## Running Tests

### Run All Points Purchase Tests

```bash
bun run test:e2e tests/synpress/13-points-purchase.spec.ts
```

### Run Specific Test Suites

```bash
# Test modal and UI
bun run test:e2e tests/synpress/13-points-purchase.spec.ts -g "Points Purchase Flow"

# Test error handling
bun run test:e2e tests/synpress/13-points-purchase.spec.ts -g "Error Handling"

# Test configuration
bun run test:e2e tests/synpress/13-points-purchase.spec.ts -g "Payment Configuration"
```

## Test Scenarios

### 1. Basic Flow Tests

- ✅ Display buy points button
- ✅ Open buy points modal
- ✅ Display amount input and quick select buttons
- ✅ Show correct points calculation (100 points per $1)
- ✅ Validate minimum amount ($1)
- ✅ Validate maximum amount ($1000)

### 2. Payment Flow Tests

- ✅ Initiate payment request
- ✅ Handle wallet funding if needed
- ✅ Send payment transaction
- ✅ Display transaction hash link
- ✅ Show success message on completion
- ✅ Update points balance after purchase

### 3. Error Handling Tests

- ✅ Handle insufficient balance
- ✅ Handle payment timeout
- ✅ Handle transaction failure
- ✅ Allow retry after failure
- ✅ Close modal on cancel

### 4. Configuration Tests

- ✅ Verify payment receiver is configured
- ✅ Check backend API responses
- ✅ Validate environment setup

## Manual Testing Guide

### Step 1: Login

1. Navigate to `/markets`
2. Login with your Privy account
3. Wait for wallet initialization

### Step 2: Open Buy Points Modal

1. Click "Buy Points" button in the markets tab
2. Verify modal opens with amount input

### Step 3: Select Amount

1. Enter a custom amount or use quick select buttons ($10, $25, $50, $100)
2. Verify points calculation shows correct amount (100 points per $1)
3. Check wallet balance is displayed

### Step 4: Fund Wallet (if needed)

1. If wallet has insufficient balance, Privy funding modal will appear
2. Follow Privy's funding flow (testnet faucet, bridge, or buy)
3. Wait for funds to arrive

### Step 5: Complete Payment

1. Click "Buy" button
2. Transaction will be sent through smart wallet
3. Wait for confirmation (shows "Processing Payment...")
4. Verify transaction hash link appears
5. Check for success message

### Step 6: Verify Points

1. Close the modal
2. Check your points balance has increased
3. Navigate to profile to see points transaction history

## Expected Behavior

### Payment Request Creation

```typescript
POST /api/points/purchase/create-payment
Body: {
  amountUSD: 10,
  fromAddress: "0x..." // Smart wallet address
}

Response: {
  success: true,
  paymentRequest: {
    requestId: "x402-...",
    amount: "10000000000000000", // 0.01 ETH in wei
    from: "0x...",
    to: "0x...", // Treasury address
    expiresAt: 1234567890,
    pointsAmount: 1000,
    amountUSD: 10
  }
}
```

### Payment Verification

```typescript
POST /api/points/purchase/verify-payment
Body: {
  requestId: "x402-...",
  txHash: "0x...",
  fromAddress: "0x...",
  toAddress: "0x...",
  amount: "10000000000000000"
}

Response: {
  success: true,
  pointsAwarded: 1000,
  newTotal: 5000,
  txHash: "0x..."
}
```

## Troubleshooting

### Payment Receiver Not Configured

**Error**: "Payment system not configured"

**Solution**: Set `BABYLON_GAME_WALLET_ADDRESS` environment variable

```bash
export BABYLON_GAME_WALLET_ADDRESS=0xYourTreasuryAddress
```

### Transaction Not Found

**Error**: "Transaction not found on blockchain"

**Causes**:
- Transaction still pending
- Wrong RPC URL
- Wrong chain ID

**Solutions**:
- Wait longer for transaction confirmation
- Check `NEXT_PUBLIC_RPC_URL` is correct
- Verify `NEXT_PUBLIC_CHAIN_ID` matches the network

### Insufficient Balance

**Error**: "Insufficient balance" or funding modal appears

**Solutions**:
- Use Privy's fundWallet flow to add funds
- Get testnet ETH from Base Sepolia faucet
- Bridge funds from Ethereum Sepolia

### Smart Wallet Transaction Issues

**Error**: "Sender mismatch" or "Recipient mismatch"

**Cause**: Smart wallet transactions have different sender/recipient patterns

**Solution**: The x402 manager now handles this automatically by:
- Being lenient with sender validation (recognizes smart wallets)
- Checking transaction logs for internal transfers
- Allowing 1% tolerance for gas fees

## Development Tips

### Testing with Low Amounts

For testing, use $10 (1000 points):
- Equivalent to 0.01 ETH
- Low enough to be affordable on testnet
- Large enough to test the full flow

### Monitoring Transactions

View transactions on Base Sepolia explorer:
```
https://sepolia.basescan.org/tx/0x...
```

### Debugging Payment Verification

Check logs for payment verification details:
```
[X402Manager] Payment verified successfully
  - requestId: x402-...
  - isSmartWallet: true
```

### Testing Error Scenarios

1. **Expired Request**: Wait 15 minutes after creating payment request
2. **Invalid Amount**: Try amounts below $1 or above $1000
3. **Insufficient Balance**: Use empty test wallet
4. **Network Issues**: Disconnect from network during transaction

## Unit Tests

Run x402 manager unit tests:

```bash
bun test src/a2a/tests/payments/x402-manager.test.ts
bun test src/a2a/tests/payments/x402-smart-wallet.test.ts
```

## Integration Tests

Run API route tests:

```bash
# Test create-payment endpoint
curl -X POST http://localhost:3000/api/points/purchase/create-payment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amountUSD": 10, "fromAddress": "0x..."}'

# Test verify-payment endpoint
curl -X POST http://localhost:3000/api/points/purchase/verify-payment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"requestId": "x402-...", "txHash": "0x...", "fromAddress": "0x...", "toAddress": "0x...", "amount": "10000000000000000"}'
```

## Performance Benchmarks

Expected timings:
- Modal open: < 500ms
- Payment request creation: < 2s
- Wallet funding (if needed): 30s - 2min
- Transaction submission: 3-10s
- Transaction confirmation: 10-30s
- Payment verification: 3-5s
- Total flow (funded wallet): 30-60s
- Total flow (needs funding): 2-4min

## Security Considerations

1. **Payment Receiver**: Always verify `BABYLON_GAME_WALLET_ADDRESS` is correct
2. **Amount Validation**: Server validates min ($1) and max ($1000)
3. **Transaction Verification**: Full on-chain verification before crediting points
4. **Timeout Protection**: 15-minute expiration on payment requests
5. **Smart Wallet Support**: Properly handles account abstraction transactions

## Next Steps

After successful testing:

1. Set production payment receiver address
2. Update environment variables for production
3. Test with real funds on mainnet
4. Monitor transaction success rates
5. Set up alerts for failed payments
6. Implement analytics tracking

## Support

For issues:
1. Check logs in browser console
2. Check server logs for API errors
3. Verify blockchain transaction on BaseScan
4. Review test screenshots in `test-results/screenshots/`
5. Check payment statistics in x402 manager

