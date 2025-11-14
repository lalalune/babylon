// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IPredictionOracle {
    function getOutcome(bytes32 sessionId) external view returns (bool outcome, bool finalized);
    function games(bytes32 sessionId) external view returns (
        bytes32 _sessionId,
        string memory question,
        bool outcome,
        bytes32 commitment,
        bytes32 salt,
        uint256 startTime,
        uint256 endTime,
        bytes memory teeQuote,
        address[] memory winners,
        uint256 totalPayout,
        bool finalized
    );
}

/**
 * @title Predimarket
 * @notice LMSR-based prediction market for oracle-based games
 * @dev Implements Logarithmic Market Scoring Rule for continuous automated market making
 * 
 * Current Implementation: Binary Markets (YES/NO)
 * - Works with any IPredictionOracle implementation
 * - Maps contest results to binary outcomes
 * - Example: "Will Storm or Blaze win?" (horses 2-3 = YES, horses 0-1 = NO)
 * 
 * Future Enhancement: Multi-Option Markets
 * - Add support for "Who will win?" with N options
 * - Implement LMSR across all options simultaneously
 * - Example: Thunder | Lightning | Storm | Blaze (4 separate betting pools)
 * - See docs/enhancements/multi-option-lmsr.md for specification
 * 
 * Supported Oracle Types:
 * - PredictionOracle.sol (Caliguland)
 * - Contest.sol (eHorse, contests) - maps rankings to binary
 * - Any IPredictionOracle implementation
 */
