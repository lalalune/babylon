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

  // Agent management (owner only)
  'function banAgent(uint256 _tokenId) external',
  'function unbanAgent(uint256 _tokenId) external',

  // Events
  'event ReputationUpdated(uint256 indexed tokenId, uint256 accuracyScore, uint256 trustScore)',
  'event FeedbackSubmitted(uint256 indexed tokenId, address indexed from, int8 rating)',
  'event AgentBanned(uint256 indexed tokenId)',
  'event AgentUnbanned(uint256 indexed tokenId)',
] as const

// Prediction Market Facet ABI
export const PREDICTION_MARKET_ABI = [
  // Market creation
  'function createMarket(string calldata _question, string[] calldata _outcomeNames, uint256 _resolveAt, address _oracle) external returns (bytes32)',
  'function resolveMarket(bytes32 _marketId, uint8 _winningOutcome) external',

  // Trading
  'function buyShares(bytes32 _marketId, uint8 _outcome, uint256 _numShares) external payable',
  'function sellShares(bytes32 _marketId, uint8 _outcome, uint256 _numShares) external',
  'function claimWinnings(bytes32 _marketId) external',
  'function calculateCost(bytes32 _marketId, uint8 _outcome, uint256 _numShares) external view returns (uint256)',
  'function calculateSellPayout(bytes32 _marketId, uint8 _outcome, uint256 _numShares) external view returns (uint256)',

  // Balance management
  'function deposit() external payable',
  'function withdraw(uint256 _amount) external',
  'function getBalance(address _user) external view returns (uint256)',

  // Market queries
  'function getMarket(bytes32 _marketId) external view returns (string memory question, uint8 numOutcomes, uint256 liquidity, bool resolved, uint8 winningOutcome)',
  'function getMarketShares(bytes32 _marketId, uint8 _outcome) external view returns (uint256)',
  'function getPosition(address _user, bytes32 _marketId, uint8 _outcome) external view returns (uint256)',

  // Events
  'event MarketCreated(bytes32 indexed marketId, string question, uint8 numOutcomes, uint256 liquidity)',
  'event SharesPurchased(bytes32 indexed marketId, address indexed buyer, uint8 outcome, uint256 shares, uint256 cost)',
  'event SharesSold(bytes32 indexed marketId, address indexed seller, uint8 outcome, uint256 shares, uint256 payout)',
  'event MarketResolved(bytes32 indexed marketId, uint8 winningOutcome)',
  'event PositionClaimed(bytes32 indexed marketId, address indexed claimer, uint256 payout)',
  'event Deposited(address indexed user, uint256 amount)',
  'event Withdrawn(address indexed user, uint256 amount)',
] as const

// Oracle Facet ABI
export const ORACLE_ABI = [
  // Oracle resolution requests
  'function requestChainlinkResolution(bytes32 _marketId) external payable',
  'function requestUMAResolution(bytes32 _marketId, uint8 _proposedOutcome) external payable',
  
  // Oracle callbacks
  'function oracleCallback(bytes32 _requestId, bytes32 _marketId, uint8 _outcome) external',
  'function umaOracleCallback(bytes32 _marketId, uint8 _outcome) external',
  
  // Oracle management
  'function setChainlinkOracle(address _oracle) external',
  'function setUMAOracle(address _oracle) external',
  'function manualResolve(bytes32 _marketId, uint8 _outcome) external',
  'function getOracleAddresses() external view returns (address chainlinkOracle, address umaOracle)',

  // Events
  'event OracleRequested(bytes32 indexed marketId, bytes32 indexed requestId, string oracleType)',
  'event OracleResponseReceived(bytes32 indexed marketId, bytes32 indexed requestId, uint8 outcome)',
] as const

// Diamond Loupe ABI (for facet discovery)
export const DIAMOND_LOUPE_ABI = [
  'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[] memory)',
  'function facetFunctionSelectors(address facet) external view returns (bytes4[] memory)',
  'function facetAddresses() external view returns (address[] memory)',
  'function facetAddress(bytes4 functionSelector) external view returns (address)',
] as const

// Price Storage Facet ABI
export const PRICE_STORAGE_FACET_ABI = [
  // Price updates
  'function updatePrices(bytes32[] calldata _marketIds, uint256 _tick, uint256[] calldata _prices) external',
  'function updatePrice(bytes32 _marketId, uint256 _tick, uint256 _price) external',
  'function submitPriceBatch(bytes32 _marketId, uint256 _startTick, uint256 _endTick, bytes32 _merkleRoot) external',
  
  // Price queries
  'function getLatestPrice(bytes32 _marketId) external view returns (uint256 price, uint256 timestamp, uint256 tick)',
  'function getPriceAtTick(bytes32 _marketId, uint256 _tick) external view returns (uint256 price, uint256 timestamp)',
  'function getGlobalTickCounter() external view returns (uint256)',
  
  // Authorization
  'function incrementTickCounter() external returns (uint256)',
  'function setAuthorizedUpdater(bytes32 _marketId, address _updater) external',
  'function getAuthorizedUpdater(bytes32 _marketId) external view returns (address)',
  
  // Events
  'event PriceUpdated(bytes32 indexed marketId, uint256 indexed tick, uint256 price, uint256 timestamp)',
  'event PricesBatchUpdated(bytes32[] marketIds, uint256 tick, uint256 timestamp)',
  'event PriceBatchSubmitted(bytes32 indexed marketId, uint256 startTick, uint256 endTick, bytes32 merkleRoot)',
  'event AuthorizedUpdaterSet(bytes32 indexed marketId, address indexed updater, bool authorized)',
] as const
