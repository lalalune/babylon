// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {LibMarket} from "../libraries/LibMarket.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";
import {ChainlinkOracleMock} from "../oracles/ChainlinkOracleMock.sol";
import {UMAOracleMock} from "../oracles/UMAOracleMock.sol";

/// @title OracleFacet
/// @notice Facet for oracle integration and market resolution
/// @dev Handles both Chainlink and UMA oracle requests
contract OracleFacet {
    event OracleRequested(
        bytes32 indexed marketId,
        bytes32 indexed requestId,
        string oracleType
    );
    event OracleResponseReceived(
        bytes32 indexed marketId,
        bytes32 indexed requestId,
        uint8 outcome
    );

    /// @notice Request Chainlink oracle resolution
    /// @param _marketId Market to resolve
    function requestChainlinkResolution(bytes32 _marketId) external payable {
        LibMarket.Market storage market = LibMarket.getMarket(_marketId);
        require(!market.resolved, "Market already resolved");
        require(block.timestamp >= market.resolveAt, "Too early to resolve");
        require(msg.sender == market.oracle, "Only oracle can request");

        LibMarket.MarketStorage storage ms = LibMarket.marketStorage();
        require(ms.chainlinkOracle != address(0), "Chainlink oracle not set");

        ChainlinkOracleMock oracle = ChainlinkOracleMock(payable(ms.chainlinkOracle));
        bytes32 requestId = oracle.requestResolution{value: msg.value}(
            _marketId,
            market.question
        );

        emit OracleRequested(_marketId, requestId, "chainlink");
    }

    /// @notice Request UMA optimistic oracle resolution
    /// @param _marketId Market to resolve
    /// @param _proposedOutcome Proposed outcome
    function requestUMAResolution(
        bytes32 _marketId,
        uint8 _proposedOutcome
    ) external payable {
        LibMarket.Market storage market = LibMarket.getMarket(_marketId);
        require(!market.resolved, "Market already resolved");
        require(block.timestamp >= market.resolveAt, "Too early to resolve");
        require(msg.sender == market.oracle, "Only oracle can request");
        require(_proposedOutcome < market.numOutcomes, "Invalid outcome");

        LibMarket.MarketStorage storage ms = LibMarket.marketStorage();
        require(ms.umaOracle != address(0), "UMA oracle not set");

        UMAOracleMock oracle = UMAOracleMock(payable(ms.umaOracle));
        bytes32 assertionId = oracle.assertTruth{value: msg.value}(
            _marketId,
            bytes32(uint256(_proposedOutcome))
        );

        emit OracleRequested(_marketId, assertionId, "uma");
    }

    /// @notice Chainlink oracle callback
    /// @param _requestId Request identifier
    /// @param _marketId Market identifier
    /// @param _outcome Resolved outcome
    function oracleCallback(
        bytes32 _requestId,
        bytes32 _marketId,
        uint8 _outcome
    ) external {
        LibMarket.MarketStorage storage ms = LibMarket.marketStorage();
        require(msg.sender == ms.chainlinkOracle, "Only Chainlink oracle");

        LibMarket.Market storage market = LibMarket.getMarket(_marketId);
        require(!market.resolved, "Already resolved");
        require(_outcome < market.numOutcomes, "Invalid outcome");

        market.resolved = true;
        market.winningOutcome = _outcome;

        emit OracleResponseReceived(_marketId, _requestId, _outcome);
    }

    /// @notice UMA oracle callback
    /// @param _marketId Market identifier
    /// @param _outcome Resolved outcome
    function umaOracleCallback(
        bytes32 _marketId,
        uint8 _outcome
    ) external {
        LibMarket.MarketStorage storage ms = LibMarket.marketStorage();
        require(msg.sender == ms.umaOracle, "Only UMA oracle");

        LibMarket.Market storage market = LibMarket.getMarket(_marketId);
        require(!market.resolved, "Already resolved");
        require(_outcome < market.numOutcomes, "Invalid outcome");

        market.resolved = true;
        market.winningOutcome = _outcome;

        emit OracleResponseReceived(_marketId, bytes32(0), _outcome);
    }

    /// @notice Set Chainlink oracle address (diamond owner only)
    /// @param _oracle Chainlink oracle address
    function setChainlinkOracle(address _oracle) external {
        LibDiamond.enforceIsContractOwner();
        LibMarket.MarketStorage storage ms = LibMarket.marketStorage();
        ms.chainlinkOracle = _oracle;
    }

    /// @notice Set UMA oracle address (diamond owner only)
    /// @param _oracle UMA oracle address
    function setUMAOracle(address _oracle) external {
        LibDiamond.enforceIsContractOwner();
        LibMarket.MarketStorage storage ms = LibMarket.marketStorage();
        ms.umaOracle = _oracle;
    }

    /// @notice Get configured oracle addresses
    function getOracleAddresses() external view returns (
        address chainlinkOracle,
        address umaOracle
    ) {
        LibMarket.MarketStorage storage ms = LibMarket.marketStorage();
        return (ms.chainlinkOracle, ms.umaOracle);
    }

    /// @notice Manual resolution fallback (diamond owner only)
    /// @param _marketId Market to resolve
    /// @param _outcome Winning outcome
    function manualResolve(bytes32 _marketId, uint8 _outcome) external {
        LibDiamond.enforceIsContractOwner();

        LibMarket.Market storage market = LibMarket.getMarket(_marketId);
        require(!market.resolved, "Already resolved");
        require(_outcome < market.numOutcomes, "Invalid outcome");

        market.resolved = true;
        market.winningOutcome = _outcome;

        emit OracleResponseReceived(_marketId, bytes32(0), _outcome);
    }
}
