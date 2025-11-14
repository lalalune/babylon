[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/web3/abis](../README.md) / REPUTATION\_SYSTEM\_ABI

# Variable: REPUTATION\_SYSTEM\_ABI

> `const` **REPUTATION\_SYSTEM\_ABI**: readonly \[`"function getReputation(uint256 _tokenId) external view returns (uint256 totalBets, uint256 winningBets, uint256 totalVolume, uint256 profitLoss, uint256 accuracyScore, uint256 trustScore, bool isBanned)"`, `"function getFeedbackCount(uint256 _tokenId) external view returns (uint256)"`, `"function getFeedback(uint256 _tokenId, uint256 _index) external view returns (address from, int8 rating, string memory comment, uint256 timestamp)"`, `"function getAgentsByMinScore(uint256 minScore) external view returns (uint256[] memory)"`, `"function recordBet(uint256 _tokenId, uint256 _amount) external"`, `"function recordWin(uint256 _tokenId, uint256 _profit) external"`, `"function recordLoss(uint256 _tokenId, uint256 _loss) external"`, `"function submitFeedback(uint256 _tokenId, int8 _rating, string calldata _comment) external"`, `"function banAgent(uint256 _tokenId) external"`, `"function unbanAgent(uint256 _tokenId) external"`, `"event ReputationUpdated(uint256 indexed tokenId, uint256 accuracyScore, uint256 trustScore)"`, `"event FeedbackSubmitted(uint256 indexed tokenId, address indexed from, int8 rating)"`, `"event AgentBanned(uint256 indexed tokenId)"`, `"event AgentUnbanned(uint256 indexed tokenId)"`\]

Defined in: [src/lib/web3/abis.ts:34](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/web3/abis.ts#L34)
