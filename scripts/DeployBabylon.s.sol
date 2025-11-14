// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../contracts/core/Diamond.sol";
import "../contracts/core/DiamondCutFacet.sol";
import "../contracts/core/DiamondLoupeFacet.sol";
import "../contracts/core/PredictionMarketFacet.sol";
import "../contracts/core/OracleFacet.sol";
import "../contracts/core/LiquidityPoolFacet.sol";
import "../contracts/core/PerpetualMarketFacet.sol";
import "../contracts/core/ReferralSystemFacet.sol";
import "../contracts/core/PriceStorageFacet.sol";
import "../contracts/identity/ERC8004IdentityRegistry.sol";
import "../contracts/identity/ERC8004ReputationSystem.sol";
import "../contracts/oracles/ChainlinkOracleMock.sol";
import "../contracts/oracles/UMAOracleMock.sol";
import "../contracts/libraries/LibDiamond.sol";

// Oracle system imports
import {BabylonGameOracle} from "../contracts/src/game/BabylonGameOracle.sol";
import {Predimarket} from "../contracts/src/prediction-markets/Predimarket.sol";
import {MarketFactory} from "../contracts/src/prediction-markets/MarketFactory.sol";
import {Contest} from "../contracts/src/game/Contest.sol";
import {BanManager} from "../contracts/src/moderation/BanManager.sol";
import {ReportingSystem} from "../contracts/src/moderation/ReportingSystem.sol";
import {ReputationLabelManager} from "../contracts/src/moderation/ReputationLabelManager.sol";

