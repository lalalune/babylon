# On-Chain Storage Audit Report

**Date:** November 12, 2025  
**Objective:** Comprehensive audit of all on-chain data storage to ensure compliance with Shaw's specification: "The only thing on chain is the prices and question answers IMO - Like final prices per tick for all perps and such"

## Executive Summary

This audit identifies all data currently stored on-chain in the Babylon system and compares it against the specification. Key findings:

- **Currently On-Chain:** Extensive market data, positions, balances, reputation, and identity information
- **Should Be On-Chain:** Final prices per tick for perpetuals, question answers/resolutions
- **Should NOT Be On-Chain:** Detailed position data, user balances, market metadata, reputation updates

## 1. Current On-Chain Storage Inventory

### 1.1 LibMarket Storage (`contracts/libraries/LibMarket.sol`)

**Storage Location:** `MARKET_STORAGE_POSITION = keccak256("babylon.market.storage")`

#### Market Struct (per market)
- `bytes32 id` - Market identifier
- `string question` - Market question text (STORED ON-CHAIN)
- `uint8 numOutcomes` - Number of possible outcomes
- `mapping(uint8 => uint256) shares` - Total shares per outcome
- `mapping(uint8 => string) outcomeNames` - Outcome names (STORED ON-CHAIN)
- `uint256 liquidity` - LMSR liquidity parameter
- `uint256 createdAt` - Creation timestamp
- `uint256 resolveAt` - Resolution timestamp
- `bool resolved` - Resolution status
- `uint8 winningOutcome` - **QUESTION ANSWER (STORED ON-CHAIN)** ✓
- `address oracle` - Oracle address
- `uint256 totalVolume` - Total trading volume
- `uint256 feeRate` - Fee rate in basis points

#### Position Struct (per user per market)
- `mapping(uint8 => uint256) shares` - User shares per outcome
- `uint256 totalInvested` - Total amount invested
- `bool claimed` - Whether winnings claimed

#### MarketStorage Global
- `mapping(bytes32 => Market) markets` - All markets
- `mapping(address => mapping(bytes32 => Position)) positions` - All user positions
- `mapping(address => uint256) balances` - **USER BALANCES (STORED ON-CHAIN)** ✗
- `bytes32[] marketIds` - Market ID list
- `uint256 defaultLiquidity` - Default liquidity parameter
- `uint256 defaultFeeRate` - Default fee rate
- `address feeRecipient` - Fee recipient address
- `address chainlinkOracle` - Chainlink oracle address
- `address umaOracle` - UMA oracle address

**Gas Cost Analysis:**
- Market creation: ~150k gas (includes question string storage)
- Position update: ~50k gas per outcome
- Balance update: ~20k gas

### 1.2 LibPerpetual Storage (`contracts/libraries/LibPerpetual.sol`)

**Storage Location:** `PERPETUAL_STORAGE_POSITION = keccak256("babylon.perpetual.storage")`

#### PerpetualMarket Struct (per market)
- `bytes32 id` - Market identifier
- `string symbol` - Market symbol (e.g., "BTC-PERP")
- `address indexOracle` - Oracle address
- `uint256 fundingRate` - Current funding rate
- `uint256 lastFundingTime` - Last funding timestamp
- `uint256 maxLeverage` - Maximum leverage
- `uint256 maintenanceMarginRate` - Maintenance margin rate
- `uint256 initialMarginRate` - Initial margin rate
- `uint256 liquidationFee` - Liquidation fee
- `uint256 makerFee` - Maker fee
- `uint256 takerFee` - Taker fee
- `uint256 totalLongShares` - Total long position size
- `uint256 totalShortShares` - Total short position size
- `uint256 totalLongCollateral` - Total long collateral
- `uint256 totalShortCollateral` - Total short collateral
- `bool active` - Market active status
- `uint256 createdAt` - Creation timestamp

**MISSING:** Final prices per tick are NOT stored on-chain ✗

#### Position Struct (per user per market)
- `Side side` - Long or short
- `uint256 size` - Position size
- `uint256 collateral` - Collateral amount
- `uint256 entryPrice` - **ENTRY PRICE (STORED ON-CHAIN)** ✗
- `uint256 lastFundingIndex` - Last funding index
- `uint256 unrealizedPnl` - **UNREALIZED PNL (STORED ON-CHAIN)** ✗
- `uint256 realizedPnl` - **REALIZED PNL (STORED ON-CHAIN)** ✗

