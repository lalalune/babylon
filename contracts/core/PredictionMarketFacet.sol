// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/LibMarket.sol";
import "../libraries/LibDiamond.sol";

/// @title PredictionMarketFacet
/// @notice Facet for prediction market operations
/// @dev Implements LMSR (Logarithmic Market Scoring Rule) pricing
contract PredictionMarketFacet is ReentrancyGuard {
    event MarketCreated(bytes32 indexed marketId, string question, uint8 numOutcomes, uint256 liquidity);
    event SharesPurchased(bytes32 indexed marketId, address indexed buyer, uint8 outcome, uint256 shares, uint256 cost);
    event SharesSold(bytes32 indexed marketId, address indexed seller, uint8 outcome, uint256 shares, uint256 payout);
    event MarketResolved(bytes32 indexed marketId, uint8 winningOutcome);
    event PositionClaimed(bytes32 indexed marketId, address indexed claimer, uint256 payout);
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    /// @notice Create a new prediction market
    /// @param _question The market question
    /// @param _outcomeNames Array of outcome names
    /// @param _resolveAt Timestamp when market can be resolved
    /// @param _oracle Address authorized to resolve the market
    /// @return marketId The created market ID
    function createMarket(
        string calldata _question,
        string[] calldata _outcomeNames,
        uint256 _resolveAt,
        address _oracle
    ) external returns (bytes32 marketId) {
        require(_outcomeNames.length >= 2 && _outcomeNames.length <= 10, "Invalid number of outcomes");
        require(_resolveAt > block.timestamp, "Resolve time must be in future");
        require(_oracle != address(0), "Invalid oracle address");

        LibMarket.MarketStorage storage ms = LibMarket.marketStorage();

        marketId = keccak256(abi.encodePacked(_question, block.timestamp, block.number));
        LibMarket.Market storage market = ms.markets[marketId];

        market.id = marketId;
        market.question = _question;
        market.numOutcomes = uint8(_outcomeNames.length);
        market.liquidity = ms.defaultLiquidity > 0 ? ms.defaultLiquidity : 1000 ether;
        market.createdAt = block.timestamp;
        market.resolveAt = _resolveAt;
        market.oracle = _oracle;
        market.feeRate = ms.defaultFeeRate > 0 ? ms.defaultFeeRate : 100; // 1% default

        for (uint8 i = 0; i < _outcomeNames.length; i++) {
            market.outcomeNames[i] = _outcomeNames[i];
            market.shares[i] = 0;
        }

        ms.marketIds.push(marketId);

        emit MarketCreated(marketId, _question, market.numOutcomes, market.liquidity);
    }

    /// @notice Calculate cost to buy shares using LMSR
    /// @param _marketId The market ID
    /// @param _outcome The outcome to buy
    /// @param _numShares Number of shares to buy
    /// @return cost The cost in wei
    function calculateCost(
        bytes32 _marketId,
        uint8 _outcome,
        uint256 _numShares
    ) public view returns (uint256 cost) {
        LibMarket.Market storage market = LibMarket.getMarket(_marketId);
        require(!market.resolved, "Market already resolved");
        require(_outcome < market.numOutcomes, "Invalid outcome");

        uint256 b = market.liquidity;

        // Calculate current cost function: C = b * ln(sum(e^(q_i/b)))
        uint256 currentCost = _costFunction(market, b);

        // Calculate new cost after adding shares
        uint256 newShares = market.shares[_outcome] + _numShares;
        uint256 newCost = _costFunctionWithShares(market, b, _outcome, newShares);

        // Cost is difference
        cost = newCost - currentCost;

        // Add fee
        uint256 fee = (cost * market.feeRate) / 10000;
        cost += fee;
    }

    /// @notice Buy shares in a market
    /// @param _marketId The market ID
    /// @param _outcome The outcome to buy
    /// @param _numShares Number of shares to buy
    function buyShares(
        bytes32 _marketId,
        uint8 _outcome,
        uint256 _numShares
    ) external nonReentrant {
        require(_numShares > 0, "Must buy at least 1 share");

        LibMarket.Market storage market = LibMarket.getMarket(_marketId);
        require(!market.resolved, "Market already resolved");
        require(block.timestamp < market.resolveAt, "Market expired");
        require(_outcome < market.numOutcomes, "Invalid outcome");

        uint256 cost = calculateCost(_marketId, _outcome, _numShares);

        // Check and deduct balance
        LibMarket.subtractBalance(msg.sender, cost);

        // Update market state (CEI pattern)
        market.shares[_outcome] += _numShares;
        market.totalVolume += cost;

        // Update position
        LibMarket.Position storage position = LibMarket.getPosition(msg.sender, _marketId);
        position.shares[_outcome] += _numShares;
        position.totalInvested += cost;

        // Distribute fee
        LibMarket.MarketStorage storage ms = LibMarket.marketStorage();
        uint256 fee = (cost * market.feeRate) / (10000 + market.feeRate);
        if (fee > 0 && ms.feeRecipient != address(0)) {
            LibMarket.addBalance(ms.feeRecipient, fee);
        }

        emit SharesPurchased(_marketId, msg.sender, _outcome, _numShares, cost);
    }

    /// @notice Sell shares in a market
    /// @param _marketId The market ID
    /// @param _outcome The outcome to sell
    /// @param _numShares Number of shares to sell
    function sellShares(
        bytes32 _marketId,
        uint8 _outcome,
        uint256 _numShares
    ) external nonReentrant {
        require(_numShares > 0, "Must sell at least 1 share");

        LibMarket.Market storage market = LibMarket.getMarket(_marketId);
        require(!market.resolved, "Market already resolved");
        require(_outcome < market.numOutcomes, "Invalid outcome");

        LibMarket.Position storage position = LibMarket.getPosition(msg.sender, _marketId);
        require(position.shares[_outcome] >= _numShares, "Insufficient shares");

        // Calculate payout (negative cost)
        uint256 payout = calculateSellPayout(_marketId, _outcome, _numShares);

        // Update position
        position.shares[_outcome] -= _numShares;

        // Update market
        market.shares[_outcome] -= _numShares;

        // Add to balance
        LibMarket.addBalance(msg.sender, payout);

        emit SharesSold(_marketId, msg.sender, _outcome, _numShares, payout);
    }

    /// @notice Calculate payout for selling shares
    function calculateSellPayout(
        bytes32 _marketId,
        uint8 _outcome,
        uint256 _numShares
    ) public view returns (uint256 payout) {
        LibMarket.Market storage market = LibMarket.getMarket(_marketId);
        uint256 b = market.liquidity;

        // Current cost
        uint256 currentCost = _costFunction(market, b);

        // Cost after removing shares
        uint256 newShares = market.shares[_outcome] - _numShares;
        uint256 newCost = _costFunctionWithShares(market, b, _outcome, newShares);

        // Payout is difference (minus fee)
        payout = currentCost - newCost;
        uint256 fee = (payout * market.feeRate) / 10000;
        payout -= fee;
    }

    /// @notice Resolve a market
    /// @param _marketId The market ID
    /// @param _winningOutcome The winning outcome
    function resolveMarket(bytes32 _marketId, uint8 _winningOutcome) external {
        LibMarket.Market storage market = LibMarket.getMarket(_marketId);
        require(!market.resolved, "Already resolved");
        require(msg.sender == market.oracle, "Only oracle can resolve");
        require(block.timestamp >= market.resolveAt, "Too early to resolve");
        require(_winningOutcome < market.numOutcomes, "Invalid outcome");

        market.resolved = true;
        market.winningOutcome = _winningOutcome;

        emit MarketResolved(_marketId, _winningOutcome);
    }

    /// @notice Claim winnings after market resolution
    /// @param _marketId The market ID
    function claimWinnings(bytes32 _marketId) external nonReentrant {
        LibMarket.Market storage market = LibMarket.getMarket(_marketId);
        require(market.resolved, "Market not resolved");

        LibMarket.Position storage position = LibMarket.getPosition(msg.sender, _marketId);
        uint256 winningShares = position.shares[market.winningOutcome];
        require(winningShares > 0, "No winning shares");

        // Calculate payout (1:1 for winning shares)
        uint256 payout = winningShares * 1 ether;

        // Clear position
        position.shares[market.winningOutcome] = 0;

        // Add to balance
        LibMarket.addBalance(msg.sender, payout);

        emit PositionClaimed(_marketId, msg.sender, payout);
    }

    /// @notice Deposit funds
    function deposit() external payable {
        require(msg.value > 0, "Must deposit some amount");
        LibMarket.addBalance(msg.sender, msg.value);
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Withdraw funds
    /// @param _amount Amount to withdraw
    function withdraw(uint256 _amount) external nonReentrant {
        LibMarket.subtractBalance(msg.sender, _amount);
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Transfer failed");
        emit Withdrawn(msg.sender, _amount);
    }

    /// @notice Get balance
    function getBalance(address _user) external view returns (uint256) {
        return LibMarket.getBalance(_user);
    }

    /// @notice Get market info
    function getMarket(bytes32 _marketId) external view returns (
        string memory question,
        uint8 numOutcomes,
        uint256 liquidity,
        bool resolved,
        uint8 winningOutcome
    ) {
        LibMarket.Market storage market = LibMarket.getMarket(_marketId);
        return (
            market.question,
            market.numOutcomes,
            market.liquidity,
            market.resolved,
            market.winningOutcome
        );
    }

    /// @notice Get market shares for outcome
    function getMarketShares(bytes32 _marketId, uint8 _outcome) external view returns (uint256) {
        LibMarket.Market storage market = LibMarket.getMarket(_marketId);
        return market.shares[_outcome];
    }

    /// @notice Get user position
    function getPosition(address _user, bytes32 _marketId, uint8 _outcome) external view returns (uint256) {
        LibMarket.Position storage position = LibMarket.getPosition(_user, _marketId);
        return position.shares[_outcome];
    }

    // Internal LMSR cost function
    function _costFunction(LibMarket.Market storage market, uint256 b) internal view returns (uint256) {
        uint256 sum = 0;
        for (uint8 i = 0; i < market.numOutcomes; i++) {
            sum += _exp((market.shares[i] * 1e18) / b);
        }
        return (b * _ln(sum)) / 1e18;
    }

    function _costFunctionWithShares(
        LibMarket.Market storage market,
        uint256 b,
        uint8 outcome,
        uint256 newShares
    ) internal view returns (uint256) {
        uint256 sum = 0;
        for (uint8 i = 0; i < market.numOutcomes; i++) {
            uint256 shares = (i == outcome) ? newShares : market.shares[i];
            sum += _exp((shares * 1e18) / b);
        }
        return (b * _ln(sum)) / 1e18;
    }

    // Simple exp approximation (for small values)
    function _exp(uint256 x) internal pure returns (uint256) {
        // Taylor series: e^x = 1 + x + x^2/2! + x^3/3! + ...
        // For x in range [0, 10] this gives reasonable accuracy
        uint256 sum = 1e18;
        uint256 term = x;
        sum += term;
        term = (term * x) / 2e18;
        sum += term;
        term = (term * x) / 3e18;
        sum += term;
        term = (term * x) / 4e18;
        sum += term;
        return sum;
    }

    /// @notice Natural logarithm approximation using Taylor series
    /// @dev Uses ln(1+z) ≈ z - z²/2 + z³/3 - z⁴/4 + z⁵/5 for |z| < 1
    /// @dev For values far from 1e18, uses iterative scaling via ln(x*2^n) = ln(x) + n*ln(2)
    /// @param x Input value in fixed-point (1e18 = 1.0), must be > 0
    /// @return Result in fixed-point (1e18 = ln(1) = 0)
    function _ln(uint256 x) internal pure returns (uint256) {
        require(x > 0, "ln of zero");
        
        // Handle edge case: ln(1) = 0
        if (x == 1e18) return 0;
        
        // Normalize to range [0.5e18, 2e18] using ln(x * 2^n) = ln(x) + n*ln(2)
        int256 scaleFactor = 0; // Track how many times we've scaled (can be negative)
        uint256 normalized = x;
        
        // Scale down if x > 2e18 (divide by 2, add ln(2))
        while (normalized > 2e18) {
            normalized = normalized / 2;
            scaleFactor += 1;
        }
        
        // Scale up if x < 0.5e18 (multiply by 2, subtract ln(2))
        while (normalized < 5e17) {
            normalized = normalized * 2;
            scaleFactor -= 1;
        }
        
        // Now normalized is in [0.5e18, 2e18]
        // Calculate z = normalized - 1e18 (in fixed-point, range [-0.5e18, 1e18])
        int256 z = int256(normalized) - int256(1e18);
        
        // Taylor series: ln(1+z) ≈ z - z²/2 + z³/3 - z⁴/4 + z⁵/5
        // All calculations in fixed-point (1e18 scale)
        int256 z2 = (z * z) / int256(1e18);
        int256 z3 = (z2 * z) / int256(1e18);
        int256 z4 = (z3 * z) / int256(1e18);
        int256 z5 = (z4 * z) / int256(1e18);
        
        // Compute Taylor series approximation
        int256 taylor = z 
            - z2 / 2 
            + z3 / 3 
            - z4 / 4 
            + z5 / 5;
        
        // Add scaling: result = taylor + scaleFactor * ln(2)
        // ln(2) ≈ 0.6931471805599453 (scaled by 1e18)
        int256 ln2_scaled = 693147180559945344;
        int256 scaled = scaleFactor * ln2_scaled;
        int256 result = taylor + scaled;
        
        // For LMSR, result should be non-negative in practice (we're taking ln of sum of exponentials)
        // But handle potential negative gracefully by returning 0 (shouldn't happen in normal operation)
        if (result < 0) {
            return 0;
        }
        
        return uint256(result);
    }
}
