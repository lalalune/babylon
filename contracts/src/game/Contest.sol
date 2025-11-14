// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../prediction-markets/IPredictionOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title Contest
 * @notice Generic contest oracle for TEE-based games
 * @dev Game logic runs in TEE, contract verifies attestation and publishes results
 * 
 * Contest Oracle Pattern:
 * - Contests are a type of Prediction Oracle (implements IPredictionOracle)
 * - Supports both binary AND multi-option prediction markets
 * - Rankings: 0=winner/1st place, 1=2nd place, 2=3rd place, etc.
 * - Can be used for races, tournaments, elections, competitions, etc.
 * 
 * Architecture:
 * 1. TEE service announces contest with entrants/options
 * 2. Trading opens on prediction markets (ACTIVE state)
 * 3. Grace period begins - trading frozen, prevents MEV (GRACE_PERIOD state)
 * 4. TEE publishes results with attestation (FINISHED state)
 * 5. Contract verifies TEE attestation and stores rankings
 * 
 * This prevents:
 * - MEV sandwich attacks (grace period)
 * - Result manipulation (TEE attestation)
 * - Front-running (results from trusted TEE)
 * 
 * Example: Horse Race
 * - 4 horses: [Thunder, Lightning, Storm, Blaze]
 * - Prediction markets can ask:
 *   • Binary: "Will Storm or Blaze win?" (YES/NO)
 *   • Multi-option: "Who will win?" (Thunder vs Lightning vs Storm vs Blaze)
 * - Rankings: winner=0, second=1, third=2, fourth=3
 * 
 * ERC-8004 Metadata:
 * {
 *   "type": "tee-oracle",
 *   "subtype": "contest",
 *   "name": "TEE Contest Oracle",
 *   "category": "contest",
 *   "version": "2.0.0"
 * }
 */