**Note:** Detailed position data should be off-chain per spec.

#### Order Struct (unused)
- Full order details stored on-chain (currently unused)

**Gas Cost Analysis:**
- Market creation: ~120k gas
- Position open: ~80k gas (includes entry price storage)
- Position close: ~60k gas

### 1.3 LibLiquidity Storage (`contracts/libraries/LibLiquidity.sol`)

**Storage Location:** `LIQUIDITY_STORAGE_POSITION = keccak256("babylon.liquidity.storage")`

#### LiquidityPool Struct
- `bytes32 id` - Pool identifier
- `bytes32 marketId` - Associated market
- `uint256 totalLiquidity` - Total liquidity
- `uint256 totalShares` - Total LP shares
- `uint256 feeRate` - Fee rate
- `uint256 utilizationRate` - Utilization rate
- `uint256 maxUtilization` - Max utilization
- `uint256 reserveA` - Reserve A
- `uint256 reserveB` - Reserve B
- `uint256 k` - Constant product
- `uint256 feesCollected` - Fees collected
- `bool active` - Active status
- `uint256 createdAt` - Creation timestamp

#### LPPosition Struct
- `uint256 shares` - LP token amount
- `uint256 depositedLiquidity` - Original deposit
- `uint256 rewardsClaimed` - Rewards claimed
- `uint256 lastDepositTime` - Last deposit time

**Note:** Liquidity pool data may not be needed on-chain per spec.

### 1.4 ERC-8004 Identity Registry (`contracts/identity/ERC8004IdentityRegistry.sol`)

**Storage:**
- `mapping(uint256 => AgentProfile) profiles` - Agent profiles
  - `string name` - Agent name (STORED ON-CHAIN)
  - `string endpoint` - A2A endpoint URL (STORED ON-CHAIN)
  - `bytes32 capabilitiesHash` - Capabilities hash
  - `uint256 registeredAt` - Registration timestamp
  - `bool isActive` - Active status
  - `string metadata` - JSON metadata (STORED ON-CHAIN)
- `mapping(address => uint256) addressToTokenId` - Address to token mapping
- `mapping(string => bool) endpointTaken` - Endpoint uniqueness
- `mapping(uint256 => Agent0Link) agent0Links` - Agent0 cross-chain links

**Note:** Identity data may be acceptable on-chain for agent discovery, but verify per spec.

### 1.5 ERC-8004 Reputation System (`contracts/identity/ERC8004ReputationSystem.sol`)

**Storage:**
- `mapping(uint256 => Reputation) reputations` - Reputation data
  - `uint256 totalBets` - Total bets
  - `uint256 winningBets` - Winning bets
  - `uint256 totalVolume` - Total volume
  - `uint256 profitLoss` - Net profit/loss
  - `uint256 accuracyScore` - Accuracy score (0-10000)
  - `uint256 trustScore` - Trust score (0-10000)
  - `uint256 lastUpdated` - Last update timestamp
  - `bool isBanned` - Ban status
- `mapping(uint256 => FeedbackEntry[]) feedback` - Feedback entries
- `mapping(uint256 => mapping(address => bool)) hasFeedback` - Feedback tracking

**Note:** Reputation updates are written on-chain after each question resolution. Verify if needed per spec.

## 2. Backend Blockchain Writes Analysis

### 2.1 User/Agent Registration (`src/lib/onboarding/onchain-service.ts`)

**When:** During user/agent onboarding

**What's Written:**
1. **Identity Registration** (`registerAgent`)
   - Agent name (string)
   - Endpoint URL (string)
   - Capabilities hash (bytes32)
   - Metadata JSON (string)
   - **Gas:** ~150k gas

2. **Initial Reputation Bootstrap** (`recordBet` x10, `recordWin` x7)
   - Bet records (10 transactions)
   - Win records (7 transactions)
   - **Gas:** ~17k gas per transaction = ~289k gas total

**Frequency:** Once per user/agent registration

### 2.2 Question Resolution (`src/lib/services/reputation-service.ts`)

**When:** After each prediction market question resolves

**What's Written:**
1. **Reputation Updates** (`recordWin` or `recordLoss`)
   - Token ID
   - Profit/loss amount
   - **Gas:** ~17k gas per position

**Frequency:** After every question resolution, for each user with a position

