// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

interface IPredimarket {
    function createMarket(bytes32 sessionId, string calldata question, uint256 liquidityParameter) external;
}

interface IPredictionOracle {
    function getOutcome(bytes32 sessionId) external view returns (bool outcome, bool finalized);
    function verifyCommitment(bytes32 commitment) external view returns (bool);
    
    // Optional struct for oracle metadata (PredictionOracle.sol and Contest.sol both support this)
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
 * @title MarketFactory
 * @notice Automatically creates prediction markets for any IPredictionOracle implementation
 * @dev Works with PredictionOracle.sol (Caliguland), Contest.sol (eHorse/contests), or custom oracles
 * 
 * Supported Oracle Types:
 * - PredictionOracle.sol: Generic game oracle with commit-reveal
 * - Contest.sol: TEE-based contest oracle with attestation
 * - Custom: Any contract implementing IPredictionOracle
 */
contract MarketFactory is Ownable, Pausable {
    IPredimarket public immutable predimarket;
    IPredictionOracle public immutable oracle;
    
    uint256 public defaultLiquidity;
    
    mapping(bytes32 => bool) public marketCreated;

    event MarketAutoCreated(bytes32 indexed sessionId, string question);
    event DefaultLiquidityUpdated(uint256 oldValue, uint256 newValue);

    error MarketAlreadyExists();
    error InvalidLiquidity();

    constructor(
        address _predimarket,
        address _oracle,
        uint256 _defaultLiquidity,
        address _owner
    ) Ownable(_owner) {
        require(_predimarket != address(0), "Invalid market");
        require(_oracle != address(0), "Invalid oracle");
        require(_defaultLiquidity > 0, "Invalid liquidity");
        
        predimarket = IPredimarket(_predimarket);
        oracle = IPredictionOracle(_oracle);
        defaultLiquidity = _defaultLiquidity;
    }

    /**
     * @notice Create market for a committed game
     * @param sessionId Oracle session ID
     * @param question The market question
     * @dev Anyone can call this after oracle commits a game
     */
    function createMarketFromOracle(bytes32 sessionId, string calldata question) external whenNotPaused {
        if (marketCreated[sessionId]) revert MarketAlreadyExists();

        // Fetch game data from oracle to verify it exists
        (
            ,
            ,
            ,
            ,
            ,
            uint256 startTime,
            ,
            ,
            ,
            ,
            
        ) = oracle.games(sessionId);

        require(startTime > 0, "Game not committed");

        // Create market
        predimarket.createMarket(sessionId, question, defaultLiquidity);
        marketCreated[sessionId] = true;

        emit MarketAutoCreated(sessionId, question);
    }

    /**
     * @notice Batch create markets for multiple sessions
     * @param sessionIds Array of session IDs
     * @param questions Array of questions corresponding to session IDs
     */
    function batchCreateMarkets(
        bytes32[] calldata sessionIds,
        string[] calldata questions
    ) external whenNotPaused {
        require(sessionIds.length == questions.length, "Length mismatch");
        
        for (uint256 i = 0; i < sessionIds.length; i++) {
            bytes32 sessionId = sessionIds[i];
            
            if (marketCreated[sessionId]) continue;

            (
                ,
                ,
                ,
                ,
                ,
                uint256 startTime,
                ,
                ,
                ,
                ,
                
            ) = oracle.games(sessionId);

            if (startTime == 0) continue;

            predimarket.createMarket(sessionId, questions[i], defaultLiquidity);
            marketCreated[sessionId] = true;

            emit MarketAutoCreated(sessionId, questions[i]);
        }
    }

    /**
     * @notice Update default liquidity parameter
     * @param newLiquidity New liquidity value
     */
    function setDefaultLiquidity(uint256 newLiquidity) external onlyOwner {
        if (newLiquidity == 0) revert InvalidLiquidity();
        
        uint256 oldValue = defaultLiquidity;
        defaultLiquidity = newLiquidity;
        
        emit DefaultLiquidityUpdated(oldValue, newLiquidity);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}