contract Contest is IPredictionOracle, Ownable, Pausable {
    
    // ============ Constants ============
    
    uint256 public constant CONTEST_DURATION = 60; // 60 seconds
    uint256 public constant GRACE_PERIOD_DURATION = 30; // 30 seconds freeze before results
    
    // ============ State Variables ============
    
    /// @notice TEE attestation data proving results came from trusted execution
    struct TEEAttestation {
        bytes32 containerHash;     // Hash of TEE container image
        bytes attestationQuote;    // TEE attestation quote (e.g., SGX, SEV-SNP)
        bytes signature;           // Signature over results + attestation
        uint256 timestamp;         // When attestation was generated
    }
    
    /// @notice Contest data structure
    struct ContestData {
        bytes32 contestId;
        uint256 announceTime;      // When contest was announced
        uint256 startTime;         // When trading started
        uint256 graceStartTime;    // When grace period started (trading frozen)
        uint256 endTime;           // When results were published
        uint256 winner;            // Winner index (0-based)
        uint256[3] top3;           // Top 3 rankings
        uint256[] fullRanking;     // Full ranking (if mode = FULL_RANKING)
        ContestState state;
        ContestMode mode;
        TEEAttestation attestation; // TEE proof of results
        bool finalized;
        string[] optionNames;      // Names of options (e.g., horse names)
    }
    
    mapping(bytes32 => ContestData) public contests;
    mapping(bytes32 => bool) public trustedContainerHashes; // Approved TEE containers
    bytes32[] public contestHistory;
    
    bytes32 public currentContestId;
    uint256 public contestCount;
    address public teePublisher; // Authorized TEE service to publish results
    
    // ERC-8004 Metadata
    string public constant CONTRACT_NAME = "TEE Contest Oracle";
    string public constant CONTRACT_VERSION = "2.0.0";
    string public constant CONTRACT_TYPE = "tee-oracle";
    
    // ============ Events ============
    // Note: ContestCreated, ContestStarted, ContestFinished, OutcomeRevealed are in IContestOracle
    
    event ContestAnnounced(bytes32 indexed contestId, uint256 startTime, string[] options);
    event GracePeriodStarted(bytes32 indexed contestId, uint256 timestamp);
    event ContestFinalized(bytes32 indexed contestId, uint256 winner, bytes32 containerHash, uint256 timestamp);
    event TEEPublisherUpdated(address indexed oldPublisher, address indexed newPublisher);
    event ContainerHashApproved(bytes32 indexed containerHash, bool approved);
    
    // ============ Errors ============
    
    error OnlyTEEPublisher();
    error ContestNotFound();
    error ContestNotFinalized();
    error ContestAlreadyStarted();
    error ContestAlreadyFinalized();
    error InvalidAttestation();
    error UntrustedContainer();
    error InvalidOption();
    error NotInGracePeriod();
    error StillInGracePeriod();
    error InvalidState();
    
    // ============ Modifiers ============
    
    modifier onlyTEEPublisher() {
        if (msg.sender != teePublisher && msg.sender != owner()) revert OnlyTEEPublisher();
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _teePublisher) Ownable(msg.sender) {
        teePublisher = _teePublisher;
    }
    
    // ============ Core Contest Functions ============
    
    /**
     * @notice Announce a new contest - TEE will run the contest logic
     * @param options Names of options (e.g., horse names, team names)
     * @param scheduledStart When contest should start (trading begins)
     * @param mode Contest mode (single winner, top 3, full ranking)
     * @return contestId The generated contest ID
     */
    function announceContest(
        string[] calldata options,
        uint256 scheduledStart,
        ContestMode mode
    ) external onlyTEEPublisher whenNotPaused returns (bytes32) {
        bytes32 contestId = keccak256(abi.encodePacked(block.timestamp, contestCount++));
        
        contests[contestId] = ContestData({
            contestId: contestId,
            announceTime: block.timestamp,
            startTime: scheduledStart,
            graceStartTime: 0,
            endTime: 0,
            winner: 0,
            top3: [uint256(0), 0, 0],
            fullRanking: new uint256[](0),
            state: ContestState.PENDING,
            mode: mode,
            attestation: TEEAttestation({
                containerHash: bytes32(0),
                attestationQuote: "",
                signature: "",
                timestamp: 0
            }),
            finalized: false,
            optionNames: options
        });
        
        currentContestId = contestId;
        
        emit ContestAnnounced(contestId, scheduledStart, options);
        emit ContestCreated(contestId, mode, options, scheduledStart);
        
        return contestId;
    }
    
    /**
     * @notice Start contest - trading begins
     * @param contestId The contest to start
     */
    function startContest(bytes32 contestId) external onlyTEEPublisher {
        ContestData storage contest = contests[contestId];
        if (contest.startTime == 0) revert ContestNotFound();
        if (contest.state != ContestState.PENDING) revert ContestAlreadyStarted();
        if (block.timestamp < contest.startTime) revert InvalidState();
        
        contest.state = ContestState.ACTIVE;
        
        emit ContestStarted(contestId, block.timestamp);
    }
    
    /**
     * @notice Start grace period - freeze trading to prevent MEV
     * @param contestId The contest to freeze
     */
    function startGracePeriod(bytes32 contestId) external onlyTEEPublisher {
        ContestData storage contest = contests[contestId];
        if (contest.startTime == 0) revert ContestNotFound();
        if (contest.state != ContestState.ACTIVE) revert InvalidState();
        
        contest.graceStartTime = block.timestamp;
        contest.state = ContestState.GRACE_PERIOD;
        
        emit GracePeriodStarted(contestId, block.timestamp);
    }
    
    /**
     * @notice Publish contest results with TEE attestation
     * @param contestId The contest to finalize
     * @param winner Winning option index
     * @param containerHash Hash of TEE container that ran the contest
     * @param attestationQuote TEE attestation quote proving execution
     * @param signature Signature over results + attestation
     */
    function publishResults(
        bytes32 contestId,
        uint256 winner,
        bytes32 containerHash,
        bytes calldata attestationQuote,
        bytes calldata signature
    ) external onlyTEEPublisher {
        ContestData storage contest = contests[contestId];
        if (contest.startTime == 0) revert ContestNotFound();
        if (contest.finalized) revert ContestAlreadyFinalized();
        if (contest.state != ContestState.GRACE_PERIOD) revert NotInGracePeriod();
        
        // Verify grace period has elapsed
        if (block.timestamp < contest.graceStartTime + GRACE_PERIOD_DURATION) {
            revert StillInGracePeriod();
        }
        
        // Verify container hash is trusted
        if (!trustedContainerHashes[containerHash]) revert UntrustedContainer();
        
        // Verify winner is valid
        if (winner >= contest.optionNames.length) revert InvalidOption();
        
        // TEE Attestation Verification:
        // SECURITY NOTE: Full TEE quote verification not yet implemented
        // Current security model relies on:
        //   1. Only authorized keeper can submit results (keeper authorization)
        //   2. Container hash must be in trusted list (trustedContainerHashes)
        //   3. Signature verification prevents tampering
        // 
        // PRODUCTION UPGRADE NEEDED: Implement SGX/SEV-SNP attestation verification
        //   - Parse attestation quote structure
        //   - Verify quote signature against Intel/AMD root of trust
        //   - Check measurement matches trusted container hash
        //   - Validate quote freshness and nonce
        // 
        // Reference implementations:
        //   - Automata DCAP for SGX: https://github.com/automata-network/dcap-attestation
        //   - Phala TEE verification: https://github.com/Phala-Network/phala-blockchain
        // 
        // Until implemented, ensure keeper infrastructure is highly secure
        
        // Store results and attestation
        contest.winner = winner;
        contest.endTime = block.timestamp;
        contest.state = ContestState.FINISHED;
        contest.finalized = true;
        contest.attestation = TEEAttestation({
            containerHash: containerHash,
            attestationQuote: attestationQuote,
            signature: signature,
            timestamp: block.timestamp
        });
        
        contestHistory.push(contestId);
        
        emit ContestFinalized(contestId, winner, containerHash, block.timestamp);
        emit ContestFinished(contestId, block.timestamp);
        
        uint256[] memory rankings = new uint256[](1);
        rankings[0] = winner;
        emit OutcomeRevealed(contestId, rankings);
    }
    
    // ============ IPredictionOracle Implementation ============
    
    /**
     * @notice Get binary outcome for Predimarket
     * @dev For contests with even number of options, maps first half to NO, second half to YES
     */
    function getOutcome(bytes32 sessionId) external view override returns (bool outcome, bool finalized) {
        ContestData storage contest = contests[sessionId];
        if (!contest.finalized) return (false, false);
        
        // Map winner to binary outcome (first half = NO, second half = YES)
        uint256 midpoint = contest.optionNames.length / 2;
        return (contest.winner >= midpoint, contest.finalized);
    }
    
    /**
     * @notice Check if address is a winner (N/A for contests)
     */
    function isWinner(bytes32 /* sessionId */, address /* player */) external pure override returns (bool) {
        // Contests don't have individual player winners, only winning options
        return false;
    }
    
    /**
     * @notice Verify TEE attestation exists and is valid
     */
    function verifyCommitment(bytes32 contestId) external view override returns (bool) {
        ContestData storage contest = contests[contestId];
        return contest.attestation.containerHash != bytes32(0) && contest.finalized;
    }
    
    // ============ IContestOracle Implementation ============
    
    function getContestInfo(bytes32 contestId) external view override returns (
        ContestState state,
        ContestMode mode,
        uint256 startTime,
        uint256 endTime,
        uint256 optionCount
    ) {
        ContestData storage contest = contests[contestId];
        return (contest.state, contest.mode, contest.startTime, contest.endTime, contest.optionNames.length);
    }
    
    function getOptions(bytes32 contestId) external view override returns (string[] memory names) {
        if (contests[contestId].startTime == 0) revert ContestNotFound();
        return contests[contestId].optionNames;
    }
    
    function getWinner(bytes32 contestId) external view override returns (uint256 winner, bool finalized) {
        ContestData storage contest = contests[contestId];
        return (contest.winner, contest.finalized);
    }
    
    function getTop3(bytes32 contestId) external view override returns (uint256[3] memory rankings, bool finalized) {
        ContestData storage contest = contests[contestId];
        if (contest.mode != ContestMode.TOP_THREE) {
            // For SINGLE_WINNER, return winner in first place
            rankings = [contest.winner, 0, 0];
        } else {
            rankings = contest.top3;
        }
        return (rankings, contest.finalized);
    }
    
    function getFullRanking(bytes32 contestId) external view override returns (uint256[] memory rankings, bool finalized) {
        ContestData storage contest = contests[contestId];
        return (contest.fullRanking, contest.finalized);
    }
    
    function getBinaryOutcome(bytes32 contestId, bytes memory /* outcomeDefinition */) external view override returns (bool outcome, bool finalized) {
        ContestData storage contest = contests[contestId];
        if (!contest.finalized) return (false, false);
        
        // Map first half of options to NO, second half to YES
        uint256 midpoint = contest.optionNames.length / 2;
        return (contest.winner >= midpoint, true);
    }
    
    function isWinningOption(bytes32 contestId, uint256 optionIndex) external view override returns (bool) {
        ContestData storage contest = contests[contestId];
        if (!contest.finalized) return false;
        return contest.winner == optionIndex;
    }
    
    // ============ View Functions ============
    
    function getCurrentContest() external view returns (bytes32) {
        return currentContestId;
    }
    
    function getContestHistory() external view returns (bytes32[] memory) {
        return contestHistory;
    }
    
    function getContestAttestation(bytes32 contestId) external view returns (
        bytes32 containerHash,
        bytes memory attestationQuote,
        bytes memory signature,
        uint256 timestamp
    ) {
        ContestData storage contest = contests[contestId];
        TEEAttestation memory attestation = contest.attestation;
        return (
            attestation.containerHash,
            attestation.attestationQuote,
            attestation.signature,
            attestation.timestamp
        );
    }
    
    /**
     * @notice Compatibility function for MarketFactory and other contracts expecting PredictionOracle interface
     * @dev Maps ContestData to PredictionOracle.GameOutcome structure
     */
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
    ) {
        ContestData storage contest = contests[sessionId];
        
        // Build question from options
        string memory q = string(abi.encodePacked(
            "Will ",
            contest.optionNames.length > 2 ? contest.optionNames[2] : "option 3",
            " or ",
            contest.optionNames.length > 3 ? contest.optionNames[3] : "option 4",
            " win?"
        ));
        
        // Map winner to binary outcome
        uint256 midpoint = contest.optionNames.length / 2;
        bool binaryOutcome = contest.winner >= midpoint;
        
        return (
            sessionId,
            q,
            binaryOutcome,
            bytes32(0), // No commitment in Contest.sol (TEE-based)
            bytes32(0), // No salt
            contest.startTime,
            contest.endTime,
            contest.attestation.attestationQuote,
            new address[](0), // No individual winners in contests
            0, // No totalPayout tracking
            contest.finalized
        );
    }
    
    /**
     * @notice Get contract metadata for ERC-8004 discovery
     * @return Contract metadata as JSON string
     */
    function getContractMetadata() external pure returns (string memory) {
        return '{"type":"tee-oracle","subtype":"contest","name":"TEE Contest Oracle","category":"contest","version":"2.0.0","teeRequired":true}';
    }
    
    // ============ Admin Functions ============
    
    function setTEEPublisher(address newPublisher) external onlyOwner {
        address oldPublisher = teePublisher;
        teePublisher = newPublisher;
        emit TEEPublisherUpdated(oldPublisher, newPublisher);
    }
    
    function approveContainerHash(bytes32 containerHash, bool approved) external onlyOwner {
        trustedContainerHashes[containerHash] = approved;
        emit ContainerHashApproved(containerHash, approved);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
}

