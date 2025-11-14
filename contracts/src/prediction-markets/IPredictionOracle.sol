// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title IPredictionOracle
 * @notice Unified interface for all prediction game oracles
 * @dev Supports both simple games (Caliguland) and contest-based games (eHorse, tournaments)
 * 
 * This allows ANY prediction market contract to trustlessly access game results
 * without needing to know the game's internal logic.
 * 
 * Oracle Types:
 * - PredictionOracle.sol: Simple commit-reveal games
 * - Contest.sol: Contest-based with rankings and TEE attestation
 * - Custom implementations: Any game can implement this interface
 */
interface IPredictionOracle {
    /**
     * @notice Contest modes (for contest-based oracles)
     */
    enum ContestMode {
        SINGLE_WINNER,    // One winner only
        TOP_THREE,        // Top 3 ranked (1st, 2nd, 3rd)
        FULL_RANKING      // All contestants ranked in order
    }

    /**
     * @notice Contest state (for contest-based oracles)
     */
    enum ContestState {
        PENDING,        // Announced but not started
        ACTIVE,         // Running - trading allowed
        GRACE_PERIOD,   // Frozen - no trading, prevents MEV
        FINISHED,       // Completed with results
        CANCELLED       // Cancelled (refund bets)
    }

    // ============ Core Prediction Oracle Methods ============

    /**
     * @notice Get the outcome and finalization status of a game
     * @param sessionId The unique game session ID
     * @return outcome The game outcome (true=YES, false=NO)
     * @return finalized Whether the outcome has been revealed and finalized
     */
    function getOutcome(bytes32 sessionId) external view returns (bool outcome, bool finalized);

    /**
     * @notice Check if an address was a winner in a specific game
     * @param sessionId The game session ID
     * @param player The address to check
     * @return True if the address won, false otherwise
     */
    function isWinner(bytes32 sessionId, address player) external view returns (bool);

    /**
     * @notice Verify that a commitment/attestation exists in the oracle
     * @param commitment The commitment hash or contest ID
     * @return True if commitment exists
     */
    function verifyCommitment(bytes32 commitment) external view returns (bool);

    // ============ Contest Oracle Methods (Optional) ============
    // These methods may return empty/default values for non-contest oracles

    /**
     * @notice Get contest details (for contest-based oracles)
     * @param contestId Unique contest identifier
     * @return state Current state of the contest
     * @return mode Contest mode (winner/top3/ranking)
     * @return startTime When contest started (0 if pending)
     * @return endTime When contest ended (0 if not finished)
     * @return optionCount Number of options/contestants
     */
    function getContestInfo(bytes32 contestId) external view returns (
        ContestState state,
        ContestMode mode,
        uint256 startTime,
        uint256 endTime,
        uint256 optionCount
    );

    /**
     * @notice Get contest options/contestants (for contest-based oracles)
     * @param contestId Unique contest identifier
     * @return names Array of option names
     */
    function getOptions(bytes32 contestId) external view returns (string[] memory names);

    /**
     * @notice Get winner for single-winner contests
     * @param contestId Unique contest identifier
     * @return winner Index of winning option (0-based, 0=1st place)
     * @return finalized Whether result is finalized
     */
    function getWinner(bytes32 contestId) external view returns (uint256 winner, bool finalized);

    /**
     * @notice Get top 3 rankings (for contest-based oracles)
     * @param contestId Unique contest identifier
     * @return rankings Array of 3 option indices [1st, 2nd, 3rd]
     * @return finalized Whether results are finalized
     */
    function getTop3(bytes32 contestId) external view returns (uint256[3] memory rankings, bool finalized);

    /**
     * @notice Get full rankings (for contest-based oracles)
     * @param contestId Unique contest identifier
     * @return rankings Array of all option indices in order (1st to last)
     * @return finalized Whether results are finalized
     */
    function getFullRanking(bytes32 contestId) external view returns (uint256[] memory rankings, bool finalized);

    /**
     * @notice Get binary outcome for prediction markets
     * @dev Maps contest result to true/false for simple betting
     * @param contestId Unique contest identifier
     * @param outcomeDefinition How to interpret winner as binary (e.g., "option >= 2")
     * @return outcome Binary result
     * @return finalized Whether result is finalized
     */
    function getBinaryOutcome(bytes32 contestId, bytes memory outcomeDefinition) external view returns (bool outcome, bool finalized);

    /**
     * @notice Check if specific option won (for contest-based oracles)
     * @param contestId Unique contest identifier
     * @param optionIndex Index of option to check
     * @return True if this option won (or placed in top 3 for TOP_THREE mode)
     */
    function isWinningOption(bytes32 contestId, uint256 optionIndex) external view returns (bool);

    // ============ Events ============

    /**
     * @notice Emitted when a contest is created
     */
    event ContestCreated(bytes32 indexed contestId, ContestMode mode, string[] options, uint256 startTime);

    /**
     * @notice Emitted when a contest starts (trading opens)
     */
    event ContestStarted(bytes32 indexed contestId, uint256 timestamp);

    /**
     * @notice Emitted when a contest finishes
     */
    event ContestFinished(bytes32 indexed contestId, uint256 timestamp);

    /**
     * @notice Emitted when an outcome is committed (for commit-reveal oracles)
     */
    event OutcomeCommitted(bytes32 indexed contestId, bytes32 commitment);

    /**
     * @notice Emitted when an outcome is revealed
     */
    event OutcomeRevealed(bytes32 indexed contestId, uint256[] rankings);

    /**
     * @notice Emitted when a contest is cancelled
     */
    event ContestCancelled(bytes32 indexed contestId, string reason);
}

/**
 * @notice Example external betting contract using IPredictionOracle
 * @dev This shows how Predimarket or any other contract can bet on Caliguland games
 */
contract ExamplePredictionContract {
    IPredictionOracle public oracle;

    struct Bet {
        bytes32 gameSessionId;
        bool predictedOutcome;
        uint256 amount;
        address bettor;
    }

    mapping(uint256 => Bet) public bets;
    uint256 public nextBetId;

    constructor(address _oracle) {
        oracle = IPredictionOracle(_oracle);
    }

    /**
     * @notice Place a bet on a Caliguland game outcome
     */
    function placeBet(bytes32 gameSessionId, bool predictedOutcome) external payable {
        bets[nextBetId++] = Bet({
            gameSessionId: gameSessionId,
            predictedOutcome: predictedOutcome,
            amount: msg.value,
            bettor: msg.sender
        });
    }

    /**
     * @notice Claim winnings after game is finalized
     */
    function claim(uint256 betId) external {
        Bet storage bet = bets[betId];
        if (bet.bettor != msg.sender) revert("Not your bet");

        (bool outcome, bool finalized) = oracle.getOutcome(bet.gameSessionId);
        if (!finalized) revert("Game not finalized");
        
        if (outcome == bet.predictedOutcome) {
            uint256 payout = bet.amount * 2;
            payable(msg.sender).transfer(payout);
        }
    }
}

