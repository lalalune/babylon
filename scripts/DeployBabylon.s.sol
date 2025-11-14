// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../contracts/core/Diamond.sol";
import "../contracts/core/DiamondCutFacet.sol";
import "../contracts/core/DiamondLoupeFacet.sol";
import "../contracts/core/PredictionMarketFacet.sol";
import "../contracts/core/OracleFacet.sol";
import "../contracts/identity/ERC8004IdentityRegistry.sol";
import "../contracts/identity/ERC8004ReputationSystem.sol";
import "../contracts/oracles/ChainlinkOracleMock.sol";
import "../contracts/oracles/UMAOracleMock.sol";
import "../contracts/libraries/LibDiamond.sol";

/// @title DeployBabylon
/// @notice Deployment script for Babylon prediction market on Base L2
contract DeployBabylon is Script {
    // Deployed contracts
    Diamond public diamond;
    DiamondCutFacet public diamondCutFacet;
    DiamondLoupeFacet public diamondLoupeFacet;
    PredictionMarketFacet public predictionMarketFacet;
    OracleFacet public oracleFacet;
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationSystem public reputationSystem;
    ChainlinkOracleMock public chainlinkOracle;
    UMAOracleMock public umaOracle;

    // Deployment configuration
    address public deployer;
    address public feeRecipient;

    function run() external {
        // Get deployer from private key
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);

        // Set fee recipient (can be changed later)
        feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);

        console.log("Deploying Babylon to Base L2...");
        console.log("Deployer:", deployer);
        console.log("Fee Recipient:", feeRecipient);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy facets
        console.log("\n1. Deploying facets...");
        diamondCutFacet = new DiamondCutFacet();
        console.log("DiamondCutFacet:", address(diamondCutFacet));

        diamondLoupeFacet = new DiamondLoupeFacet();
        console.log("DiamondLoupeFacet:", address(diamondLoupeFacet));

        predictionMarketFacet = new PredictionMarketFacet();
        console.log("PredictionMarketFacet:", address(predictionMarketFacet));

        oracleFacet = new OracleFacet();
        console.log("OracleFacet:", address(oracleFacet));

        // 2. Deploy Diamond with DiamondCutFacet
        console.log("\n2. Deploying Diamond...");
        diamond = new Diamond(deployer, address(diamondCutFacet));
        console.log("Diamond:", address(diamond));

        // 3. Add DiamondLoupeFacet
        console.log("\n3. Adding DiamondLoupeFacet...");
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

        // 4. Add PredictionMarketFacet
        console.log("\n4. Adding PredictionMarketFacet...");
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

        // 5. Add OracleFacet
        console.log("\n5. Adding OracleFacet...");
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

        // 6. Deploy ERC-8004 Identity Registry
        console.log("\n6. Deploying ERC-8004 Identity Registry...");
        identityRegistry = new ERC8004IdentityRegistry();
        console.log("IdentityRegistry:", address(identityRegistry));

        // 7. Deploy ERC-8004 Reputation System
        console.log("\n7. Deploying ERC-8004 Reputation System...");
        reputationSystem = new ERC8004ReputationSystem(address(identityRegistry));
        console.log("ReputationSystem:", address(reputationSystem));

        // 8. Deploy Oracle Mocks (for testnet)
        if (block.chainid == 84532) { // Base Sepolia
            console.log("\n8. Deploying Oracle Mocks (Testnet)...");
            chainlinkOracle = new ChainlinkOracleMock();
            console.log("ChainlinkOracle:", address(chainlinkOracle));

            umaOracle = new UMAOracleMock();
            console.log("UMAOracle:", address(umaOracle));

            // Set oracle addresses in diamond
            OracleFacet(address(diamond)).setChainlinkOracle(address(chainlinkOracle));
            OracleFacet(address(diamond)).setUMAOracle(address(umaOracle));
        } else {
            console.log("\n8. Skipping Oracle Mocks (Mainnet - use real oracles)");
        }

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Diamond (Proxy):", address(diamond));
        console.log("DiamondCutFacet:", address(diamondCutFacet));
        console.log("DiamondLoupeFacet:", address(diamondLoupeFacet));
        console.log("PredictionMarketFacet:", address(predictionMarketFacet));
        console.log("OracleFacet:", address(oracleFacet));
        console.log("IdentityRegistry:", address(identityRegistry));
        console.log("ReputationSystem:", address(reputationSystem));
        if (block.chainid == 84532) {
            console.log("ChainlinkOracle (Mock):", address(chainlinkOracle));
            console.log("UMAOracle (Mock):", address(umaOracle));
        }

        // Save deployment addresses
        // _saveDeployment();  // Skipping file save - will save manually
    }

    function _saveDeployment() internal {
        string memory json = "deployment";

        vm.serializeAddress(json, "diamond", address(diamond));
        vm.serializeAddress(json, "diamondCutFacet", address(diamondCutFacet));
        vm.serializeAddress(json, "diamondLoupeFacet", address(diamondLoupeFacet));
        vm.serializeAddress(json, "predictionMarketFacet", address(predictionMarketFacet));
        vm.serializeAddress(json, "oracleFacet", address(oracleFacet));
        vm.serializeAddress(json, "identityRegistry", address(identityRegistry));
        vm.serializeAddress(json, "reputationSystem", address(reputationSystem));

        if (block.chainid == 84532) {
            vm.serializeAddress(json, "chainlinkOracle", address(chainlinkOracle));
            vm.serializeAddress(json, "umaOracle", address(umaOracle));
        }

        string memory chainFolder = block.chainid == 8453 ? "base" : "base-sepolia";
        string memory output = vm.serializeAddress(json, "deployer", deployer);

        vm.writeJson(output, string.concat("./deployments/", chainFolder, "/latest.json"));

        console.log("\nDeployment saved to ./deployments/", chainFolder, "/latest.json");
    }
}
