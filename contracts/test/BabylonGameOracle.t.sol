// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {BabylonGameOracle} from "../src/game/BabylonGameOracle.sol";
import {Predimarket} from "../src/prediction-markets/Predimarket.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Test Token", "TEST") {
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract BabylonGameOracleTest is Test {
    BabylonGameOracle public oracle;
    Predimarket public predimarket;
    MockERC20 public token;
    
    address public gameServer = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);
    address public treasury = address(0x4);
    
    bytes32 public sessionId;
    string public questionId = "test-question-1";
    string public question = "Will Bitcoin reach $100k in 2024?";
    bytes32 public commitment;
    bytes32 public salt = keccak256("secret-salt");
    bool public outcome = true;
    
    event BabylonGameCommitted(
        bytes32 indexed sessionId,
        string questionId,
        uint256 questionNumber,
        string question,
        bytes32 commitment
    );
    
    event BabylonGameRevealed(
        bytes32 indexed sessionId,
        string questionId,
        bool outcome,
        uint256 winnersCount
    );
    
    function setUp() public {
        // Deploy token
        token = new MockERC20();
        
        // Deploy oracle
        oracle = new BabylonGameOracle(gameServer);
        
        // Deploy predimarket
        predimarket = new Predimarket(
            address(token),
            address(oracle),
            treasury,
            address(this)
        );
        
        // Mint tokens to users
        token.mint(user1, 10000 * 10**18);
        token.mint(user2, 10000 * 10**18);
        
        // Generate commitment
        commitment = keccak256(abi.encode(outcome, salt));
    }
    
    function testCommitGame() public {
        vm.prank(gameServer);
        
        vm.expectEmit(false, false, false, true);
        emit BabylonGameCommitted(bytes32(0), questionId, 1, question, commitment);
        
        sessionId = oracle.commitBabylonGame(
            questionId,
            1,  // questionNumber
            question,
            commitment,
            "crypto"  // category
        );
        
        // Verify session was created
        assertTrue(sessionId != bytes32(0), "Session ID should be set");
        
        // Verify metadata
        (string memory storedQuestionId, , , , ) = oracle.gameMetadata(sessionId);
        assertEq(storedQuestionId, questionId, "Question ID should match");
        
        // Verify outcome not finalized yet
        (bool outcomeResult, bool finalized) = oracle.getOutcome(sessionId);
        assertFalse(finalized, "Should not be finalized");
        
        // Verify statistics
        (uint256 committed, uint256 revealed, uint256 pending) = oracle.getStatistics();
        assertEq(committed, 1, "Should have 1 committed");
        assertEq(revealed, 0, "Should have 0 revealed");
        assertEq(pending, 1, "Should have 1 pending");
    }
    
    function testRevealGame() public {
        // First commit
        vm.prank(gameServer);
        sessionId = oracle.commitBabylonGame(
            questionId,
            1,
            question,
            commitment,
            "crypto"
        );
        
        // Then reveal
        address[] memory winners = new address[](2);
        winners[0] = user1;
        winners[1] = user2;
        
        vm.prank(gameServer);
        vm.expectEmit(true, false, false, true);
        emit BabylonGameRevealed(sessionId, questionId, outcome, 2);
        
        oracle.revealBabylonGame(
            sessionId,
            outcome,
            salt,
            "",  // empty TEE quote
            winners,
            1000 * 10**18  // totalPayout
        );
        
        // Verify outcome is finalized
        (bool outcomeResult, bool finalized) = oracle.getOutcome(sessionId);
        assertTrue(finalized, "Should be finalized");
        assertEq(outcomeResult, outcome, "Outcome should match");
        
        // Verify winners
        address[] memory storedWinners = oracle.getWinners(sessionId);
        assertEq(storedWinners.length, 2, "Should have 2 winners");
        assertEq(storedWinners[0], user1, "First winner should match");
        assertEq(storedWinners[1], user2, "Second winner should match");
        
        // Verify statistics
        (uint256 committed, uint256 revealed, uint256 pending) = oracle.getStatistics();
        assertEq(committed, 1, "Should have 1 committed");
        assertEq(revealed, 1, "Should have 1 revealed");
        assertEq(pending, 0, "Should have 0 pending");
    }
    
    function testRevealWithInvalidSalt() public {
        // Commit
        vm.prank(gameServer);
        sessionId = oracle.commitBabylonGame(
            questionId,
            1,
            question,
            commitment,
            "crypto"
        );
        
        // Try to reveal with wrong salt
        bytes32 wrongSalt = keccak256("wrong-salt");
        address[] memory winners = new address[](0);
        
        vm.prank(gameServer);
        vm.expectRevert("Commitment mismatch");
        oracle.revealBabylonGame(
            sessionId,
            outcome,
            wrongSalt,
            "",
            winners,
            0
        );
    }
    
    function testOnlyGameServerCanCommit() public {
        vm.prank(user1);  // Not game server
        vm.expectRevert("Only game server");
        oracle.commitBabylonGame(
            questionId,
            1,
            question,
            commitment,
            "crypto"
        );
    }
    
    function testOnlyGameServerCanReveal() public {
        // Commit as game server
        vm.prank(gameServer);
        sessionId = oracle.commitBabylonGame(
            questionId,
            1,
            question,
            commitment,
            "crypto"
        );
        
        // Try to reveal as user
        address[] memory winners = new address[](0);
        vm.prank(user1);
        vm.expectRevert("Only game server");
        oracle.revealBabylonGame(
            sessionId,
            outcome,
            salt,
            "",
            winners,
            0
        );
    }
    
    function testBatchCommit() public {
        string[] memory questionIds = new string[](3);
        uint256[] memory questionNumbers = new uint256[](3);
        string[] memory questions = new string[](3);
        bytes32[] memory commitments = new bytes32[](3);
        string[] memory categories = new string[](3);
        
        for (uint i = 0; i < 3; i++) {
            questionIds[i] = string(abi.encodePacked("batch-question-", vm.toString(i)));
            questionNumbers[i] = 100 + i;
            questions[i] = string(abi.encodePacked("Batch Question ", vm.toString(i), "?"));
            commitments[i] = keccak256(abi.encodePacked("batch-commit-", i));
            categories[i] = "batch-test";
        }
        
        // Get current stats
        (uint256 committedBefore, , ) = oracle.getStatistics();
        
        vm.prank(gameServer);
        bytes32[] memory sessionIds = oracle.batchCommitBabylonGames(
            questionIds,
            questionNumbers,
            questions,
            commitments,
            categories
        );
        
        assertEq(sessionIds.length, 3, "Should create 3 sessions");
        
        (uint256 committedAfter, , ) = oracle.getStatistics();
        assertEq(committedAfter, committedBefore + 3, "Should have 3 more committed");
    }
    
    function testPredimarketIntegration() public {
        // Commit game
        vm.prank(gameServer);
        sessionId = oracle.commitBabylonGame(
            questionId,
            1,
            question,
            commitment,
            "crypto"
        );
        
        // Create market
        predimarket.createMarketWithType(
            sessionId,
            question,
            1000 * 10**18,  // liquidity
            Predimarket.GameType.GENERIC,
            address(oracle)
        );
        
        // Users trade
        vm.startPrank(user1);
        token.approve(address(predimarket), 1000 * 10**18);
        predimarket.buy(sessionId, true, 100 * 10**18, 0);  // Buy YES
        vm.stopPrank();
        
        vm.startPrank(user2);
        token.approve(address(predimarket), 1000 * 10**18);
        predimarket.buy(sessionId, false, 100 * 10**18, 0);  // Buy NO
        vm.stopPrank();
        
        // Reveal game
        address[] memory winners = new address[](1);
        winners[0] = user1;
        
        vm.prank(gameServer);
        oracle.revealBabylonGame(
            sessionId,
            outcome,  // true (YES wins)
            salt,
            "",
            winners,
            200 * 10**18
        );
        
        // Resolve market
        predimarket.resolveMarket(sessionId);
        
        // Verify market resolved correctly
        Predimarket.Market memory market = predimarket.getMarket(sessionId);
        assertTrue(market.resolved, "Market should be resolved");
        assertTrue(market.outcome, "Outcome should be true");
        
        // User1 (YES) should be able to claim
        uint256 balanceBefore = token.balanceOf(user1);
        vm.prank(user1);
        predimarket.claimPayout(sessionId);
        uint256 balanceAfter = token.balanceOf(user1);
        
        assertTrue(balanceAfter > balanceBefore, "Winner should receive payout");
        
        // User2 (NO) should not receive payout
        vm.prank(user2);
        vm.expectRevert();
        predimarket.claimPayout(sessionId);
    }
    
    function testPauseUnpause() public {
        oracle.pause();
        
        vm.prank(gameServer);
        vm.expectRevert();
        oracle.commitBabylonGame(
            questionId,
            1,
            question,
            commitment,
            "crypto"
        );
        
        oracle.unpause();
        
        vm.prank(gameServer);
        sessionId = oracle.commitBabylonGame(
            questionId,
            1,
            question,
            commitment,
            "crypto"
        );
        
        assertTrue(sessionId != bytes32(0), "Should work after unpause");
    }
    
    function testCannotCommitSameQuestionTwice() public {
        vm.startPrank(gameServer);
        
        oracle.commitBabylonGame(
            questionId,
            1,
            question,
            commitment,
            "crypto"
        );
        
        vm.expectRevert();
        oracle.commitBabylonGame(
            questionId,
            2,  // Different question number
            "Different question?",
            commitment,
            "crypto"
        );
        
        vm.stopPrank();
    }
}