// Mock ERC20 for testing
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice Mock ERC20 token for testing prediction markets
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10**18); // Mint 1M tokens
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title DeployBabylon
/// @notice Deployment script for Babylon prediction market on Base L2
contract DeployBabylon is Script {
    // Deployed contracts - Diamond system
    Diamond public diamond;
    DiamondCutFacet public diamondCutFacet;
    DiamondLoupeFacet public diamondLoupeFacet;
    PredictionMarketFacet public predictionMarketFacet;
    OracleFacet public oracleFacet;
    LiquidityPoolFacet public liquidityPoolFacet;
    PerpetualMarketFacet public perpetualMarketFacet;
    ReferralSystemFacet public referralSystemFacet;
    PriceStorageFacet public priceStorageFacet;
    
    // Identity system
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationSystem public reputationSystem;
    
    // Oracle mocks
    ChainlinkOracleMock public chainlinkOracle;
    UMAOracleMock public umaOracle;
    
    // Oracle system - new contracts
    BabylonGameOracle public babylonOracle;
    Predimarket public predimarket;
    MarketFactory public marketFactory;
    Contest public contestOracle;
    
    // Moderation system
    BanManager public banManager;
    ReportingSystem public reportingSystem;
    ReputationLabelManager public labelManager;
    
    // Test token (for testnet/localnet only)
    MockERC20 public testToken;

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
        diamond = new Diamond(address(diamondCutFacet), address(diamondLoupeFacet));
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

        // 6. Deploy and add new facets (LiquidityPool, PerpetualMarket, ReferralSystem)
        console.log("\n6. Deploying new facets...");
        liquidityPoolFacet = new LiquidityPoolFacet();
        console.log("LiquidityPoolFacet:", address(liquidityPoolFacet));

        perpetualMarketFacet = new PerpetualMarketFacet();
        console.log("PerpetualMarketFacet:", address(perpetualMarketFacet));

        referralSystemFacet = new ReferralSystemFacet();
        console.log("ReferralSystemFacet:", address(referralSystemFacet));

        priceStorageFacet = new PriceStorageFacet();
        console.log("PriceStorageFacet:", address(priceStorageFacet));

        // 7. Add new facets to Diamond
        console.log("\n7. Adding new facets to Diamond...");
        IDiamondCut.FacetCut[] memory newFacetsCut = new IDiamondCut.FacetCut[](4);

        // LiquidityPoolFacet selectors
        bytes4[] memory liquiditySelectors = new bytes4[](12);
        liquiditySelectors[0] = LiquidityPoolFacet.createLiquidityPool.selector;
        liquiditySelectors[1] = LiquidityPoolFacet.addLiquidity.selector;
        liquiditySelectors[2] = LiquidityPoolFacet.removeLiquidity.selector;
        liquiditySelectors[3] = LiquidityPoolFacet.swap.selector;
        liquiditySelectors[4] = LiquidityPoolFacet.getPool.selector;
        liquiditySelectors[5] = LiquidityPoolFacet.getLPPosition.selector;
        liquiditySelectors[6] = LiquidityPoolFacet.getSwapOutput.selector;
        liquiditySelectors[7] = LiquidityPoolFacet.getUtilization.selector;
        liquiditySelectors[8] = LiquidityPoolFacet.getReserves.selector;
        liquiditySelectors[9] = LiquidityPoolFacet.getPriceImpact.selector;
        liquiditySelectors[10] = LiquidityPoolFacet.getPendingRewards.selector;
        liquiditySelectors[11] = LiquidityPoolFacet.claimRewards.selector;

        newFacetsCut[0] = IDiamondCut.FacetCut({
            facetAddress: address(liquidityPoolFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: liquiditySelectors
        });

        // PerpetualMarketFacet selectors
        bytes4[] memory perpetualSelectors = new bytes4[](10);
        perpetualSelectors[0] = PerpetualMarketFacet.createPerpetualMarket.selector;
        perpetualSelectors[1] = PerpetualMarketFacet.openPosition.selector;
        perpetualSelectors[2] = PerpetualMarketFacet.closePosition.selector;
        perpetualSelectors[3] = PerpetualMarketFacet.liquidatePosition.selector;
        perpetualSelectors[4] = PerpetualMarketFacet.updateFundingRate.selector;
        perpetualSelectors[5] = PerpetualMarketFacet.getPerpetualMarket.selector;
        perpetualSelectors[6] = PerpetualMarketFacet.getPosition.selector;
        perpetualSelectors[7] = PerpetualMarketFacet.getLiquidationPrice.selector;
        perpetualSelectors[8] = PerpetualMarketFacet.getMarkPrice.selector;
        perpetualSelectors[9] = PerpetualMarketFacet.getFundingRate.selector;

        newFacetsCut[1] = IDiamondCut.FacetCut({
            facetAddress: address(perpetualMarketFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: perpetualSelectors
        });

        // ReferralSystemFacet selectors
        bytes4[] memory referralSelectors = new bytes4[](10);
        referralSelectors[0] = ReferralSystemFacet.registerReferral.selector;
        referralSelectors[1] = ReferralSystemFacet.payReferralCommission.selector;
        referralSelectors[2] = ReferralSystemFacet.claimReferralEarnings.selector;
        referralSelectors[3] = ReferralSystemFacet.getReferralData.selector;
        referralSelectors[4] = ReferralSystemFacet.getTierInfo.selector;
        referralSelectors[5] = ReferralSystemFacet.getReferralChain.selector;
        referralSelectors[6] = ReferralSystemFacet.getTotalReferrals.selector;
        referralSelectors[7] = ReferralSystemFacet.getTotalCommissions.selector;
        referralSelectors[8] = ReferralSystemFacet.isReferred.selector;
        referralSelectors[9] = ReferralSystemFacet.calculateCommission.selector;

        newFacetsCut[2] = IDiamondCut.FacetCut({
            facetAddress: address(referralSystemFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: referralSelectors
        });

        // PriceStorageFacet selectors
        bytes4[] memory priceSelectors = new bytes4[](9);
        priceSelectors[0] = PriceStorageFacet.updatePrices.selector;
        priceSelectors[1] = PriceStorageFacet.updatePrice.selector;
        priceSelectors[2] = PriceStorageFacet.submitPriceBatch.selector;
        priceSelectors[3] = PriceStorageFacet.getLatestPrice.selector;
        priceSelectors[4] = PriceStorageFacet.getPriceAtTick.selector;
        priceSelectors[5] = PriceStorageFacet.getGlobalTickCounter.selector;
        priceSelectors[6] = PriceStorageFacet.incrementTickCounter.selector;
        priceSelectors[7] = PriceStorageFacet.setAuthorizedUpdater.selector;
        priceSelectors[8] = PriceStorageFacet.getAuthorizedUpdater.selector;

        newFacetsCut[3] = IDiamondCut.FacetCut({
            facetAddress: address(priceStorageFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: priceSelectors
        });

        IDiamondCut(address(diamond)).diamondCut(newFacetsCut, address(0), "");

        // 8. Deploy ERC-8004 Identity Registry
        console.log("\n8. Deploying ERC-8004 Identity Registry...");
        identityRegistry = new ERC8004IdentityRegistry();
        console.log("IdentityRegistry:", address(identityRegistry));

        // 9. Deploy ERC-8004 Reputation System
        console.log("\n9. Deploying ERC-8004 Reputation System...");
        reputationSystem = new ERC8004ReputationSystem(address(identityRegistry));
        console.log("ReputationSystem:", address(reputationSystem));

        // 10. Deploy Oracle Mocks (for testnet)
        if (block.chainid == 84532 || block.chainid == 31337) { // Base Sepolia or Localnet
            console.log("\n10. Deploying Oracle Mocks (Testnet)...");
            chainlinkOracle = new ChainlinkOracleMock();
            console.log("ChainlinkOracle:", address(chainlinkOracle));

            umaOracle = new UMAOracleMock();
            console.log("UMAOracle:", address(umaOracle));

            // Set oracle addresses in diamond
            OracleFacet(address(diamond)).setChainlinkOracle(address(chainlinkOracle));
            OracleFacet(address(diamond)).setUMAOracle(address(umaOracle));
        } else {
            console.log("\n10. Skipping Oracle Mocks (Mainnet - use real oracles)");
        }
        
        // 11. Deploy Test ERC20 Token (for testnet/localnet)
        if (block.chainid == 84532 || block.chainid == 31337) {
            console.log("\n11. Deploying Test ERC20 Token...");
            testToken = new MockERC20("Babylon Test Token", "BTT");
            console.log("TestToken:", address(testToken));
        }
        
        // 12. Deploy Babylon Game Oracle
        console.log("\n12. Deploying Babylon Game Oracle...");
        babylonOracle = new BabylonGameOracle(deployer); // Deployer is game server initially
        console.log("BabylonGameOracle:", address(babylonOracle));
        
        // 13. Deploy Predimarket (LMSR prediction market)
        console.log("\n13. Deploying Predimarket...");
        address paymentToken = block.chainid == 84532 || block.chainid == 31337 
            ? address(testToken)  // Use test token on testnet/localnet
            : address(0); // TODO: Set to real token on mainnet (USDC, etc.)
        
        require(paymentToken != address(0), "Payment token not set");
        
        predimarket = new Predimarket(
            paymentToken,           // Payment token
            address(babylonOracle), // Oracle address
            deployer,               // Treasury
            deployer                // Owner
        );
        console.log("Predimarket:", address(predimarket));
        
        // 14. Deploy Market Factory
        console.log("\n14. Deploying Market Factory...");
        marketFactory = new MarketFactory(
            address(predimarket),
            address(babylonOracle),
            1000 * 1e18,  // Default liquidity: 1000 tokens
            deployer       // Owner
        );
        console.log("MarketFactory:", address(marketFactory));
        
        // 15. Deploy Contest Oracle
        console.log("\n15. Deploying Contest Oracle...");
        contestOracle = new Contest(deployer); // Deployer is TEE publisher initially
        console.log("ContestOracle:", address(contestOracle));
        
        // 16. Deploy Moderation System
        console.log("\n16. Deploying Moderation System...");
        
        // BanManager
        banManager = new BanManager(deployer, deployer); // governance, owner
        console.log("BanManager:", address(banManager));
        
        // ReputationLabelManager
        labelManager = new ReputationLabelManager(
            address(banManager),
            address(predimarket),  // Uses Predimarket for voting
            deployer,              // Governance
            deployer               // Owner
        );
        console.log("ReputationLabelManager:", address(labelManager));
        
        // ReportingSystem
        reportingSystem = new ReportingSystem(
            address(banManager),
            address(labelManager),
            address(predimarket),      // Uses Predimarket for voting
            address(identityRegistry), // Identity registry
            deployer,                  // Governance
            deployer                   // Owner
        );
        console.log("ReportingSystem:", address(reportingSystem));
        
        // 17. Configure integrations
        console.log("\n17. Configuring integrations...");
        
        // Authorize ReportingSystem and ReputationLabelManager to create markets in Predimarket
        // Note: Predimarket needs addAuthorizedCreator function - we'll call it through owner
        // predimarket.addAuthorizedCreator(address(reportingSystem));
        // predimarket.addAuthorizedCreator(address(labelManager));
        console.log("Moderation system configured (manual authorization needed)");

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n=================== DEPLOYMENT SUMMARY ===================");
        console.log("\n--- Diamond System ---");
        console.log("Diamond (Proxy):", address(diamond));
        console.log("DiamondCutFacet:", address(diamondCutFacet));
        console.log("DiamondLoupeFacet:", address(diamondLoupeFacet));
        console.log("PredictionMarketFacet:", address(predictionMarketFacet));
        console.log("OracleFacet:", address(oracleFacet));
        console.log("LiquidityPoolFacet:", address(liquidityPoolFacet));
        console.log("PerpetualMarketFacet:", address(perpetualMarketFacet));
        console.log("ReferralSystemFacet:", address(referralSystemFacet));
        console.log("PriceStorageFacet:", address(priceStorageFacet));
        
        console.log("\n--- Identity System ---");
        console.log("IdentityRegistry:", address(identityRegistry));
        console.log("ReputationSystem:", address(reputationSystem));
        
        console.log("\n--- Oracle System ---");
        console.log("BabylonGameOracle:", address(babylonOracle));
        console.log("Predimarket:", address(predimarket));
        console.log("MarketFactory:", address(marketFactory));
        console.log("ContestOracle:", address(contestOracle));
        
        console.log("\n--- Moderation System ---");
        console.log("BanManager:", address(banManager));
        console.log("ReputationLabelManager:", address(labelManager));
        console.log("ReportingSystem:", address(reportingSystem));
        
        if (block.chainid == 84532 || block.chainid == 31337) {
            console.log("\n--- Test Infrastructure ---");
            console.log("ChainlinkOracle (Mock):", address(chainlinkOracle));
            console.log("UMAOracle (Mock):", address(umaOracle));
            console.log("TestToken (BTT):", address(testToken));
        }
        
        console.log("\n==========================================================");

        // Save deployment addresses
        // _saveDeployment();  // Skipping file save - will save manually
    }

    function _saveDeployment() internal {
        string memory json = "deployment";

        // Diamond system
        vm.serializeAddress(json, "diamond", address(diamond));
        vm.serializeAddress(json, "diamondCutFacet", address(diamondCutFacet));
        vm.serializeAddress(json, "diamondLoupeFacet", address(diamondLoupeFacet));
        vm.serializeAddress(json, "predictionMarketFacet", address(predictionMarketFacet));
        vm.serializeAddress(json, "oracleFacet", address(oracleFacet));
        vm.serializeAddress(json, "liquidityPoolFacet", address(liquidityPoolFacet));
        vm.serializeAddress(json, "perpetualMarketFacet", address(perpetualMarketFacet));
        vm.serializeAddress(json, "referralSystemFacet", address(referralSystemFacet));
        
        // Identity system
        vm.serializeAddress(json, "identityRegistry", address(identityRegistry));
        vm.serializeAddress(json, "reputationSystem", address(reputationSystem));
        
        // Oracle system
        vm.serializeAddress(json, "babylonOracle", address(babylonOracle));
        vm.serializeAddress(json, "predimarket", address(predimarket));
        vm.serializeAddress(json, "marketFactory", address(marketFactory));
        vm.serializeAddress(json, "contestOracle", address(contestOracle));
        
        // Moderation system
        vm.serializeAddress(json, "banManager", address(banManager));
        vm.serializeAddress(json, "reportingSystem", address(reportingSystem));
        vm.serializeAddress(json, "labelManager", address(labelManager));

        // Test infrastructure (testnet/localnet only)
        if (block.chainid == 84532 || block.chainid == 31337) {
            vm.serializeAddress(json, "chainlinkOracle", address(chainlinkOracle));
            vm.serializeAddress(json, "umaOracle", address(umaOracle));
            vm.serializeAddress(json, "testToken", address(testToken));
        }

        string memory chainFolder = block.chainid == 8453 ? "base" : 
                                   block.chainid == 31337 ? "local" : "base-sepolia";
        string memory output = vm.serializeAddress(json, "deployer", deployer);

        vm.writeJson(output, string.concat("./deployments/", chainFolder, "/latest.json"));

        console.log("\nDeployment saved to ./deployments/", chainFolder, "/latest.json");
    }
}
