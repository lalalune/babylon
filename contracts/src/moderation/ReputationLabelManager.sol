// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./BanManager.sol";

interface IPredimarketLabel {
    function createMarket(
        bytes32 sessionId,
        string memory question,
        uint256 liquidityParameter
    ) external;
    function getMarket(bytes32 sessionId) external view returns (
        bytes32 id,
        string memory question,
        uint256 yesShares,
        uint256 noShares,
        uint256 liquidityParameter,
        uint256 totalVolume,
        uint256 createdAt,
        bool resolved,
        bool outcome
    );
}

/**
 * @title ReputationLabelManager
 * @author Jeju Network
 * @notice Manages reputation labels (HACKER, SCAMMER, TRUSTED) via futarchy governance
 * @dev Labels are applied through prediction market voting with stake requirements
 * 
 * Label Types:
 * - HACKER: Serious offense, auto-triggers network ban if approved (0.1 ETH stake)
 * - SCAMMER: Warning label, no auto-ban (0.05 ETH stake)
 * - SPAM_BOT: Low-level offense, app-level ban eligible (0.01 ETH stake)
 * - TRUSTED: Positive reputation (0.5 ETH stake to vouch)
 * 
 * Process:
 * 1. User proposes label with evidence (IPFS hash) and stake
 * 2. Futarchy market created in Predimarket
 * 3. Community votes via market trading
 * 4. If YES wins: label applied, proposer rewarded
 * 5. If NO wins: proposer slashed, target agent compensated
 * 
 * @custom:security-contact security@jeju.network
 */