contract Predimarket is ReentrancyGuard, Pausable, Ownable {
    enum GameType {
        GENERIC,          // Generic prediction market
        CALIGULAND,       // Caliguland social deduction game
        CONTEST,          // Contest oracle (eHorse, tournaments, etc.)
        HYPERSCAPE,       // Hyperscape RPG battles
        CUSTOM            // Custom oracle game
    }
    
    enum MarketCategory {
        GENERAL,
        MODERATION_NETWORK_BAN,
        MODERATION_APP_BAN,
        MODERATION_LABEL_HACKER,
        MODERATION_LABEL_SCAMMER,
        MODERATION_APPEAL
    }
    
    struct ModerationMetadata {
        uint256 targetAgentId;
        bytes32 evidenceHash;
        address reporter;
        uint256 reportId;
    }
    
    struct Market {
        bytes32 sessionId;
        string question;
        uint256 yesShares;
        uint256 noShares;
        uint256 liquidityParameter;
        uint256 totalVolume;
        uint256 createdAt;
        bool resolved;
        bool outcome;
        GameType gameType;      // Type of game for this market
        address gameContract;   // Address of game contract (oracle)
        MarketCategory category; // Moderation category
    }
    
    /// @notice Track deposits per market per token (fixes multi-market payout bug)
    mapping(bytes32 => mapping(address => uint256)) public marketTokenDeposits;

    struct Position {
        uint256 yesShares;
        uint256 noShares;
        uint256 totalSpent;
        uint256 totalReceived;
        bool hasClaimed;
    }

    IERC20 public immutable paymentToken; // Default payment token (was elizaOS)
    IPredictionOracle public immutable oracle;
    address public immutable treasury;
    
    uint256 public constant PLATFORM_FEE = 100; // 1% in basis points
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant DEFAULT_LIQUIDITY = 1000 * 1e18; // Default b parameter

    mapping(bytes32 => Market) public markets;
    mapping(bytes32 => mapping(address => Position)) public positions;
    
    /// @notice Supported payment tokens (elizaOS, CLANKER, VIRTUAL, CLANKERMON)
    mapping(address => bool) public supportedTokens;
    
    /// @notice Authorized market creators (for moderation system)
    mapping(address => bool) public authorizedCreators;
    
    /// @notice Moderation metadata per market
    mapping(bytes32 => ModerationMetadata) public moderationMetadata;
    
    bytes32[] public allMarketIds;

    event MarketCreated(bytes32 indexed sessionId, string question, uint256 liquidity, GameType gameType, address indexed gameContract);
    event SharesPurchased(bytes32 indexed sessionId, address indexed trader, bool outcome, uint256 shares, uint256 cost, address paymentToken);
    event SharesSold(bytes32 indexed sessionId, address indexed trader, bool outcome, uint256 shares, uint256 payout, address paymentToken);
    event MarketResolved(bytes32 indexed sessionId, bool outcome);
    event PayoutClaimed(bytes32 indexed sessionId, address indexed trader, uint256 amount);
    event TokenSupportUpdated(address indexed token, bool supported);

    error MarketExists();
    error MarketNotFound();
    error MarketAlreadyResolved();
    error MarketNotResolved();
    error InsufficientShares();
    error SlippageTooHigh();
    error NoWinningShares();
    error AlreadyClaimed();
    error UnsupportedPaymentToken();
    error NotAuthorizedCreator();

    constructor(
        address _defaultToken,
        address _oracle,
        address _treasury,
        address _owner
    ) Ownable(_owner) {
        require(_defaultToken != address(0), "Invalid payment token");
        require(_oracle != address(0), "Invalid oracle");
        require(_treasury != address(0), "Invalid treasury");
        
        paymentToken = IERC20(_defaultToken);
        oracle = IPredictionOracle(_oracle);
        treasury = _treasury;
        
        // Enable default token
        supportedTokens[_defaultToken] = true;
    }
    
    /**
     * @notice Add support for a new payment token (CLANKER, VIRTUAL, CLANKERMON, etc)
     * @param token Token address to enable/disable
     * @param supported Whether token should be accepted
     */
    function setTokenSupport(address token, bool supported) external onlyOwner {
        require(token != address(0), "Invalid token address");
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }
    
    /**
     * @notice Get immutable elizaOS address for backwards compatibility
     */
    function elizaOS() external view returns (address) {
        return address(paymentToken);
    }

    /**
     * @notice Create a new prediction market
     * @param sessionId Oracle session ID
     * @param question Market question
     * @param liquidityParameter LMSR liquidity parameter (b)
     */
    function createMarket(
        bytes32 sessionId,
        string calldata question,
        uint256 liquidityParameter
    ) external onlyOwner {
        _createMarketWithType(sessionId, question, liquidityParameter, GameType.GENERIC, address(oracle), MarketCategory.GENERAL);
    }
    
    /**
     * @notice Create moderation market (authorized creators only)
     * @param sessionId Market ID
     * @param question Market question
     * @param liquidityParameter LMSR liquidity parameter
     * @param category Moderation category
     * @param metadata Moderation metadata
     */
    function createModerationMarket(
        bytes32 sessionId,
        string calldata question,
        uint256 liquidityParameter,
        MarketCategory category,
        ModerationMetadata calldata metadata
    ) external {
        if (!authorizedCreators[msg.sender]) revert NotAuthorizedCreator();
        _createMarketWithType(sessionId, question, liquidityParameter, GameType.GENERIC, address(oracle), category);
        moderationMetadata[sessionId] = metadata;
    }
    
    function createMarketWithType(
        bytes32 sessionId,
        string calldata question,
        uint256 liquidityParameter,
        GameType gameType,
        address gameContract
    ) external onlyOwner {
        _createMarketWithType(sessionId, question, liquidityParameter, gameType, gameContract, MarketCategory.GENERAL);
    }
    
    function _createMarketWithType(
        bytes32 sessionId,
        string calldata question,
        uint256 liquidityParameter,
        GameType gameType,
        address gameContract,
        MarketCategory category
    ) private {
        if (markets[sessionId].createdAt != 0) revert MarketExists();
        if (liquidityParameter == 0) {
            liquidityParameter = DEFAULT_LIQUIDITY;
        }

        markets[sessionId] = Market({
            sessionId: sessionId,
            question: question,
            yesShares: 0,
            noShares: 0,
            liquidityParameter: liquidityParameter,
            totalVolume: 0,
            createdAt: block.timestamp,
            resolved: false,
            outcome: false,
            gameType: gameType,
            gameContract: gameContract,
            category: category
        });

        allMarketIds.push(sessionId);
        emit MarketCreated(sessionId, question, liquidityParameter, gameType, gameContract);
    }

    /**
     * @notice Buy shares in a market with any supported token
     * @param sessionId Market ID
     * @param outcome true for YES, false for NO
     * @param tokenAmount Amount of tokens to spend
     * @param minShares Minimum shares to receive (slippage protection)
     * @param token Payment token (elizaOS, CLANKER, VIRTUAL, or CLANKERMON)
     * @return shares Number of shares purchased
     */
    function buy(
        bytes32 sessionId,
        bool outcome,
        uint256 tokenAmount,
        uint256 minShares,
        address token
    ) external nonReentrant whenNotPaused returns (uint256 shares) {
        Market storage market = markets[sessionId];
        if (market.createdAt == 0) revert MarketNotFound();
        if (market.resolved) revert MarketAlreadyResolved();
        if (!supportedTokens[token]) revert UnsupportedPaymentToken();

        // Calculate shares received
        shares = calculateSharesReceived(sessionId, outcome, tokenAmount);
        if (shares < minShares) revert SlippageTooHigh();

        // Transfer tokens from user
        require(IERC20(token).transferFrom(msg.sender, address(this), tokenAmount), "Transfer failed");

        // Track deposits per market per token
        marketTokenDeposits[sessionId][token] += tokenAmount;

        // Update market state
        if (outcome) {
            market.yesShares += shares;
        } else {
            market.noShares += shares;
        }
        market.totalVolume += tokenAmount;

        // Update user position
        Position storage position = positions[sessionId][msg.sender];
        if (outcome) {
            position.yesShares += shares;
        } else {
            position.noShares += shares;
        }
        position.totalSpent += tokenAmount;

        emit SharesPurchased(sessionId, msg.sender, outcome, shares, tokenAmount, token);
    }
    
    /**
     * @notice Buy shares with default payment token (simple 4-param version)
     */
    function buy(
        bytes32 sessionId,
        bool outcome,
        uint256 tokenAmount,
        uint256 minShares
    ) external nonReentrant whenNotPaused returns (uint256 shares) {
        Market storage market = markets[sessionId];
        if (market.createdAt == 0) revert MarketNotFound();
        if (market.resolved) revert MarketAlreadyResolved();
        
        // Use default payment token
        address token = address(paymentToken);

        // Calculate shares received
        shares = calculateSharesReceived(sessionId, outcome, tokenAmount);
        if (shares < minShares) revert SlippageTooHigh();

        // Transfer tokens from user
        require(IERC20(token).transferFrom(msg.sender, address(this), tokenAmount), "Transfer failed");

        // Track deposits per market per token
        marketTokenDeposits[sessionId][token] += tokenAmount;

        // Update market state
        if (outcome) {
            market.yesShares += shares;
        } else {
            market.noShares += shares;
        }
        market.totalVolume += tokenAmount;

        // Update user position
        Position storage position = positions[sessionId][msg.sender];
        if (outcome) {
            position.yesShares += shares;
        } else {
            position.noShares += shares;
        }
        position.totalSpent += tokenAmount;

        emit SharesPurchased(sessionId, msg.sender, outcome, shares, tokenAmount, token);
    }

    /**
     * @notice Sell shares back to the market in any supported token
     * @param sessionId Market ID
     * @param outcome true for YES, false for NO
     * @param shareAmount Number of shares to sell
     * @param minPayout Minimum payout to receive (slippage protection)
     * @param token Token to receive payout in
     * @param deadline Transaction must execute before this timestamp (anti-MEV)
     * @return payout Amount of tokens received
     */
    function sell(
        bytes32 sessionId,
        bool outcome,
        uint256 shareAmount,
        uint256 minPayout,
        address token,
        uint256 deadline
    ) external nonReentrant whenNotPaused returns (uint256 payout) {
        require(block.timestamp <= deadline, "Transaction expired");
        
        Market storage market = markets[sessionId];
        if (market.createdAt == 0) revert MarketNotFound();
        if (market.resolved) revert MarketAlreadyResolved();
        if (!supportedTokens[token]) revert UnsupportedPaymentToken();

        Position storage position = positions[sessionId][msg.sender];
        
        // Check user has enough shares
        if (outcome && position.yesShares < shareAmount) revert InsufficientShares();
        if (!outcome && position.noShares < shareAmount) revert InsufficientShares();

        // Calculate payout
        payout = calculatePayout(sessionId, outcome, shareAmount);
        if (payout < minPayout) revert SlippageTooHigh();

        // Update market state
        if (outcome) {
            market.yesShares -= shareAmount;
        } else {
            market.noShares -= shareAmount;
        }

        // Update user position
        if (outcome) {
            position.yesShares -= shareAmount;
        } else {
            position.noShares -= shareAmount;
        }
        position.totalReceived += payout;

        // Update market deposits (track withdrawals)
        marketTokenDeposits[sessionId][token] -= payout;

        // Transfer payout in requested token
        require(IERC20(token).transfer(msg.sender, payout), "Transfer failed");

        emit SharesSold(sessionId, msg.sender, outcome, shareAmount, payout, token);
    }
    
    /**
     * @notice Sell shares with default payment token (simple 4-param version)
     */
    function sell(
        bytes32 sessionId,
        bool outcome,
        uint256 shareAmount,
        uint256 minPayout
    ) external nonReentrant whenNotPaused returns (uint256 payout) {
        Market storage market = markets[sessionId];
        if (market.createdAt == 0) revert MarketNotFound();
        if (market.resolved) revert MarketAlreadyResolved();
        
        // Use default payment token
        address token = address(paymentToken);

        Position storage position = positions[sessionId][msg.sender];
        
        // Check user has enough shares
        if (outcome && position.yesShares < shareAmount) revert InsufficientShares();
        if (!outcome && position.noShares < shareAmount) revert InsufficientShares();

        // Calculate payout
        payout = calculatePayout(sessionId, outcome, shareAmount);
        if (payout < minPayout) revert SlippageTooHigh();

        // Update market state
        if (outcome) {
            market.yesShares -= shareAmount;
        } else {
            market.noShares -= shareAmount;
        }

        // Update user position
        if (outcome) {
            position.yesShares -= shareAmount;
        } else {
            position.noShares -= shareAmount;
        }
        position.totalReceived += payout;

        // Update market deposits (track withdrawals)
        marketTokenDeposits[sessionId][token] -= payout;

        // Transfer payout to user
        require(IERC20(token).transfer(msg.sender, payout), "Transfer failed");

        emit SharesSold(sessionId, msg.sender, outcome, shareAmount, payout, token);
    }

    /**
     * @notice Resolve market based on oracle outcome
     * @param sessionId Market ID
     */
    function resolveMarket(bytes32 sessionId) external nonReentrant {
        Market storage market = markets[sessionId];
        if (market.createdAt == 0) revert MarketNotFound();
        if (market.resolved) revert MarketAlreadyResolved();

        (bool oracleOutcome, bool finalized) = oracle.getOutcome(sessionId);
        require(finalized, "Oracle not finalized");

        market.resolved = true;
        market.outcome = oracleOutcome;

        emit MarketResolved(sessionId, oracleOutcome);
    }

    /**
     * @notice Claim winnings after market resolution in any supported token
     * @param sessionId Market ID
     * @param token Token to receive payout in
     * @return payout Amount claimed
     */
    function claimPayout(bytes32 sessionId, address token) external nonReentrant returns (uint256 payout) {
        Market storage market = markets[sessionId];
        if (!market.resolved) revert MarketNotResolved();
        if (!supportedTokens[token]) revert UnsupportedPaymentToken();

        Position storage position = positions[sessionId][msg.sender];
        if (position.hasClaimed) revert AlreadyClaimed();

        // Calculate payout based on winning shares
        uint256 winningShares = market.outcome ? position.yesShares : position.noShares;
        if (winningShares == 0) revert NoWinningShares();

        uint256 totalWinningShares = market.outcome ? market.yesShares : market.noShares;
        
        // Use market-specific pool instead of entire contract balance
        uint256 marketPool = marketTokenDeposits[sessionId][token];
        uint256 platformFeeAmount = (marketPool * PLATFORM_FEE) / BASIS_POINTS;
        uint256 payoutPool = marketPool - platformFeeAmount;
        
        payout = (payoutPool * winningShares) / totalWinningShares;
        position.hasClaimed = true;

        // Update market deposits
        marketTokenDeposits[sessionId][token] -= (payout + platformFeeAmount);

        // Transfer platform fee to treasury
        require(IERC20(token).transfer(treasury, platformFeeAmount), "Transfer failed");
        
        // Transfer payout to user
        require(IERC20(token).transfer(msg.sender, payout), "Transfer failed");

        emit PayoutClaimed(sessionId, msg.sender, payout);
    }
    
    /**
     * @notice Claim with default payment token (backwards compatibility)
     */
    function claimPayout(bytes32 sessionId) external nonReentrant returns (uint256 payout) {
        Market storage market = markets[sessionId];
        if (!market.resolved) revert MarketNotResolved();

        // Use default payment token
        address token = address(paymentToken);

        Position storage position = positions[sessionId][msg.sender];
        if (position.hasClaimed) revert AlreadyClaimed();

        // Calculate payout based on winning shares
        uint256 winningShares = market.outcome ? position.yesShares : position.noShares;
        if (winningShares == 0) revert NoWinningShares();

        uint256 totalWinningShares = market.outcome ? market.yesShares : market.noShares;
        
        // Use market-specific pool instead of entire contract balance
        uint256 marketPool = marketTokenDeposits[sessionId][token];
        uint256 platformFeeAmount = (marketPool * PLATFORM_FEE) / BASIS_POINTS;
        uint256 payoutPool = marketPool - platformFeeAmount;
        
        payout = (payoutPool * winningShares) / totalWinningShares;
        position.hasClaimed = true;

        // Update market deposits
        marketTokenDeposits[sessionId][token] -= (payout + platformFeeAmount);

        // Transfer platform fee to treasury
        require(IERC20(token).transfer(treasury, platformFeeAmount), "Transfer failed");
        
        // Transfer payout to user
        require(IERC20(token).transfer(msg.sender, payout), "Transfer failed");

        emit PayoutClaimed(sessionId, msg.sender, payout);
    }

    /**
     * @notice Calculate shares received for a given elizaOS amount (LMSR)
     * @param sessionId Market ID
     * @param outcome true for YES, false for NO
     * @param elizaOSAmount Amount to spend
     * @return shares Number of shares received
     */
    function calculateSharesReceived(
        bytes32 sessionId,
        bool outcome,
        uint256 elizaOSAmount
    ) public view returns (uint256 shares) {
        Market storage market = markets[sessionId];
        uint256 b = market.liquidityParameter;
        uint256 qYes = market.yesShares;
        uint256 qNo = market.noShares;

        // Cost function: C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))
        uint256 costBefore = _costFunction(qYes, qNo, b);
        
        // Binary search to find shares that match the cost
        uint256 low = 0;
        uint256 high = elizaOSAmount * 10; // Upper bound estimate
        uint256 targetCost = costBefore + elizaOSAmount;

        while (low < high) {
            uint256 mid = (low + high + 1) / 2;
            uint256 newQYes = outcome ? qYes + mid : qYes;
            uint256 newQNo = outcome ? qNo : qNo + mid;
            uint256 costAfter = _costFunction(newQYes, newQNo, b);

            if (costAfter <= targetCost) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }

        shares = low;
    }

    /**
     * @notice Calculate payout for selling shares (LMSR)
     * @param sessionId Market ID
     * @param outcome true for YES, false for NO
     * @param shareAmount Number of shares to sell
     * @return payout Amount of elizaOS received
     */
    function calculatePayout(
        bytes32 sessionId,
        bool outcome,
        uint256 shareAmount
    ) public view returns (uint256 payout) {
        Market storage market = markets[sessionId];
        uint256 b = market.liquidityParameter;
        uint256 qYes = market.yesShares;
        uint256 qNo = market.noShares;

        uint256 costBefore = _costFunction(qYes, qNo, b);
        
        uint256 newQYes = outcome ? qYes - shareAmount : qYes;
        uint256 newQNo = outcome ? qNo : qNo - shareAmount;
        uint256 costAfter = _costFunction(newQYes, newQNo, b);

        payout = costBefore - costAfter;
    }

    /**
     * @notice Get current market prices (probability percentages)
     * @param sessionId Market ID
     * @return yesPrice Price of YES in basis points (10000 = 100%)
     * @return noPrice Price of NO in basis points (10000 = 100%)
     */
    function getMarketPrices(bytes32 sessionId) external view returns (uint256 yesPrice, uint256 noPrice) {
        Market storage market = markets[sessionId];
        uint256 b = market.liquidityParameter;
        uint256 qYes = market.yesShares;
        uint256 qNo = market.noShares;

        // P(YES) = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
        // Simplified using exp approximation for display
        uint256 expYes = _exp(qYes * 1e18 / b);
        uint256 expNo = _exp(qNo * 1e18 / b);
        uint256 sum = expYes + expNo;

        yesPrice = (expYes * BASIS_POINTS) / sum;
        noPrice = (expNo * BASIS_POINTS) / sum;
    }

    /**
     * @notice Get market details
     */
    function getMarket(bytes32 sessionId) external view returns (Market memory) {
        return markets[sessionId];
    }

    /**
     * @notice Get user position in a market
     */
    function getPosition(bytes32 sessionId, address trader) external view returns (Position memory) {
        return positions[sessionId][trader];
    }

    /**
     * @notice Get total number of markets
     */
    function getMarketCount() external view returns (uint256) {
        return allMarketIds.length;
    }

    /**
     * @notice Get market ID by index
     */
    function getMarketIdAt(uint256 index) external view returns (bytes32) {
        return allMarketIds[index];
    }

    // ============ Internal LMSR Math ============

    /**
     * @notice LMSR cost function: C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))
     */
    function _costFunction(uint256 qYes, uint256 qNo, uint256 b) internal pure returns (uint256) {
        require(b > 0, "Invalid liquidity");
        
        // Simplified calculation using exp approximation
        uint256 expYes = _exp(qYes * 1e18 / b);
        uint256 expNo = _exp(qNo * 1e18 / b);
        uint256 sum = expYes + expNo;
        
        return (b * _ln(sum)) / 1e18;
    }

    /**
     * @notice Approximation of e^x for x in [0, 10]
     * @dev Uses Taylor series for small x
     */
    function _exp(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 1e18;
        if (x > 10e18) return type(uint256).max / 1e18; // Overflow protection
        
        // e^x ≈ 1 + x + x^2/2! + x^3/3! + x^4/4! + x^5/5!
        uint256 result = 1e18;
        uint256 term = x;
        
        result += term;
        term = (term * x) / (2 * 1e18);
        result += term;
        term = (term * x) / (3 * 1e18);
        result += term;
        term = (term * x) / (4 * 1e18);
        result += term;
        term = (term * x) / (5 * 1e18);
        result += term;
        
        return result;
    }

    /**
     * @notice Approximation of ln(x) for x > 0
     * @dev Uses change of base and binary search
     */
    function _ln(uint256 x) internal pure returns (uint256) {
        require(x > 0, "ln(0) undefined");
        if (x == 1e18) return 0;
        
        // For x close to 1, use Taylor series: ln(1+y) ≈ y - y^2/2 + y^3/3 - y^4/4
        if (x > 0.5e18 && x < 1.5e18) {
            int256 y = int256(x) - 1e18;
            int256 result = y;
            int256 term = y;
            
            term = -(term * y) / 1e18 / 2;
            result += term;
            term = -(term * y) / 1e18 * 2 / 3;
            result += term;
            term = -(term * y) / 1e18 * 3 / 4;
            result += term;
            
            return uint256(result);
        }
        
        // For other values, use simpler approximation
        // ln(x) ≈ 2 * ((x-1)/(x+1))
        uint256 numerator = (x - 1e18) * 2 * 1e18;
        uint256 denominator = x + 1e18;
        return numerator / denominator;
    }

    // ============ Admin Functions ============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function version() external pure returns (string memory) {
        return "1.0.0";
    }
    
    /**
     * @notice Get markets filtered by game type
     * @param gameType The game type to filter by
     * @return Market IDs matching the game type
     */
    function getMarketsByGameType(GameType gameType) external view returns (bytes32[] memory) {
        uint256 count = 0;
        // Gas optimized: cache array length and market
        uint256 length = allMarketIds.length;
        for (uint256 i = 0; i < length; i++) {
            if (markets[allMarketIds[i]].gameType == gameType) {
                count++;
            }
        }
        
        bytes32[] memory filtered = new bytes32[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allMarketIds.length; i++) {
            if (markets[allMarketIds[i]].gameType == gameType) {
                filtered[index++] = allMarketIds[i];
            }
        }
        
        return filtered;
    }
    
    /**
     * @notice Get markets for a specific game contract
     * @param gameContract Address of the game contract
     * @return Market IDs for this game
     */
    function getMarketsByGame(address gameContract) external view returns (bytes32[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < allMarketIds.length; i++) {
            if (markets[allMarketIds[i]].gameContract == gameContract) {
                count++;
            }
        }
        
        bytes32[] memory filtered = new bytes32[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allMarketIds.length; i++) {
            if (markets[allMarketIds[i]].gameContract == gameContract) {
                filtered[index++] = allMarketIds[i];
            }
        }
        
        return filtered;
    }
    
    /**
     * @notice Get markets by category (e.g., all moderation markets)
     * @param category Market category
     * @return Market IDs matching category
     */
    function getMarketsByCategory(MarketCategory category) external view returns (bytes32[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < allMarketIds.length; i++) {
            if (markets[allMarketIds[i]].category == category) {
                count++;
            }
        }
        
        bytes32[] memory filtered = new bytes32[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allMarketIds.length; i++) {
            if (markets[allMarketIds[i]].category == category) {
                filtered[index++] = allMarketIds[i];
            }
        }
        
        return filtered;
    }
    
    /**
     * @notice Add authorized market creator (for moderation system)
     * @param creator Address to authorize
     */
    function addAuthorizedCreator(address creator) external onlyOwner {
        authorizedCreators[creator] = true;
    }
    
    /**
     * @notice Remove authorized market creator
     * @param creator Address to remove
     */
    function removeAuthorizedCreator(address creator) external onlyOwner {
        authorizedCreators[creator] = false;
    }
    
    /**
     * @notice Get moderation metadata for a market
     * @param sessionId Market ID
     * @return Moderation metadata
     */
    function getModerationMetadata(bytes32 sessionId) external view returns (ModerationMetadata memory) {
        return moderationMetadata[sessionId];
    }
}


