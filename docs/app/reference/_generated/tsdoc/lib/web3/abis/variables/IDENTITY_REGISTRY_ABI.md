[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/web3/abis](../README.md) / IDENTITY\_REGISTRY\_ABI

# Variable: IDENTITY\_REGISTRY\_ABI

> `const` **IDENTITY\_REGISTRY\_ABI**: readonly \[`"function balanceOf(address owner) external view returns (uint256)"`, `"function ownerOf(uint256 tokenId) external view returns (address)"`, `"function registerAgent(string calldata _name, string calldata _endpoint, bytes32 _capabilitiesHash, string calldata _metadata) external returns (uint256 tokenId)"`, `"function updateAgent(string calldata _endpoint, bytes32 _capabilitiesHash, string calldata _metadata) external"`, `"function deactivateAgent() external"`, `"function reactivateAgent() external"`, `"function getAgentProfile(uint256 _tokenId) external view returns (string memory name, string memory endpoint, bytes32 capabilitiesHash, uint256 registeredAt, bool isActive, string memory metadata)"`, `"function getTokenId(address _address) external view returns (uint256)"`, `"function isRegistered(address _address) external view returns (bool)"`, `"function verifyAgent(address _address, uint256 _tokenId) external view returns (bool)"`, `"function getAllActiveAgents() external view returns (uint256[] memory)"`, `"function isEndpointActive(string memory endpoint) external view returns (bool)"`, `"function getAgentsByCapability(bytes32 capabilityHash) external view returns (uint256[] memory)"`, `"event AgentRegistered(uint256 indexed tokenId, address indexed owner, string name, string endpoint)"`, `"event AgentUpdated(uint256 indexed tokenId, string endpoint, bytes32 capabilitiesHash)"`, `"event AgentDeactivated(uint256 indexed tokenId)"`, `"event AgentReactivated(uint256 indexed tokenId)"`\]

Defined in: [src/lib/web3/abis.ts:6](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/web3/abis.ts#L6)

Contract ABIs for ERC-8004 and Prediction Market interactions
