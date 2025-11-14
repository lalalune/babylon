[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/web3/abis](../README.md) / PRICE\_STORAGE\_FACET\_ABI

# Variable: PRICE\_STORAGE\_FACET\_ABI

> `const` **PRICE\_STORAGE\_FACET\_ABI**: readonly \[`"function updatePrices(bytes32[] calldata _marketIds, uint256 _tick, uint256[] calldata _prices) external"`, `"function updatePrice(bytes32 _marketId, uint256 _tick, uint256 _price) external"`, `"function submitPriceBatch(bytes32 _marketId, uint256 _startTick, uint256 _endTick, bytes32 _merkleRoot) external"`, `"function getLatestPrice(bytes32 _marketId) external view returns (uint256 price, uint256 timestamp, uint256 tick)"`, `"function getPriceAtTick(bytes32 _marketId, uint256 _tick) external view returns (uint256 price, uint256 timestamp)"`, `"function getGlobalTickCounter() external view returns (uint256)"`, `"function incrementTickCounter() external returns (uint256)"`, `"function setAuthorizedUpdater(bytes32 _marketId, address _updater) external"`, `"function getAuthorizedUpdater(bytes32 _marketId) external view returns (address)"`, `"event PriceUpdated(bytes32 indexed marketId, uint256 indexed tick, uint256 price, uint256 timestamp)"`, `"event PricesBatchUpdated(bytes32[] marketIds, uint256 tick, uint256 timestamp)"`, `"event PriceBatchSubmitted(bytes32 indexed marketId, uint256 startTick, uint256 endTick, bytes32 merkleRoot)"`, `"event AuthorizedUpdaterSet(bytes32 indexed marketId, address indexed updater, bool authorized)"`\]

Defined in: [src/lib/web3/abis.ts:121](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/web3/abis.ts#L121)
