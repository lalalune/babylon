/**
 * Contract ABIs for ERC-8004 and Prediction Market interactions
 */

// ERC-8004 Identity Registry ABI
export const IDENTITY_REGISTRY_ABI = [
  // ERC-721 standard functions
  'function balanceOf(address owner) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',

  // Agent registration
  'function registerAgent(string calldata _name, string calldata _endpoint, bytes32 _capabilitiesHash, string calldata _metadata) external returns (uint256 tokenId)',
  'function updateAgent(string calldata _endpoint, bytes32 _capabilitiesHash, string calldata _metadata) external',
  'function deactivateAgent() external',
  'function reactivateAgent() external',

  // Profile queries
  'function getAgentProfile(uint256 _tokenId) external view returns (string memory name, string memory endpoint, bytes32 capabilitiesHash, uint256 registeredAt, bool isActive, string memory metadata)',
  'function getTokenId(address _address) external view returns (uint256)',
  'function isRegistered(address _address) external view returns (bool)',
  'function verifyAgent(address _address, uint256 _tokenId) external view returns (bool)',
  'function getAllActiveAgents() external view returns (uint256[] memory)',
  'function isEndpointActive(string memory endpoint) external view returns (bool)',
  'function getAgentsByCapability(bytes32 capabilityHash) external view returns (uint256[] memory)',

  // Events
  'event AgentRegistered(uint256 indexed tokenId, address indexed owner, string name, string endpoint)',
  'event AgentUpdated(uint256 indexed tokenId, string endpoint, bytes32 capabilitiesHash)',
  'event AgentDeactivated(uint256 indexed tokenId)',
  'event AgentReactivated(uint256 indexed tokenId)',
] as const

// ERC-8004 Reputation System ABI
export const REPUTATION_SYSTEM_ABI = [
  // Reputation queries
  'function getReputation(uint256 _tokenId) external view returns (uint256 totalBets, uint256 winningBets, uint256 totalVolume, uint256 profitLoss, uint256 accuracyScore, uint256 trustScore, bool isBanned)',
  'function getFeedbackCount(uint256 _tokenId) external view returns (uint256)',
  'function getFeedback(uint256 _tokenId, uint256 _index) external view returns (address from, int8 rating, string memory comment, uint256 timestamp)',
  'function getAgentsByMinScore(uint256 minScore) external view returns (uint256[] memory)',

  // Reputation updates (only by authorized contracts)
  'function recordBet(uint256 _tokenId, uint256 _amount) external',
  'function recordWin(uint256 _tokenId, uint256 _profit) external',
  'function recordLoss(uint256 _tokenId, uint256 _loss) external',
  'function submitFeedback(uint256 _tokenId, int8 _rating, string calldata _comment) external',

  // Events
  'event ReputationUpdated(uint256 indexed tokenId, uint256 accuracyScore, uint256 trustScore)',
  'event FeedbackSubmitted(uint256 indexed tokenId, address indexed from, int8 rating)',
  'event AgentBanned(uint256 indexed tokenId)',
  'event AgentUnbanned(uint256 indexed tokenId)',
] as const

// Prediction Market Facet ABI
export const PREDICTION_MARKET_ABI = [
  // Market creation
  'function createMarket(string memory question, string[] memory outcomes, uint256 endTime, string memory category) external returns (bytes32)',
  'function resolveMarket(bytes32 marketId, uint256 winningOutcome) external',

  // Trading
  'function buyShares(bytes32 marketId, uint256 outcome, uint256 amount) external payable returns (uint256)',
  'function sellShares(bytes32 marketId, uint256 outcome, uint256 amount) external returns (uint256)',
  'function claimWinnings(bytes32 marketId) external returns (uint256)',

  // Market queries
  'function getMarket(bytes32 marketId) external view returns (tuple(string question, string[] outcomes, uint256[] prices, uint256 totalLiquidity, uint256 endTime, bool resolved, uint256 winningOutcome, string category, uint256 createdAt))',
  'function getMarketPrice(bytes32 marketId, uint256 outcome) external view returns (uint256)',
  'function getUserPosition(bytes32 marketId, address user) external view returns (tuple(uint256[] shares, uint256 totalInvested, bool claimed))',
  'function getActiveMarkets() external view returns (bytes32[] memory)',
  'function getMarketsByCategory(string memory category) external view returns (bytes32[] memory)',

  // Events
  'event MarketCreated(bytes32 indexed marketId, string question, string[] outcomes, uint256 endTime)',
  'event SharesPurchased(bytes32 indexed marketId, address indexed buyer, uint256 outcome, uint256 shares, uint256 cost)',
  'event SharesSold(bytes32 indexed marketId, address indexed seller, uint256 outcome, uint256 shares, uint256 payout)',
  'event MarketResolved(bytes32 indexed marketId, uint256 winningOutcome, uint256 timestamp)',
  'event WinningsClaimed(bytes32 indexed marketId, address indexed user, uint256 amount)',
] as const

// Oracle Facet ABI
export const ORACLE_ABI = [
  // Oracle management
  'function addOracle(address oracleAddress, string memory name) external',
  'function removeOracle(address oracleAddress) external',
  'function submitResolution(bytes32 marketId, uint256 outcome) external',

  // Chainlink integration
  'function requestChainlinkData(bytes32 marketId, string memory dataSource) external returns (bytes32)',
  'function fulfillChainlinkRequest(bytes32 requestId, uint256 outcome) external',

  // Oracle queries
  'function getOracle(address oracleAddress) external view returns (tuple(string name, uint256 totalResolutions, uint256 accuracy, bool isActive))',
  'function getAllOracles() external view returns (address[] memory)',
  'function getMarketResolutions(bytes32 marketId) external view returns (tuple(address oracle, uint256 outcome, uint256 timestamp)[] memory)',

  // Events
  'event OracleAdded(address indexed oracleAddress, string name)',
  'event OracleRemoved(address indexed oracleAddress)',
  'event ResolutionSubmitted(bytes32 indexed marketId, address indexed oracle, uint256 outcome)',
  'event ChainlinkRequestCreated(bytes32 indexed requestId, bytes32 indexed marketId, string dataSource)',
] as const

// Diamond Loupe ABI (for facet discovery)
export const DIAMOND_LOUPE_ABI = [
  'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[] memory)',
  'function facetFunctionSelectors(address facet) external view returns (bytes4[] memory)',
  'function facetAddresses() external view returns (address[] memory)',
  'function facetAddress(bytes4 functionSelector) external view returns (address)',
] as const