**Note:** Question outcomes are stored in `market.winningOutcome` via `PredictionMarketFacet.resolveMarket()`, but this is not consistently called from backend.

### 2.3 Profile Updates (`src/lib/profile/backend-signer.ts`)

**When:** User updates their profile

**What's Written:**
1. **Agent Profile Update** (`updateAgent`)
   - Endpoint URL (string)
   - Capabilities hash (bytes32)
   - Metadata JSON (string)
   - **Gas:** ~80k gas

**Frequency:** On-demand when user updates profile

### 2.4 Agent Onboarding (`src/app/api/agents/onboard/route.ts`)

**When:** Agent-specific onboarding

**What's Written:**
- Same as user registration (identity + reputation bootstrap)

## 3. Events Emitted (On-Chain Logs)

### PredictionMarketFacet Events
- `MarketCreated(bytes32 indexed marketId, string question, uint8 numOutcomes, uint256 liquidity)`
- `SharesPurchased(bytes32 indexed marketId, address indexed buyer, uint8 outcome, uint256 shares, uint256 cost)`
- `SharesSold(bytes32 indexed marketId, address indexed seller, uint8 outcome, uint256 shares, uint256 payout)`
- `MarketResolved(bytes32 indexed marketId, uint8 winningOutcome)` ✓ **QUESTION ANSWER**
- `PositionClaimed(bytes32 indexed marketId, address indexed claimer, uint256 payout)`
- `Deposited(address indexed user, uint256 amount)`
- `Withdrawn(address indexed user, uint256 amount)`

### PerpetualMarketFacet Events
- `PerpetualMarketCreated(bytes32 indexed marketId, string symbol, address indexed indexOracle)`
- `PositionOpened(bytes32 indexed marketId, address indexed trader, Side side, uint256 size, uint256 collateral, uint256 entryPrice)`
- `PositionClosed(bytes32 indexed marketId, address indexed trader, uint256 pnl)`
- `PositionLiquidated(bytes32 indexed marketId, address indexed trader, address indexed liquidator, uint256 liquidationFee)`
- `FundingPaid(bytes32 indexed marketId, address indexed trader, int256 fundingPayment)`
- `FundingRateUpdated(bytes32 indexed marketId, uint256 fundingRate)`

**MISSING:** No events for price updates per tick ✗

### Reputation System Events
- `ReputationUpdated(uint256 indexed tokenId, uint256 accuracyScore, uint256 trustScore)`
- `FeedbackSubmitted(uint256 indexed tokenId, address indexed from, int8 rating)`
- `AgentBanned(uint256 indexed tokenId)`
- `AgentUnbanned(uint256 indexed tokenId)`

## 4. Summary: What Should Be On-Chain vs What Is

### ✅ Should Be On-Chain (Per Spec)

1. **Final prices per tick for all perps**
   - **Status:** ❌ NOT IMPLEMENTED
   - **Current:** Prices stored only in database (`StockPrice` table, `Organization.currentPrice`)
   - **Required:** On-chain price storage per tick per market

2. **Question answers/resolutions**
   - **Status:** ⚠️ PARTIALLY IMPLEMENTED
   - **Current:** `market.winningOutcome` stored on-chain via `PredictionMarketFacet.resolveMarket()`
   - **Gap:** Not consistently called from backend; database `Question.resolvedOutcome` not synced

### ❌ Should NOT Be On-Chain (But Currently Is)

1. **Detailed position data**
   - Entry prices, collateral, unrealized PnL, realized PnL
   - **Current:** Stored in `LibPerpetual.Position` struct
   - **Recommendation:** Move off-chain, keep only settlement hash on-chain

2. **User balances**
   - Virtual balances for trading
   - **Current:** Stored in `LibMarket.balances` mapping
   - **Recommendation:** Keep off-chain, only settle final amounts on-chain

3. **Market creation metadata**
   - Timestamps, oracle addresses, liquidity parameters
   - **Current:** Full metadata stored
   - **Recommendation:** Keep minimal on-chain, full data off-chain

4. **Reputation updates**
   - Win/loss records after each resolution
   - **Current:** Written on-chain via `ReputationService`
   - **Recommendation:** Verify if needed for agent trust; if not, remove

5. **Identity metadata**
   - Agent names, endpoints, metadata JSON
   - **Current:** Stored in `ERC8004IdentityRegistry`
   - **Recommendation:** Verify if needed for agent discovery; consider IPFS for metadata

