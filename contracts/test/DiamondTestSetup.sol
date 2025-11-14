// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../core/Diamond.sol";
import "../core/DiamondCutFacet.sol";
import "../core/DiamondLoupeFacet.sol";
import "../core/PredictionMarketFacet.sol";
import "../core/OracleFacet.sol";
import "../libraries/LibDiamond.sol";
import "../oracles/ChainlinkOracleMock.sol";
import "../oracles/UMAOracleMock.sol";

/// @title DiamondTestSetup
/// @notice Base test contract with Diamond deployment and facet setup
contract DiamondTestSetup is Test {
    Diamond public diamond;
    DiamondCutFacet public diamondCutFacet;
    DiamondLoupeFacet public diamondLoupeFacet;
    PredictionMarketFacet public predictionMarketFacet;
    OracleFacet public oracleFacet;
    ChainlinkOracleMock public chainlinkOracle;
    UMAOracleMock public umaOracle;

    address public owner;
    address public user1;
    address public user2;
    address public user3;

    function setUp() public virtual {
        // Setup test accounts
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");

        // Fund test accounts
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(user3, 100 ether);

        // Deploy facets
        diamondCutFacet = new DiamondCutFacet();
        diamondLoupeFacet = new DiamondLoupeFacet();
        predictionMarketFacet = new PredictionMarketFacet();
        oracleFacet = new OracleFacet();

        // Deploy Diamond with DiamondCutFacet and DiamondLoupeFacet
        diamond = new Diamond(address(diamondCutFacet), address(diamondLoupeFacet));

        // Add DiamondLoupeFacet
        IDiamondCut.FacetCut[] memory loupeCut = new IDiamondCut.FacetCut[](1);
        bytes4[] memory loupeSelectors = new bytes4[](5);
        loupeSelectors[0] = DiamondLoupeFacet.facets.selector;
        loupeSelectors[1] = DiamondLoupeFacet.facetFunctionSelectors.selector;
        loupeSelectors[2] = DiamondLoupeFacet.facetAddresses.selector;
        loupeSelectors[3] = DiamondLoupeFacet.facetAddress.selector;
        loupeSelectors[4] = bytes4(keccak256("supportsInterface(bytes4)"));

        loupeCut[0] = IDiamondCut.FacetCut({
            facetAddress: address(diamondLoupeFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: loupeSelectors
        });

        IDiamondCut(address(diamond)).diamondCut(loupeCut, address(0), "");

        // Add PredictionMarketFacet
        IDiamondCut.FacetCut[] memory marketCut = new IDiamondCut.FacetCut[](1);
        bytes4[] memory marketSelectors = new bytes4[](13);
        marketSelectors[0] = PredictionMarketFacet.createMarket.selector;
        marketSelectors[1] = PredictionMarketFacet.calculateCost.selector;
        marketSelectors[2] = PredictionMarketFacet.buyShares.selector;
        marketSelectors[3] = PredictionMarketFacet.sellShares.selector;
        marketSelectors[4] = PredictionMarketFacet.calculateSellPayout.selector;
        marketSelectors[5] = PredictionMarketFacet.resolveMarket.selector;
        marketSelectors[6] = PredictionMarketFacet.claimWinnings.selector;
        marketSelectors[7] = PredictionMarketFacet.deposit.selector;
        marketSelectors[8] = PredictionMarketFacet.withdraw.selector;
        marketSelectors[9] = PredictionMarketFacet.getBalance.selector;
        marketSelectors[10] = PredictionMarketFacet.getMarket.selector;
        marketSelectors[11] = PredictionMarketFacet.getMarketShares.selector;
        marketSelectors[12] = PredictionMarketFacet.getPosition.selector;

        marketCut[0] = IDiamondCut.FacetCut({
            facetAddress: address(predictionMarketFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: marketSelectors
        });

        IDiamondCut(address(diamond)).diamondCut(marketCut, address(0), "");

        // Add OracleFacet
        IDiamondCut.FacetCut[] memory oracleCut = new IDiamondCut.FacetCut[](1);
        bytes4[] memory oracleSelectors = new bytes4[](8);
        oracleSelectors[0] = OracleFacet.requestChainlinkResolution.selector;
        oracleSelectors[1] = OracleFacet.requestUMAResolution.selector;
        oracleSelectors[2] = OracleFacet.oracleCallback.selector;
        oracleSelectors[3] = OracleFacet.umaOracleCallback.selector;
        oracleSelectors[4] = OracleFacet.setChainlinkOracle.selector;
        oracleSelectors[5] = OracleFacet.setUMAOracle.selector;
        oracleSelectors[6] = OracleFacet.manualResolve.selector;
        oracleSelectors[7] = OracleFacet.getOracleAddresses.selector;

        oracleCut[0] = IDiamondCut.FacetCut({
            facetAddress: address(oracleFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: oracleSelectors
        });

        IDiamondCut(address(diamond)).diamondCut(oracleCut, address(0), "");

        // Deploy oracles
        chainlinkOracle = new ChainlinkOracleMock();
        umaOracle = new UMAOracleMock();

        // Set oracle addresses in diamond
        OracleFacet(address(diamond)).setChainlinkOracle(address(chainlinkOracle));
        OracleFacet(address(diamond)).setUMAOracle(address(umaOracle));
    }

    /// @notice Helper to create a basic binary market
    function createBasicMarket() internal returns (bytes32 marketId) {
        string[] memory outcomes = new string[](2);
        outcomes[0] = "Yes";
        outcomes[1] = "No";

        marketId = PredictionMarketFacet(address(diamond)).createMarket(
            "Will ETH reach $5000 by EOY?",
            outcomes,
            block.timestamp + 30 days,
            owner
        );
    }
}