contract ReputationLabelManager is Ownable, Pausable, ReentrancyGuard {
    
    // ============ Enums ============
    
    enum Label {
        NONE,
        HACKER,      // Critical: Auto-bans from network
        SCAMMER,     // High: Warning only
        SPAM_BOT,    // Medium: App-level ban eligible
        TRUSTED      // Positive: Reputation boost
    }
    
    enum ProposalStatus {
        PENDING,     // Market voting in progress
        APPROVED,    // Label applied
        REJECTED,    // Label denied
        APPEALED     // Under appeal review
    }
    
    // ============ Structs ============
    
    struct LabelProposal {
        bytes32 proposalId;
        uint256 targetAgentId;
        Label proposedLabel;
        address proposer;
        uint256 stakeAmount;
        bytes32 evidenceHash;  // IPFS hash
        bytes32 marketId;      // Predimarket market
        uint256 createdAt;
        uint256 votingEnds;
        ProposalStatus status;
    }
    
    struct AgentLabels {
        Label[] labels;
        uint256 lastUpdated;
    }
    
    // ============ State Variables ============
    
    /// @notice BanManager contract for auto-ban integration
    BanManager public immutable banManager;
    
    /// @notice Predimarket for futarchy voting
    IPredimarketLabel public immutable predimarket;
    
    /// @notice Governance contract
    address public governance;
    
    /// @notice Labels per agent
    mapping(uint256 => AgentLabels) private _agentLabels;
    
    /// @notice Label existence check for O(1) lookups
    mapping(uint256 => mapping(Label => bool)) public hasLabel;
    
    /// @notice All proposals
    mapping(bytes32 => LabelProposal) public proposals;
    
    /// @notice Proposals per agent (for history)
    mapping(uint256 => bytes32[]) private _agentProposals;
    
    /// @notice All proposal IDs
    bytes32[] public allProposalIds;
    
    /// @notice Stake requirements per label type
    mapping(Label => uint256) public stakeRequirements;
    
    /// @notice Default market liquidity
    uint256 public defaultLiquidity = 1000 ether;
    
    /// @notice Voting period
    uint256 public votingPeriod = 7 days;
    
    // ============ Events ============
    
    event LabelProposed(
        bytes32 indexed proposalId,
        uint256 indexed targetAgentId,
        Label label,
        address indexed proposer,
        bytes32 marketId,
        bytes32 evidenceHash
    );
    
    event LabelApplied(
        uint256 indexed agentId,
        Label label,
        bytes32 indexed proposalId,
        uint256 timestamp
    );
    
    event LabelRemoved(
        uint256 indexed agentId,
        Label label,
        uint256 timestamp
    );
    
    event ProposalResolved(
        bytes32 indexed proposalId,
        bool approved,
        uint256 timestamp
    );
    
    event ProposerSlashed(
        bytes32 indexed proposalId,
        address indexed proposer,
        uint256 amount
    );
    
    event ProposerRewarded(
        bytes32 indexed proposalId,
        address indexed proposer,
        uint256 amount
    );
    
    // ============ Errors ============
    
    error InsufficientStake();
    error InvalidLabel();
    error InvalidAgentId();
    error LabelAlreadyExists();
    error LabelDoesNotExist();
    error ProposalNotFound();
    error ProposalNotResolved();
    error ProposalAlreadyResolved();
    error VotingNotEnded();
    error OnlyGovernance();
    
    // ============ Modifiers ============
    
    modifier onlyGovernance() {
        if (msg.sender != governance && msg.sender != owner()) {
            revert OnlyGovernance();
        }
        _;
    }
    
    // ============ Constructor ============
    
    constructor(
        address _banManager,
        address _predimarket,
        address _governance,
        address _owner
    ) Ownable(_owner) {
        require(_banManager != address(0), "Invalid BanManager");
        require(_predimarket != address(0), "Invalid Predimarket");
        require(_governance != address(0), "Invalid governance");
        
        banManager = BanManager(_banManager);
        predimarket = IPredimarketLabel(_predimarket);
        governance = _governance;
        
        // Set stake requirements
        stakeRequirements[Label.HACKER] = 0.1 ether;
        stakeRequirements[Label.SCAMMER] = 0.05 ether;
        stakeRequirements[Label.SPAM_BOT] = 0.01 ether;
        stakeRequirements[Label.TRUSTED] = 0.5 ether;
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Propose a label for an agent
     * @param targetAgentId Agent to label
     * @param label Label type to apply
     * @param evidenceHash IPFS hash of evidence
     * @return proposalId Proposal identifier
     */
    function proposeLabel(
        uint256 targetAgentId,
        Label label,
        bytes32 evidenceHash
    ) external payable nonReentrant whenNotPaused returns (bytes32 proposalId) {
        if (targetAgentId == 0) revert InvalidAgentId();
        if (label == Label.NONE) revert InvalidLabel();
        if (hasLabel[targetAgentId][label]) revert LabelAlreadyExists();
        
        uint256 requiredStake = stakeRequirements[label];
        if (msg.value < requiredStake) revert InsufficientStake();
        
        // Generate unique proposal ID
        proposalId = keccak256(abi.encodePacked(
            targetAgentId,
            label,
            msg.sender,
            block.timestamp
        ));
        
        // Create market question
        string memory question = _generateMarketQuestion(targetAgentId, label);
        bytes32 marketId = bytes32(uint256(uint160(address(this))) | uint256(proposalId));
        
        // Create futarchy market
        predimarket.createMarket(marketId, question, defaultLiquidity);
        
        // Store proposal
        proposals[proposalId] = LabelProposal({
            proposalId: proposalId,
            targetAgentId: targetAgentId,
            proposedLabel: label,
            proposer: msg.sender,
            stakeAmount: msg.value,
            evidenceHash: evidenceHash,
            marketId: marketId,
            createdAt: block.timestamp,
            votingEnds: block.timestamp + votingPeriod,
            status: ProposalStatus.PENDING
        });
        
        allProposalIds.push(proposalId);
        _agentProposals[targetAgentId].push(proposalId);
        
        emit LabelProposed(
            proposalId,
            targetAgentId,
            label,
            msg.sender,
            marketId,
            evidenceHash
        );
    }
    
    /**
     * @notice Resolve label proposal based on market outcome
     * @param proposalId Proposal to resolve
     */
    function resolveProposal(
        bytes32 proposalId
    ) external nonReentrant {
        LabelProposal storage proposal = proposals[proposalId];
        if (proposal.createdAt == 0) revert ProposalNotFound();
        if (proposal.status != ProposalStatus.PENDING) revert ProposalAlreadyResolved();
        if (block.timestamp < proposal.votingEnds) revert VotingNotEnded();
        
        // Get market outcome
        (,,,,,,,bool resolved, bool outcome) = predimarket.getMarket(proposal.marketId);
        
        if (!resolved) revert ProposalNotResolved();
        
        if (outcome) {
            // YES: Apply label
            _applyLabel(proposal.targetAgentId, proposal.proposedLabel, proposalId);
            proposal.status = ProposalStatus.APPROVED;
            
            // Reward proposer (return stake + bonus if available)
            uint256 bonus = proposal.stakeAmount / 10; // 10% target bonus
            uint256 maxReward = proposal.stakeAmount + bonus;
            
            // Only pay bonus if contract has sufficient balance
            uint256 reward = address(this).balance >= maxReward ? maxReward : proposal.stakeAmount;
            
            (bool success, ) = proposal.proposer.call{value: reward}("");
            require(success, "Reward transfer failed");
            
            emit ProposerRewarded(proposalId, proposal.proposer, reward);
            
            // If HACKER label, auto-ban from network
            if (proposal.proposedLabel == Label.HACKER) {
                banManager.banFromNetwork(
                    proposal.targetAgentId,
                    string(abi.encodePacked("Auto-ban: HACKER label approved (", _bytes32ToString(proposalId), ")")),
                    proposalId
                );
            }
        } else {
            // NO: Reject proposal, slash proposer
            proposal.status = ProposalStatus.REJECTED;
            
            // Slash proposer (50% goes to treasury, 50% to target agent)
            uint256 halfStake = proposal.stakeAmount / 2;
            
            // Transfer to owner as treasury (simplified)
            (bool success1, ) = owner().call{value: halfStake}("");
            require(success1, "Treasury transfer failed");
            
            // Other half stays in contract for target agent to claim
            // (In production, would transfer to target agent's address)
            
            emit ProposerSlashed(proposalId, proposal.proposer, proposal.stakeAmount);
        }
        
        emit ProposalResolved(proposalId, outcome, block.timestamp);
    }
    
    /**
     * @notice Remove label (governance only, via appeal)
     * @param agentId Agent ID
     * @param label Label to remove
     */
    function removeLabel(
        uint256 agentId,
        Label label
    ) external onlyGovernance {
        if (!hasLabel[agentId][label]) revert LabelDoesNotExist();
        
        // Remove from array
        Label[] storage labels = _agentLabels[agentId].labels;
        for (uint256 i = 0; i < labels.length; i++) {
            if (labels[i] == label) {
                labels[i] = labels[labels.length - 1];
                labels.pop();
                break;
            }
        }
        
        hasLabel[agentId][label] = false;
        _agentLabels[agentId].lastUpdated = block.timestamp;
        
        emit LabelRemoved(agentId, label, block.timestamp);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @dev Apply label to agent
     */
    function _applyLabel(
        uint256 agentId,
        Label label,
        bytes32 proposalId
    ) internal {
        _agentLabels[agentId].labels.push(label);
        hasLabel[agentId][label] = true;
        _agentLabels[agentId].lastUpdated = block.timestamp;
        
        emit LabelApplied(agentId, label, proposalId, block.timestamp);
    }
    
    /**
     * @dev Generate market question
     */
    function _generateMarketQuestion(
        uint256 agentId,
        Label label
    ) internal pure returns (string memory) {
        string memory labelStr = _labelToString(label);
        return string(abi.encodePacked(
            "Should Agent #",
            _uint2str(agentId),
            " be labeled as ",
            labelStr,
            "?"
        ));
    }
    
    /**
     * @dev Convert label enum to string
     */
    function _labelToString(Label label) internal pure returns (string memory) {
        if (label == Label.HACKER) return "HACKER";
        if (label == Label.SCAMMER) return "SCAMMER";
        if (label == Label.SPAM_BOT) return "SPAM_BOT";
        if (label == Label.TRUSTED) return "TRUSTED";
        return "NONE";
    }
    
    /**
     * @dev Convert uint to string
     */
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    /**
     * @dev Convert bytes32 to string
     */
    function _bytes32ToString(bytes32 value) internal pure returns (string memory) {
        bytes memory bytesArray = new bytes(32);
        for (uint256 i = 0; i < 32; i++) {
            bytesArray[i] = value[i];
        }
        return string(bytesArray);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get all labels for an agent
     * @param agentId Agent ID
     * @return Array of labels
     */
    function getLabels(uint256 agentId) external view returns (Label[] memory) {
        return _agentLabels[agentId].labels;
    }
    
    /**
     * @notice Get agent proposals
     * @param agentId Agent ID
     * @return Array of proposal IDs
     */
    function getAgentProposals(uint256 agentId) external view returns (bytes32[] memory) {
        return _agentProposals[agentId];
    }
    
    /**
     * @notice Get proposal details
     * @param proposalId Proposal ID
     * @return Full proposal data
     */
    function getProposal(bytes32 proposalId) external view returns (LabelProposal memory) {
        return proposals[proposalId];
    }
    
    /**
     * @notice Get all proposal IDs
     * @return Array of all proposals
     */
    function getAllProposals() external view returns (bytes32[] memory) {
        return allProposalIds;
    }
    
    // ============ Admin Functions ============
    
    function setVotingPeriod(uint256 newPeriod) external onlyOwner {
        votingPeriod = newPeriod;
    }
    
    function setStakeRequirement(Label label, uint256 amount) external onlyOwner {
        stakeRequirements[label] = amount;
    }
    
    function setDefaultLiquidity(uint256 liquidity) external onlyOwner {
        defaultLiquidity = liquidity;
    }
    
    function setGovernance(address newGovernance) external onlyOwner {
        require(newGovernance != address(0), "Invalid governance");
        governance = newGovernance;
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
    
    receive() external payable {}
}