## 5. Gas Cost Summary

**Current On-Chain Operations:**
- Market creation: ~150k gas
- Position open: ~80k gas
- Position close: ~60k gas
- Question resolution: ~50k gas
- Reputation update: ~17k gas per position
- User registration: ~439k gas (identity + reputation bootstrap)

**Estimated Annual Costs (assuming 1000 users, 100 questions/year, 10k positions):**
- User registrations: ~439M gas
- Question resolutions: ~50M gas
- Reputation updates: ~170M gas (10 positions per question)
- **Total:** ~659M gas/year

**Potential Savings (if moving unnecessary data off-chain):**
- Position data: ~140k gas per position lifecycle (open + close)
- Balance updates: ~20k gas per update
- **Estimated savings:** ~1.4B gas/year (10k positions)

## 6. Recommendations

### Immediate Actions

1. **Implement on-chain price storage**
   - Create `PriceStorageFacet` for storing final prices per tick
   - Update `price-update-service.ts` to write prices to chain

2. **Fix question answer sync**
   - Ensure `PredictionMarketFacet.resolveMarket()` is called for all resolved questions
   - Sync database `Question.resolvedOutcome` with on-chain `market.winningOutcome`

### Future Optimizations

1. **Move position data off-chain**
   - Keep only position hash on-chain for verification
   - Store full position details in database

2. **Move balances off-chain**
   - Keep virtual balances in database
   - Only settle final amounts on-chain when needed

3. **Review reputation storage**
   - Determine if on-chain reputation is required
   - Consider off-chain reputation with on-chain verification

4. **Optimize identity storage**
   - Consider IPFS for metadata
   - Keep only essential on-chain (token ID, capabilities hash)

## 7. Compliance Status

**Current Compliance:** ❌ **NON-COMPLIANT**

**Missing:**
- Final prices per tick for perpetuals (not stored on-chain)
- Consistent question answer storage (partially implemented)

**Excess:**
- Detailed position data (should be off-chain)
- User balances (should be off-chain)
- Market metadata (should be minimal on-chain)
- Reputation updates (verify if needed)

## 7. Data Removal Proposals

### 7.1 Detailed Position Data (LibPerpetual.Position)
**Current:** Full position details stored on-chain (entry prices, collateral, PnL)  
**Proposal:** Move off-chain, keep only settlement hash on-chain  
**Gas Savings:** ~140k gas per position lifecycle

### 7.2 User Balances (LibMarket.balances)
**Current:** Virtual balances stored on-chain for all users  
**Proposal:** Move off-chain, settle on-chain only when needed  
**Gas Savings:** ~20k gas per balance update

### 7.3 Market Creation Metadata
**Current:** Full metadata (question strings, timestamps, oracle addresses)  
**Proposal:** Minimize on-chain, use IPFS for metadata  
**Gas Savings:** ~50k gas per market creation

### 7.4 Reputation Updates
**Current:** Win/loss records written on-chain after each resolution  
**Proposal:** Verify if needed per spec; if not, move off-chain  
**Gas Savings:** ~17k gas per reputation update

## 8. Implementation Roadmap

### Phase 1: Add Missing On-Chain Data (Critical)
**1.1 Price Storage** - Create `PriceStorageFacet`, update `price-update-service.ts` (2 weeks)  
**1.2 Question Answer Sync** - Add `onChainMarketId` to Market model, update `resolveQuestionPayouts()` (1 week)

### Phase 2: Remove Unnecessary Data (Optimization)
**2.1 Position Data Migration** - Design off-chain storage, migration script (3 weeks)  
**2.2 Balance Migration** - Move balances to database, update settlement (2 weeks)

### Phase 3: Optimization (Future)
**3.1 Market Metadata** - Move to IPFS (2 weeks)  
**3.2 Reputation Review** - Determine requirements, optimize (1 week)

## 9. Compliance Status

**Current Compliance:** ❌ **NON-COMPLIANT**

**Missing (Must Add):**
- ❌ Final prices per tick for perpetuals (not stored on-chain)
- ⚠️ Consistent question answer storage (contract exists but not called)

**Excess (Should Remove):**
- ✗ Detailed position data (should be off-chain)
- ✗ User balances (should be off-chain)
- ✗ Market metadata (should be minimal on-chain)
- ? Reputation updates (verify if needed)

**Priority:** Implement Phase 1 immediately, then Phase 2 for optimization.

