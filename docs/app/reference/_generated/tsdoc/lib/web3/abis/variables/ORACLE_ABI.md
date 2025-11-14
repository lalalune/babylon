[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/web3/abis](../README.md) / ORACLE\_ABI

# Variable: ORACLE\_ABI

> `const` **ORACLE\_ABI**: readonly \[`"function requestChainlinkResolution(bytes32 _marketId) external payable"`, `"function requestUMAResolution(bytes32 _marketId, uint8 _proposedOutcome) external payable"`, `"function oracleCallback(bytes32 _requestId, bytes32 _marketId, uint8 _outcome) external"`, `"function umaOracleCallback(bytes32 _marketId, uint8 _outcome) external"`, `"function setChainlinkOracle(address _oracle) external"`, `"function setUMAOracle(address _oracle) external"`, `"function manualResolve(bytes32 _marketId, uint8 _outcome) external"`, `"function getOracleAddresses() external view returns (address chainlinkOracle, address umaOracle)"`, `"event OracleRequested(bytes32 indexed marketId, bytes32 indexed requestId, string oracleType)"`, `"event OracleResponseReceived(bytes32 indexed marketId, bytes32 indexed requestId, uint8 outcome)"`\]

Defined in: [src/lib/web3/abis.ts:92](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/web3/abis.ts#L92)
