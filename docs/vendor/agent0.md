Abstract
This protocol proposes to use blockchains to discover, choose, and interact with agents across organizational boundaries without pre-existing trust, thus enabling open-ended agent economies.

Trust models are pluggable and tiered, with security proportional to value at risk, from low-stake tasks like ordering pizza to high-stake tasks like medical diagnosis. Developers can choose from three trust models: reputation systems using client feedback, validation via stake-secured re-execution, zkML proofs, or TEE oracles.

 Motivation
MCP allows servers to list and offer their capabilities (prompts, resources, tools, and completions), while A2A handles agent authentication, skills advertisement via AgentCards, direct messaging, and complete task-lifecycle orchestration. However, these agent communication protocols don’t inherently cover agent discovery and trust.

To foster an open, cross-organizational agent economy, we need mechanisms for discovering and trusting agents in untrusted settings. This ERC addresses this need through three lightweight registries, which can be deployed on any L2 or on Mainnet as per-chain singletons:

Identity Registry - A minimal on-chain handle based on ERC-721 with URIStorage extension that resolves to an agent’s registration file, providing every agent with a portable, censorship-resistant identifier.

Reputation Registry - A standard interface for posting and fetching feedback signals. Scoring and aggregation occur both on-chain (for composability) and off-chain (for sophisticated algorithms), enabling an ecosystem of specialized services for agent scoring, auditor networks, and insurance pools.

Validation Registry - Generic hooks for requesting and recording independent validators checks (e.g. stakers re-running the job, zkML verifiers, TEE oracles, trusted judges).

Payments are orthogonal to this protocol and not covered here. However, examples are provided showing how x402 payment proofs can enrich feedback signals.

 Specification
The key words “MUST”, “MUST NOT”, “REQUIRED”, “SHALL”, “SHALL NOT”, “SHOULD”, “SHOULD NOT”, “RECOMMENDED”, “NOT RECOMMENDED”, “MAY”, and “OPTIONAL” in this document are to be interpreted as described in RFC 2119 and RFC 8174.

 Identity Registry
The Identity Registry uses ERC-721 with the URIStorage extension for agent registration, making all agents immediately browsable and transferable with NFTs-compliant apps. Each agent is uniquely identified globally by:

namespace: eip155 for EVM chains
chainId: The blockchain network identifier
identityRegistry: The address where the ERC-721 registry contract is deployed
agentId: The ERC-721 tokenId assigned incrementally by the registry
Throughout this document, tokenId in ERC-721 is referred to as agentId. The owner of the ERC-721 token is the owner of the agent and can transfer ownership or delegate management (e.g., updating the registration file) to operators, as supported by ERC721URIStorage.

 Token URI and Agent Registration File
The tokenURI MUST resolve to the agent registration file. It MAY use any URI scheme such as ipfs:// (e.g., ipfs://cid) or https:// (e.g., https://domain.com/agent3.json). When the registration data changes, it can be updated with _setTokenURI() as per ERC721URIStorage.

The registration file MUST have the following structure:

{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "myAgentName",
  "description": "A natural language description of the Agent, which MAY include what it does, how it works, pricing, and interaction methods",
  "image": "https://example.com/agentimage.png",
  "endpoints": [
    {
      "name": "A2A",
      "endpoint": "https://agent.example/.well-known/agent-card.json",
      "version": "0.3.0"
    },
    {
      "name": "MCP",
      "endpoint": "https://mcp.agent.eth/",
      "capabilities": {}, // OPTIONAL, as per MCP spec
      "version": "2025-06-18"
    },
    {
      "name": "OASF",
      "endpoint": "ipfs://{cid}",
      "version": "0.7" // https://github.com/agntcy/oasf/tree/v0.7.0
    },
    {
      "name": "ENS",
      "endpoint": "vitalik.eth",
      "version": "v1"
    },
    {
      "name": "DID",
      "endpoint": "did:method:foobar",
      "version": "v1"
    },
    {
      "name": "agentWallet",
      "endpoint": "eip155:1:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7"
    }
  ],
  "registrations": [
    {
      "agentId": 22,
      "agentRegistry": "eip155:1:{identityRegistry}"
    }
  ],
  "supportedTrust": [
    "reputation",
    "crypto-economic",
    "tee-attestation"
  ]
}
The type, name, description, and image fields at the top SHOULD ensure compatibility with ERC-721 apps. The number and type of endpoints are fully customizable, allowing developers to add as many as they wish. The version field in endpoints is a SHOULD, not a MUST.

Agents MAY advertise their endpoints, which point to an A2A agent card, an MCP endpoint, an ENS agent name, DIDs, or the agent’s wallets on any chain (even chains where the agent is not registered).

Agents SHOULD have at least one registration (multiple are possible), and all fields in the registration are mandatory.
The supportedTrust field is OPTIONAL. If absent or empty, this ERC is used only for discovery, not for trust.

 Onchain metadata
The registry extends ERC-721 by adding getMetadata(uint256 agentId, string key) and setMetadata(uint256 agentId, string key, bytes value) functions for optional extra on-chain agent metadata.
Examples of keys are “agentWallet” or “agentName”.

When metadata is set, the following event is emitted:

event MetadataSet(uint256 indexed agentId, string indexed indexedKey, string key, bytes value)
 Registration
New agents can be minted by calling one of these functions:

struct MetadataEntry {
string key;
bytes value;
}

function register(string tokenURI, MetadataEntry[] calldata metadata) returns (uint256 agentId)

function register(string tokenURI) returns (uint256 agentId)

// tokenURI is added later with _setTokenURI()
function register() returns (uint256 agentId)
This emits one Transfer event, one MetadataSet event for each metadata entry, if any, and

event Registered(uint256 indexed agentId, string tokenURI, address indexed owner)
 Reputation Registry
When the Reputation Registry is deployed, the identityRegistry address is passed to the constructor and publicly visible by calling:

function getIdentityRegistry() external view returns (address identityRegistry)
As an agent accepts a task, it’s expected to sign a feedbackAuth to authorize the clientAddress (human or agent) to give feedback. The feedback consists of a score (0-100), tag1 and tag2 (left to developers’ discretion to provide maximum on-chain composability and filtering), a file uri pointing to an off-chain JSON containing additional information, and its KECCAK-256 file hash to guarantee integrity. We suggest using IPFS or equivalent services to make feedback easily indexed by subgraphs or similar technologies. For IPFS uris, the hash is not required.
All fields except the score are OPTIONAL, so the off-chain file is not required and can be omitted.

 Giving Feedback
New feedback can be added by any clientAddress calling:

function giveFeedback(uint256 agentId, uint8 score, bytes32 tag1, bytes32 tag2, string calldata fileuri, bytes32 calldata filehash, bytes memory feedbackAuth) external
The agentId must be a validly registered agent. The score MUST be between 0 and 100. tag1, tag2, and uri are OPTIONAL.

feedbackAuth is a tuple with the structure (agentId, clientAddress, indexLimit, expiry, chainId, identityRegistry, signerAddress) signed using EIP-191 or ERC-1271 (if clientAddress is a smart contract). The signerAddress field identifies the agent owner or operator who signed.
Verification succeeds only if: agentId, clientAddress, chainId and identityRegistry are correct, blocktime < expiry and indexLimit is greater than the last index of feedback received by that client for that agentId. While in most cases indexLimit is simply lastIndex + 1, it can be much higher. This allows agentId to pre-authorize multiple feedback submissions, useful for agent watch tower use cases.

If the procedure succeeds, an event is emitted:

event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint8 score, bytes32 indexed tag1, bytes32 tag2, string fileuri, bytes32 filehash)
The feedback fields, except fileuri and filehash, are stored in the contract storage along with the feedbackIndex (the number of feedback submissions that clientAddress has given to agentId). This exposes reputation signals to any smart contract, enabling on-chain composability.

When the feedback is given by an agent (i.e., the client is an agent), the agent SHOULD use the address set in the on-chain optional walletAddress metadata as the clientAddress, to facilitate reputation aggregation.

 Revoking Feedback
clientAddress can revoke feedback by calling:

function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external
This emits:

event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex)
Appending Responses

Anyone (e.g., the agentId showing a refund, any off-chain data intelligence aggregator tagging feedback as spam) can call:

function appendResponse(uint256 agentId, address clientAddress, uint64 feedbackIndex, string calldata responseUri, bytes32 calldata responseHash) external
Where responseHash is the KECCAK-256 file hash of the responseUri file content to guarantee integrity. This field is OPTIONAL for IPFS URIs.

This emits:

event ResponseAppended(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, address indexed responder, string responseUri)
 Read Functions
function getSummary(uint256 agentId, address[] calldata clientAddresses, bytes32 tag1, bytes32 tag2) external view returns (uint64 count, uint8 averageScore)
//agentId is the only mandatory parameter; others are optional filters.
//Without filtering by clientAddresses, results are subject to Sybil/spam attacks. See Security Considerations for details

function readFeedback(uint256 agentId, address clientAddress, uint64 index) external view returns (uint8 score, bytes32 tag1, bytes32 tag2, bool isRevoked)

function readAllFeedback(uint256 agentId, address[] calldata clientAddresses, bytes32 tag1, bytes32 tag2, bool includeRevoked) external view returns (address[] memory clientAddresses, uint8[] memory scores, bytes32[] memory tag1s, bytes32[] memory tag2s, bool[] memory revokedStatuses)
//agentId is the only mandatory parameter; others are optional filters. Revoked feedback are omitted.

function getResponseCount(uint256 agentId, address clientAddress, uint64 feedbackIndex, address[] responders) external view returns (uint64)
//agentId is the only mandatory parameter; others are optional filters.

function getClients(uint256 agentId) external view returns (address[] memory)

function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64)
We expect reputation systems around reviewers/clientAddresses to emerge. While simple filtering by reviewer (useful to mitigate spam) and by tag are enabled on-chain, more complex reputation aggregation will happen off-chain.

 Off-Chain Feedback File Structure
The OPTIONAL file at the URI could look like:

{
  //MUST FIELDS
  "agentRegistry": "eip155:1:{identityRegistry}",
  "agentId": 22,
  "clientAddress": "eip155:1:{clientAddress}",
  "createdAt": "2025-09-23T12:00:00Z",
  "feedbackAuth": "...",
  "score": 100,

  //MAY FIELDS
  "tag1": "foo",
  "tag2": "bar",
  "skill": "as-defined-by-A2A",
  "context": "as-defined-by-A2A",
  "task": "as-defined-by-A2A",
  "capability": "tools", // As per MCP: "prompts", "resources", "tools" or "completions"
  "name": "Put the name of the MCP tool you liked!", // As per MCP: the name of the prompt, resource or tool
  "proof_of_payment": {
	"fromAddress": "0x00...",
	"toAddress": "0x00...",
	"chainId": "1",
	"txHash": "0x00..." 
   }, // this can be used for x402 proof of payment
 
 // Other fields
  " ... ": { " ... " } // MAY
}
 Validation Registry
This registry enables agents to request verification of their work and allows validator smart contracts to provide responses that can be tracked on-chain. Validator smart contracts could use, for example, stake-secured inference re-execution, zkML verifiers or TEE oracles to validate or reject requests.

When the Validation Registry is deployed, the identityRegistry address is passed to the constructor and is visible by calling getIdentityRegistry(), as described above.

 Validation Request
Agents request validation by calling:

function validationRequest(address validatorAddress, uint256 agentId, string requestUri, bytes32 requestHash) external
This function MUST be called by the owner or operator of agentId. The requestUri points to off-chain data containing all information needed for the validator to validate, including inputs and outputs needed for the verification. The requestHash is a commitment to this data, which is OPTIONAL if requestUri is a content addressable storage uri (e.g. IPFS). All other fields are mandatory.

A ValidationRequest event is emitted:

event ValidationRequest(address indexed validatorAddress, uint256 indexed agentId, string requestUri, bytes32 indexed requestHash)
 Validation Response
Validators respond by calling:

function validationResponse(bytes32 requestHash, uint8 response, string responseUri, bytes32 responseHash, bytes32 tag) external
Only requestHash and response are mandatory; responseUri, responseHash and tag are optional. This function MUST be called by the validatorAddress specified in the original request. The response is a value between 0 and 100, which can be used as binary (0 for failed, 100 for passed) or with intermediate values for validations with a spectrum of outcomes. The optional responseUri points to off-chain evidence or audit of the validation, responseHash is its commitment (in case the resource is not on IPFS), while tag allows for custom categorization or additional data.

validationResponse() can be called multiple times for the same requestHash, enabling use cases like progressive validation states (e.g., “soft finality” and “hard finality” using tag) or updates to validation status.

Upon successful execution, a ValidationResponse event is emitted with all function parameters:

event ValidationResponse(address indexed validatorAddress, uint256 indexed agentId, bytes32 indexed requestHash, uint8 response, string responseUri, bytes32 tag)
The contract stores requestHash, validatorAddress, agentId, response, lastUpdate, and tag in its memory for on-chain querying and composability.

 Read Functions
function getValidationStatus(bytes32 requestHash) external view returns (address validatorAddress, uint256 agentId, uint8 response, bytes32 tag, uint256 lastUpdate)

function getSummary(uint256 agentId, address[] calldata validatorAddresses, bytes32 tag) external view returns (uint64 count, uint8 avgResponse)
//Returns aggregated validation statistics for an agent. agentId is the only mandatory parameter; validatorAddresses and tag are optional filters

function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory requestHashes)

function getValidatorRequests(address validatorAddress) external view returns (bytes32[] memory requestHashes)
Incentives and slashing related to validation are managed by the specific validation protocol and are outside the scope of this registry.

 Rationale
Agent communication protocols: MCP and A2A are popular, and other protocols could emerge. For this reason, this protocol links from the blockchain to a flexible registration file including a list where endpoints can be added at will, combining AI primitives (MCP, A2A) and Web3 primitives such as wallet addresses, DIDs, and ENS names.
Feedback: The protocol combines the leverage of nomenclature already established by A2A (such as tasks and skills) and MCP (such as tools and prompts) with complete flexibility in the feedback signal structure.
Gas Sponsorship: Since clients don’t need to be registered anymore, any application can implement frictionless feedback leveraging EIP-7702.
Indexing: Since feedback data is saved on-chain and we suggest using IPFS for full data, it’s easy to leverage subgraphs to create indexers and improve UX.
Deployment: We expect the registries to be deployed with singletons per chain. Note that an agent registered and receiving feedback on chain A can still operate and transact on other chains. Agents can also be registered on multiple chains if desired.
 Test Cases
This protocol enables:

Crawling all agents starting from a logically centralized endpoint and discover agent information (name, image, services), capabilities, communication endpoints (MCP, A2A, others), ENS names, wallet addresses and which trust models they support (reputation, validation, TEE attestation)
Building agent explorers and marketplaces using any ERC-721 compatible application to browse, transfer, and manage agents
Building reputation systems with on-chain aggregation (average scores for smart contract composability) or sophisticated off-chain analysis. All reputation signals are public good.
Discovering which agents support stake-secured or zkML validation and how to request it through a standardized interface
 Security Considerations
Pre-authorization for feedback only partially mitigates spam, as Sybil attacks are still possible, inflating the reputation of fake agents. The protocol’s contribution is to make signals public and use the same schema. We expect many players to build reputation systems, for example, trusting or giving reputation to reviewers (and therefore filtering by reviewer, as the protocol already enables).
On-chain pointers and hashes cannot be deleted, ensuring audit trail integrity
Validator incentives and slashing are managed by specific validation protocols
While this ERC cryptographically ensures the registration file corresponds to the on-chain agent, it cannot cryptographically guarantee that advertised capabilities are functional and non-malicious. The three trust models (reputation, validation, and TEE attestation) are designed to support this verification need

Agent0 SDK
Agent0 is the SDK for agentic economies. It enables agents to register, advertise their capabilities and how to communicate with them, and give each other feedback and reputation signals. All this using blockchain infrastructure (ERC-8004) and decentralized storage, enabling permissionless discovery without relying on proprietary catalogues or intermediaries.

What Does Agent0 Do?
Agent0 SDK v0.31 enables you to:

Create and manage agent identities - Register your AI agent on-chain with a unique identity, configure presentation fields (name, description, image), set wallet addresses, and manage trust models with x402 support
Advertise agent capabilities - Publish MCP and A2A endpoints, with automated extraction of MCP tools and A2A skills from endpoints
OASF taxonomies - Advertise standardized skills and domains using Open Agentic Schema Framework for better discoverability
Multi-chain agent discovery - Query agents across Ethereum Sepolia, Base Sepolia, and Polygon Amoy with unified API, using chainId:agentId format or default chain
Enable permissionless discovery - Make your agent discoverable by other agents and platforms using rich search by attributes, capabilities, skills, tools, tasks, and x402 support
Build reputation - Give and receive feedback, retrieve feedback history, and search agents by reputation with cryptographic authentication
Public indexing - Subgraph indexing both on-chain and IPFS data for fast search and retrieval
Alpha
Agent0 SDK v0.31 is in alpha with bugs and is not production ready. We’re actively testing and improving it.

Bug reports & feedback: Telegram: @marcoderossi | Email: marco.derossi@consensys.net | GitHub: Python | TypeScript

🚀 Coming Soon
More chains (currently Ethereum Sepolia, Base Sepolia, Polygon Amoy)
Enhanced OASF taxonomy support
Enhanced x402 payments
Semantic/Vectorial search
Advanced reputation aggregation
Import/Export to centralized catalogues
Use Cases
Building agent marketplaces - Create platforms where developers can discover, evaluate, and integrate agents based on their capabilities and reputation
Agent interoperability - Discover agents by specific capabilities (skills, tools, tasks), evaluate them through reputation signals, and integrate them via standard protocols (MCP/A2A)
Managing agent reputation - Track agent performance, collect feedback from users and other agents, and build trust signals for your agent ecosystem (reputation aggregators, watch towers)
Cross-chain agent operations - Deploy and manage agents across multiple blockchain networks with consistent identity and reputation

agent0 Project Path: src

Source Tree:

```
src
├── core
│   ├── subgraph-client.ts
│   ├── ipfs-client.ts
│   ├── contracts.ts
│   ├── web3-client.ts
│   ├── indexer.ts
│   ├── agent.ts
│   ├── endpoint-crawler.ts
│   ├── feedback-manager.ts
│   ├── oasf-validator.ts
│   └── sdk.ts
├── utils
│   ├── validation.ts
│   ├── id-format.ts
│   ├── constants.ts
│   └── index.ts
├── models
│   ├── types.ts
│   ├── index.ts
│   ├── enums.ts
│   └── interfaces.ts
├── index.ts
└── taxonomies
    ├── all_domains.json
    └── all_skills.json

```

`/Users/shawwalters/babylon/agent0-ts/src/core/subgraph-client.ts`:

```ts
/**
 * Subgraph client for querying The Graph network
 */

import { GraphQLClient } from 'graphql-request';
import type { AgentSummary, SearchParams } from '../models/interfaces.js';
import { normalizeAddress } from '../utils/validation.js';
import type { Agent, AgentRegistrationFile } from '../models/generated/subgraph-types.js';

export interface SubgraphQueryOptions {
  where?: Record<string, unknown>;
  first?: number;
  skip?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  includeRegistrationFile?: boolean;
}

// Type representing the agent data returned from our queries
// Note: Queries return partial Agent objects (not all fields are queried)
export type QueryAgent = Pick<Agent, 'id' | 'chainId' | 'agentId' | 'owner' | 'operators' | 'agentURI' | 'createdAt' | 'updatedAt'> & {
  registrationFile?: AgentRegistrationFile | null;
};

/**
 * Client for querying the subgraph GraphQL API
 */
export class SubgraphClient {
  private client: GraphQLClient;

  constructor(subgraphUrl: string) {
    this.client = new GraphQLClient(subgraphUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Execute a GraphQL query against the subgraph
   */
  async query<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    try {
      const data = await this.client.request<T>(query, variables || {});
      return data;
    } catch (error) {
      throw new Error(`Failed to query subgraph: ${error}`);
    }
  }

  /**
   * Query agents from the subgraph
   */
  async getAgents(options: SubgraphQueryOptions = {}): Promise<AgentSummary[]> {
    const {
      where = {},
      first = 100,
      skip = 0,
      orderBy = 'createdAt',
      orderDirection = 'desc',
      includeRegistrationFile = true,
    } = options;

    // Support Agent-level filters and nested registrationFile filters
    const supportedWhere: Record<string, unknown> = {};
    if (where.agentId) supportedWhere.agentId = where.agentId;
    if (where.owner) supportedWhere.owner = where.owner;
    if (where.owner_in) supportedWhere.owner_in = where.owner_in;
    if (where.operators_contains) supportedWhere.operators_contains = where.operators_contains;
    if (where.agentURI) supportedWhere.agentURI = where.agentURI;
    if (where.registrationFile_not !== undefined) supportedWhere.registrationFile_not = where.registrationFile_not;

    // Support nested registrationFile filters (pushed to subgraph level)
    // Note: Python SDK uses "registrationFile_" (with underscore) for nested filters
    if (where.registrationFile) {
      supportedWhere.registrationFile_ = where.registrationFile;
    }
    if (where.registrationFile_) {
      supportedWhere.registrationFile_ = where.registrationFile_;
    }

    // Build WHERE clause with support for nested filters
    let whereClause = '';
    if (Object.keys(supportedWhere).length > 0) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(supportedWhere)) {
        if ((key === 'registrationFile' || key === 'registrationFile_') && typeof value === 'object') {
          // Handle nested registrationFile filters
          // Python SDK uses "registrationFile_" (with underscore) for nested filters in GraphQL
          const nestedConditions: string[] = [];
          for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
            if (typeof nestedValue === 'boolean') {
              nestedConditions.push(`${nestedKey}: ${nestedValue.toString().toLowerCase()}`);
            } else if (typeof nestedValue === 'string') {
              nestedConditions.push(`${nestedKey}: "${nestedValue}"`);
            } else if (nestedValue === null) {
              if (nestedKey.endsWith('_not')) {
                nestedConditions.push(`${nestedKey}: null`);
              } else {
                nestedConditions.push(`${nestedKey}_not: null`);
              }
            }
          }
          if (nestedConditions.length > 0) {
            conditions.push(`registrationFile_: { ${nestedConditions.join(', ')} }`);
          }
        } else if (typeof value === 'boolean') {
          conditions.push(`${key}: ${value.toString().toLowerCase()}`);
        } else if (typeof value === 'string') {
          conditions.push(`${key}: "${value}"`);
        } else if (typeof value === 'number') {
          conditions.push(`${key}: ${value}`);
        } else if (Array.isArray(value)) {
          conditions.push(`${key}: ${JSON.stringify(value)}`);
        } else if (value === null) {
          // Don't add _not if the key already ends with _not (e.g., registrationFile_not)
          const filterKey = key.endsWith('_not') ? key : `${key}_not`;
          conditions.push(`${filterKey}: null`);
        }
      }
      if (conditions.length > 0) {
        whereClause = `where: { ${conditions.join(', ')} }`;
      }
    }

    // Build registration file fragment
    const regFileFragment = includeRegistrationFile
      ? `
          registrationFile {
            id
            agentId
            name
            description
            image
            active
            x402support
            supportedTrusts
            mcpEndpoint
            mcpVersion
            a2aEndpoint
            a2aVersion
            ens
            did
            agentWallet
            agentWalletChainId
            mcpTools
            mcpPrompts
            mcpResources
            a2aSkills
          }
    `
      : '';

    const query = `
      query GetAgents($first: Int!, $skip: Int!, $orderBy: Agent_orderBy!, $orderDirection: OrderDirection!) {
        agents(
          ${whereClause}
          first: $first
          skip: $skip
          orderBy: $orderBy
          orderDirection: $orderDirection
        ) {
          id
          chainId
          agentId
          owner
          operators
          agentURI
          createdAt
          updatedAt
          ${regFileFragment}
        }
      }
    `;

    // GraphQL enum expects lowercase
    const variables = {
      first,
      skip,
      orderBy,
      orderDirection: orderDirection.toLowerCase() as 'asc' | 'desc',
    };

    try {
      const data = await this.query<{ agents: QueryAgent[] }>(query, variables);
      return (data.agents || []).map((agent) => this._transformAgent(agent)) as AgentSummary[];
    } catch (error) {
      throw new Error(`Failed to get agents from subgraph: ${error}`);
    }
  }

  /**
   * Get a single agent by ID
   */
  async getAgentById(agentId: string): Promise<AgentSummary | null> {
    const query = `
      query GetAgent($agentId: String!) {
        agent(id: $agentId) {
          id
          chainId
          agentId
          owner
          operators
          agentURI
          createdAt
          updatedAt
          registrationFile {
            id
            agentId
            name
            description
            image
            active
            x402support
            supportedTrusts
            mcpEndpoint
            mcpVersion
            a2aEndpoint
            a2aVersion
            ens
            did
            agentWallet
            agentWalletChainId
            mcpTools
            mcpPrompts
            mcpResources
            a2aSkills
          }
        }
      }
    `;

    try {
      const data = await this.query<{ agent: QueryAgent | null }>(query, { agentId });
      if (!data.agent) {
        return null;
      }
      return this._transformAgent(data.agent) as AgentSummary;
    } catch (error) {
      throw new Error(`Failed to get agent from subgraph: ${error}`);
    }
  }

  /**
   * Transform raw subgraph agent data to AgentSummary
   */
  private _transformAgent(agent: QueryAgent): Partial<AgentSummary> {
    // Fields from Agent entity
    const chainId = parseInt(agent.chainId?.toString() || '0', 10);
    const agentIdStr = agent.id || `${chainId}:${agent.agentId?.toString() || '0'}`;
    
    // Fields from AgentRegistrationFile (registrationFile)
    const regFile = agent.registrationFile;
    
    // Transform operators from Bytes array to Address array
    const operators = (agent.operators || []).map((op: string) => 
      typeof op === 'string' ? normalizeAddress(op) : op
    );
    
    return {
      chainId,
      agentId: agentIdStr,
      name: regFile?.name || '',
      image: regFile?.image || undefined,
      description: regFile?.description || '',
      owners: agent.owner ? [normalizeAddress(agent.owner)] : [],
      operators,
      mcp: !!regFile?.mcpEndpoint,
      a2a: !!regFile?.a2aEndpoint,
      ens: regFile?.ens || undefined,
      did: regFile?.did || undefined,
      walletAddress: regFile?.agentWallet ? normalizeAddress(regFile.agentWallet) : undefined,
      supportedTrusts: regFile?.supportedTrusts || [],
      a2aSkills: regFile?.a2aSkills || [],
      mcpTools: regFile?.mcpTools || [],
      mcpPrompts: regFile?.mcpPrompts || [],
      mcpResources: regFile?.mcpResources || [],
      active: regFile?.active ?? false,
      x402support: regFile?.x402support ?? false,
      extras: {},
    };
  }

  /**
   * Search agents with filters (delegates to getAgents with WHERE clause)
   * @param params Search parameters
   * @param first Maximum number of results to return (default: 100)
   * @param skip Number of results to skip for pagination (default: 0)
   */
  async searchAgents(
    params: SearchParams,
    first: number = 100,
    skip: number = 0
  ): Promise<AgentSummary[]> {
    const where: Record<string, unknown> = {
      registrationFile_not: null  // Only get agents with registration files
    };

    // Note: Most search fields are in registrationFile, so we need to filter after fetching
    // For now, we'll do basic filtering on Agent fields and then filter on registrationFile fields
    if (params.active !== undefined || params.mcp !== undefined || params.a2a !== undefined ||
        params.x402support !== undefined || params.ens || params.walletAddress ||
        params.supportedTrust || params.a2aSkills || params.mcpTools || params.name ||
        params.owners || params.operators) {
      // Push basic filters to subgraph using nested registrationFile filters
      const registrationFileFilters: Record<string, unknown> = {};
      if (params.active !== undefined) registrationFileFilters.active = params.active;
      if (params.x402support !== undefined) registrationFileFilters.x402support = params.x402support;
      if (params.ens) registrationFileFilters.ens = params.ens.toLowerCase();
      if (params.walletAddress) registrationFileFilters.agentWallet = params.walletAddress.toLowerCase();
      if (params.mcp !== undefined) {
        registrationFileFilters[params.mcp ? 'mcpEndpoint_not' : 'mcpEndpoint'] = null;
      }
      if (params.a2a !== undefined) {
        registrationFileFilters[params.a2a ? 'a2aEndpoint_not' : 'a2aEndpoint'] = null;
      }

      const whereWithFilters: Record<string, unknown> = {};
      if (Object.keys(registrationFileFilters).length > 0) {
        // Python SDK uses "registrationFile_" (with underscore) for nested filters
        whereWithFilters.registrationFile_ = registrationFileFilters;
      }

      // Owner filtering (at Agent level, not registrationFile)
      if (params.owners && params.owners.length > 0) {
        // Normalize addresses to lowercase for case-insensitive matching
        const normalizedOwners = params.owners.map(owner => owner.toLowerCase());
        if (normalizedOwners.length === 1) {
          whereWithFilters.owner = normalizedOwners[0];
        } else {
          whereWithFilters.owner_in = normalizedOwners;
        }
      }

      // Operator filtering (at Agent level, not registrationFile)
      if (params.operators && params.operators.length > 0) {
        // Normalize addresses to lowercase for case-insensitive matching
        const normalizedOperators = params.operators.map(op => op.toLowerCase());
        // For operators (array field), use contains to check if any operator matches
        whereWithFilters.operators_contains = normalizedOperators;
      }

      // Fetch records with filters and pagination applied at subgraph level
      const allAgents = await this.getAgents({ where: whereWithFilters, first, skip });

      // Only filter client-side for fields that can't be filtered at subgraph level
      // Fields already filtered at subgraph level: active, x402support, mcp, a2a, ens, walletAddress, owners, operators
      return allAgents.filter((agent) => {
        // Name filtering (substring search - not supported at subgraph level)
        if (params.name && !agent.name.toLowerCase().includes(params.name.toLowerCase())) {
          return false;
        }
        // Array contains filtering (supportedTrust, a2aSkills, mcpTools) - these require array contains logic
        if (params.supportedTrust && params.supportedTrust.length > 0) {
          const hasAllTrusts = params.supportedTrust.every(trust =>
            agent.supportedTrusts.includes(trust)
          );
          if (!hasAllTrusts) return false;
        }
        if (params.a2aSkills && params.a2aSkills.length > 0) {
          const hasAllSkills = params.a2aSkills.every(skill =>
            agent.a2aSkills.includes(skill)
          );
          if (!hasAllSkills) return false;
        }
        if (params.mcpTools && params.mcpTools.length > 0) {
          const hasAllTools = params.mcpTools.every(tool =>
            agent.mcpTools.includes(tool)
          );
          if (!hasAllTools) return false;
        }
        return true;
      });
    }

    return this.getAgents({ where, first, skip });
  }

  /**
   * Search feedback with filters
   */
  async searchFeedback(
    params: {
      agents?: string[];
      reviewers?: string[];
      tags?: string[];
      capabilities?: string[];
      skills?: string[];
      tasks?: string[];
      names?: string[];
      minScore?: number;
      maxScore?: number;
      includeRevoked?: boolean;
    },
    first: number = 100,
    skip: number = 0,
    orderBy: string = 'createdAt',
    orderDirection: 'asc' | 'desc' = 'desc'
  ): Promise<any[]> {
    // Build WHERE clause from params
    const whereConditions: string[] = [];

    if (params.agents && params.agents.length > 0) {
      const agentIds = params.agents.map((aid) => `"${aid}"`).join(', ');
      whereConditions.push(`agent_in: [${agentIds}]`);
    }

    if (params.reviewers && params.reviewers.length > 0) {
      const reviewers = params.reviewers.map((addr) => `"${addr}"`).join(', ');
      whereConditions.push(`clientAddress_in: [${reviewers}]`);
    }

    if (!params.includeRevoked) {
      whereConditions.push('isRevoked: false');
    }

    // Build all non-tag conditions first
    const nonTagConditions = [...whereConditions];

    // Handle tag filtering separately - it needs to be at the top level
    let tagFilterCondition: string | null = null;
    if (params.tags && params.tags.length > 0) {
      // Tag search: any of the tags must match in tag1 OR tag2
      // Build complete condition with all filters for each tag alternative
      const tagWhereItems: string[] = [];
      for (const tag of params.tags) {
        // For tag1 match
        const allConditionsTag1 = [...nonTagConditions, `tag1: "${tag}"`];
        tagWhereItems.push(`{ ${allConditionsTag1.join(', ')} }`);
        // For tag2 match
        const allConditionsTag2 = [...nonTagConditions, `tag2: "${tag}"`];
        tagWhereItems.push(`{ ${allConditionsTag2.join(', ')} }`);
      }
      // Join all tag alternatives
      tagFilterCondition = tagWhereItems.join(', ');
    }

    if (params.minScore !== undefined) {
      whereConditions.push(`score_gte: ${params.minScore}`);
    }

    if (params.maxScore !== undefined) {
      whereConditions.push(`score_lte: ${params.maxScore}`);
    }

    // Feedback file filters
    const feedbackFileFilters: string[] = [];

    if (params.capabilities && params.capabilities.length > 0) {
      const capabilities = params.capabilities.map((cap) => `"${cap}"`).join(', ');
      feedbackFileFilters.push(`capability_in: [${capabilities}]`);
    }

    if (params.skills && params.skills.length > 0) {
      const skills = params.skills.map((skill) => `"${skill}"`).join(', ');
      feedbackFileFilters.push(`skill_in: [${skills}]`);
    }

    if (params.tasks && params.tasks.length > 0) {
      const tasks = params.tasks.map((task) => `"${task}"`).join(', ');
      feedbackFileFilters.push(`task_in: [${tasks}]`);
    }

    if (params.names && params.names.length > 0) {
      const names = params.names.map((name) => `"${name}"`).join(', ');
      feedbackFileFilters.push(`name_in: [${names}]`);
    }

    if (feedbackFileFilters.length > 0) {
      whereConditions.push(`feedbackFile_: { ${feedbackFileFilters.join(', ')} }`);
    }

    // Use tag_filter_condition if tags were provided, otherwise use standard where clause
    let whereClause = '';
    if (tagFilterCondition) {
      // tagFilterCondition already contains properly formatted items
      whereClause = `where: { or: [${tagFilterCondition}] }`;
    } else if (whereConditions.length > 0) {
      whereClause = `where: { ${whereConditions.join(', ')} }`;
    }

    const query = `
      {
        feedbacks(
          ${whereClause}
          first: ${first}
          skip: ${skip}
          orderBy: ${orderBy}
          orderDirection: ${orderDirection}
        ) {
          id
          agent { id agentId chainId }
          clientAddress
          score
          tag1
          tag2
          feedbackUri
          feedbackURIType
          feedbackHash
          isRevoked
          createdAt
          revokedAt
          feedbackFile {
            id
            feedbackId
            text
            capability
            name
            skill
            task
            context
            proofOfPaymentFromAddress
            proofOfPaymentToAddress
            proofOfPaymentChainId
            proofOfPaymentTxHash
            tag1
            tag2
            createdAt
          }
          responses {
            id
            responder
            responseUri
            responseHash
            createdAt
          }
        }
      }
    `;

    const result = await this.query<{ feedbacks: any[] }>(query);
    return result.feedbacks || [];
  }

  /**
   * Search agents filtered by reputation criteria
   */
  async searchAgentsByReputation(
    agents?: string[],
    tags?: string[],
    reviewers?: string[],
    capabilities?: string[],
    skills?: string[],
    tasks?: string[],
    names?: string[],
    minAverageScore?: number,
    includeRevoked: boolean = false,
    first: number = 100,
    skip: number = 0,
    orderBy: string = 'createdAt',
    orderDirection: 'asc' | 'desc' = 'desc'
  ): Promise<Array<QueryAgent & { averageScore?: number | null }>> {
    // Build feedback filters
    const feedbackFilters: string[] = [];

    if (!includeRevoked) {
      feedbackFilters.push('isRevoked: false');
    }

    if (tags && tags.length > 0) {
      const tagFilterItems: string[] = [];
      for (const tag of tags) {
        tagFilterItems.push(`{or: [{tag1: "${tag}"}, {tag2: "${tag}"}]}`);
      }
      feedbackFilters.push(`or: [${tagFilterItems.join(', ')}]`);
    }

    if (reviewers && reviewers.length > 0) {
      const reviewersList = reviewers.map((addr) => `"${addr}"`).join(', ');
      feedbackFilters.push(`clientAddress_in: [${reviewersList}]`);
    }

    // Feedback file filters
    const feedbackFileFilters: string[] = [];

    if (capabilities && capabilities.length > 0) {
      const capabilitiesList = capabilities.map((cap) => `"${cap}"`).join(', ');
      feedbackFileFilters.push(`capability_in: [${capabilitiesList}]`);
    }

    if (skills && skills.length > 0) {
      const skillsList = skills.map((skill) => `"${skill}"`).join(', ');
      feedbackFileFilters.push(`skill_in: [${skillsList}]`);
    }

    if (tasks && tasks.length > 0) {
      const tasksList = tasks.map((task) => `"${task}"`).join(', ');
      feedbackFileFilters.push(`task_in: [${tasksList}]`);
    }

    if (names && names.length > 0) {
      const namesList = names.map((name) => `"${name}"`).join(', ');
      feedbackFileFilters.push(`name_in: [${namesList}]`);
    }

    if (feedbackFileFilters.length > 0) {
      feedbackFilters.push(`feedbackFile_: { ${feedbackFileFilters.join(', ')} }`);
    }

    // If we have feedback filters, first query feedback to get agent IDs
    let agentWhere = '';
    if (tags || capabilities || skills || tasks || names || reviewers) {
      const feedbackWhere = feedbackFilters.length > 0 
        ? `{ ${feedbackFilters.join(', ')} }`
        : '{}';

      const feedbackQuery = `
        {
          feedbacks(
            where: ${feedbackWhere}
            first: 1000
            skip: 0
          ) {
            agent {
              id
            }
          }
        }
      `;

      try {
        const feedbackResult = await this.query<{ feedbacks: Array<{ agent: { id: string } | null }> }>(feedbackQuery);
        const feedbacksData = feedbackResult.feedbacks || [];

        // Extract unique agent IDs
        const agentIdsSet = new Set<string>();
        for (const fb of feedbacksData) {
          const agentId = fb.agent?.id;
          if (agentId) {
            agentIdsSet.add(agentId);
          }
        }

        if (agentIdsSet.size === 0) {
          // No agents have matching feedback
          return [];
        }

        // Apply agent filter if specified
        let agentIdsList = Array.from(agentIdsSet);
        if (agents && agents.length > 0) {
          agentIdsList = agentIdsList.filter((aid) => agents.includes(aid));
          if (agentIdsList.length === 0) {
            return [];
          }
        }

        const agentIdsStr = agentIdsList.map((aid) => `"${aid}"`).join(', ');
        agentWhere = `where: { id_in: [${agentIdsStr}] }`;
      } catch (error) {
        // If feedback query fails, return empty
        return [];
      }
    } else {
      // No feedback filters - query agents directly
      const agentFilters: string[] = [];
      if (agents && agents.length > 0) {
        const agentIds = agents.map((aid) => `"${aid}"`).join(', ');
        agentFilters.push(`id_in: [${agentIds}]`);
      }

      if (agentFilters.length > 0) {
        agentWhere = `where: { ${agentFilters.join(', ')} }`;
      }
    }

    // Build feedback where for agent query (to calculate scores)
    const feedbackWhereForAgents = feedbackFilters.length > 0
      ? `{ ${feedbackFilters.join(', ')} }`
      : '{}';

    const query = `
      {
        agents(
          ${agentWhere}
          first: ${first}
          skip: ${skip}
          orderBy: ${orderBy}
          orderDirection: ${orderDirection}
        ) {
          id
          chainId
          agentId
          agentURI
          agentURIType
          owner
          operators
          createdAt
          updatedAt
          totalFeedback
          lastActivity
          registrationFile {
            id
            name
            description
            image
            active
            x402support
            supportedTrusts
            mcpEndpoint
            mcpVersion
            a2aEndpoint
            a2aVersion
            ens
            did
            agentWallet
            agentWalletChainId
            mcpTools
            mcpPrompts
            mcpResources
            a2aSkills
            createdAt
          }
          feedback(where: ${feedbackWhereForAgents}) {
            score
            isRevoked
            feedbackFile {
              capability
              skill
              task
              name
            }
          }
        }
      }
    `;

    try {
      const result = await this.query<{ agents: Array<QueryAgent & { feedback: Array<{ score: number; isRevoked: boolean }> }> }>(query);
      const agentsResult = result.agents || [];

      // Calculate average scores
      const agentsWithScores = agentsResult.map((agent) => {
        const feedbacks = agent.feedback || [];
        let averageScore: number | null = null;
        
        if (feedbacks.length > 0) {
          const scores = feedbacks
            .filter((fb) => fb.score > 0)
            .map((fb) => fb.score);
          
          if (scores.length > 0) {
            averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
          }
        }

        // Remove feedback array from result (not part of QueryAgent)
        const { feedback, ...agentData } = agent;
        return {
          ...agentData,
          averageScore,
        };
      });

      // Filter by minAverageScore
      let filteredAgents = agentsWithScores;
      if (minAverageScore !== undefined) {
        filteredAgents = agentsWithScores.filter(
          (agent) => agent.averageScore !== null && agent.averageScore >= minAverageScore
        );
      }

      return filteredAgents;
    } catch (error) {
      throw new Error(`Subgraph reputation search failed: ${error}`);
    }
  }
}


```

`/Users/shawwalters/babylon/agent0-ts/src/core/ipfs-client.ts`:

```ts
/**
 * IPFS client for decentralized storage with support for multiple providers:
 * - Local IPFS nodes (via ipfs-http-client)
 * - Pinata IPFS pinning service
 * - Filecoin Pin service
 */

import type { IPFSHTTPClient } from 'ipfs-http-client';
import type { RegistrationFile } from '../models/interfaces.js';
import { IPFS_GATEWAYS, TIMEOUTS } from '../utils/constants.js';

export interface IPFSClientConfig {
  url?: string; // IPFS node URL (e.g., "http://localhost:5001")
  filecoinPinEnabled?: boolean;
  filecoinPrivateKey?: string;
  pinataEnabled?: boolean;
  pinataJwt?: string;
}

/**
 * Client for IPFS operations supporting multiple providers
 */
export class IPFSClient {
  private provider: 'pinata' | 'filecoinPin' | 'node';
  private config: IPFSClientConfig;
  private client?: IPFSHTTPClient;

  constructor(config: IPFSClientConfig) {
    this.config = config;

    // Determine provider
    if (config.pinataEnabled) {
      this.provider = 'pinata';
      this._verifyPinataJwt();
    } else if (config.filecoinPinEnabled) {
      this.provider = 'filecoinPin';
      // Note: Filecoin Pin in TypeScript requires external CLI or API
      // We'll use HTTP API if available, otherwise throw error
    } else if (config.url) {
      this.provider = 'node';
      // Lazy initialization - client will be created on first use
    } else {
      throw new Error('No IPFS provider configured. Specify url, pinataEnabled, or filecoinPinEnabled.');
    }
  }

  /**
   * Initialize IPFS HTTP client (lazy, only when needed)
   */
  private async _ensureClient(): Promise<void> {
    if (this.provider === 'node' && !this.client && this.config.url) {
      const { create } = await import('ipfs-http-client');
      this.client = create({ url: this.config.url });
    }
  }

  private _verifyPinataJwt(): void {
    if (!this.config.pinataJwt) {
      throw new Error('pinataJwt is required when pinataEnabled=true');
    }
  }

  /**
   * Pin data to Pinata using v3 API
   */
  private async _pinToPinata(data: string): Promise<string> {
    const url = 'https://uploads.pinata.cloud/v3/files';
    const headers = {
      Authorization: `Bearer ${this.config.pinataJwt}`,
    };

    // Create a Blob from the data
    const blob = new Blob([data], { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', blob, 'registration.json');
    formData.append('network', 'public');

    try {
      // Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.PINATA_UPLOAD);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to pin to Pinata: HTTP ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // v3 API returns CID in data.cid
      const cid = result?.data?.cid || result?.cid || result?.IpfsHash;
      if (!cid) {
        throw new Error(`No CID returned from Pinata. Response: ${JSON.stringify(result)}`);
      }

      // Verify CID is accessible on Pinata gateway (with short timeout since we just uploaded)
      // This catches cases where Pinata returns a CID but the upload actually failed
      // Note: We treat HTTP 429 (rate limit) and timeouts as non-fatal since content may propagate with delay
      try {
        const verifyUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
        const verifyResponse = await fetch(verifyUrl, {
          signal: AbortSignal.timeout(5000), // 5 second timeout for verification
        });
        if (!verifyResponse.ok) {
          // HTTP 429 (rate limit) is not a failure - gateway is just rate limiting
          if (verifyResponse.status === 429) {
            console.warn(
              `[IPFS] Pinata returned CID ${cid} but gateway is rate-limited (HTTP 429). ` +
              `Content is likely available but verification skipped due to rate limiting.`
            );
          } else {
            // Other HTTP errors might indicate a real problem
            throw new Error(
              `Pinata returned CID ${cid} but content is not accessible on gateway (HTTP ${verifyResponse.status}). ` +
              `This may indicate the upload failed. Full Pinata response: ${JSON.stringify(result)}`
            );
          }
        }
      } catch (verifyError) {
        // If verification fails, check if it's a timeout or rate limit (non-fatal)
        if (verifyError instanceof Error) {
          // Timeout or network errors are non-fatal - content may propagate with delay
          if (verifyError.message.includes('timeout') || verifyError.message.includes('aborted')) {
            console.warn(
              `[IPFS] Pinata returned CID ${cid} but verification timed out. ` +
              `Content may propagate with delay. Full Pinata response: ${JSON.stringify(result)}`
            );
          } else if (verifyError.message.includes('429')) {
            // Rate limit is non-fatal
            console.warn(
              `[IPFS] Pinata returned CID ${cid} but gateway is rate-limited. ` +
              `Content is likely available but verification skipped.`
            );
          } else {
            // Other errors might indicate a real problem, but we'll still continue
            // since Pinata API returned success - content might just need time to propagate
            console.warn(
              `[IPFS] Pinata returned CID ${cid} but verification failed: ${verifyError.message}. ` +
              `Content may propagate with delay. Full Pinata response: ${JSON.stringify(result)}`
            );
          }
        }
      }

      return cid;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Pinata upload timed out after ${TIMEOUTS.PINATA_UPLOAD / 1000} seconds`);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to pin to Pinata: ${errorMessage}`);
    }
  }

  /**
   * Pin data to Filecoin Pin
   * Note: This requires the Filecoin Pin API or CLI to be available
   * For now, we'll throw an error directing users to use the CLI
   */
  private async _pinToFilecoin(data: string): Promise<string> {
    // Filecoin Pin typically requires CLI or API access
    // This is a placeholder - in production, you'd call the Filecoin Pin API
    throw new Error(
      'Filecoin Pin via TypeScript SDK not yet fully implemented. ' +
        'Please use the filecoin-pin CLI or implement the Filecoin Pin API integration.'
    );
  }

  /**
   * Pin data to local IPFS node
   */
  private async _pinToLocalIpfs(data: string): Promise<string> {
    await this._ensureClient();
    if (!this.client) {
      throw new Error('No IPFS client available');
    }

    const result = await this.client.add(data);
    return result.cid.toString();
  }

  /**
   * Add data to IPFS and return CID
   */
  async add(data: string): Promise<string> {
    try {
      if (this.provider === 'pinata') {
        return await this._pinToPinata(data);
      } else if (this.provider === 'filecoinPin') {
        return await this._pinToFilecoin(data);
      } else {
        return await this._pinToLocalIpfs(data);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add file to IPFS and return CID
   * Note: This method works in Node.js environments. For browser, use add() with file content directly.
   */
  async addFile(filepath: string): Promise<string> {
    // Check if we're in Node.js environment
    if (typeof process === 'undefined' || !process.versions?.node) {
      throw new Error(
        'addFile() is only available in Node.js environments. ' +
          'For browser environments, use add() with file content directly.'
      );
    }

    const fs = await import('fs');
    const data = fs.readFileSync(filepath, 'utf-8');

    if (this.provider === 'pinata') {
      return this._pinToPinata(data);
    } else if (this.provider === 'filecoinPin') {
      return this._pinToFilecoin(filepath);
    } else {
      await this._ensureClient();
      if (!this.client) {
        throw new Error('No IPFS client available');
      }
      // For local IPFS, add file directly
      const fileContent = fs.readFileSync(filepath);
      const result = await this.client.add(fileContent);
      return result.cid.toString();
    }
  }

  /**
   * Get data from IPFS by CID
   */
  async get(cid: string): Promise<string> {
    // Extract CID from IPFS URL if needed
    if (cid.startsWith('ipfs://')) {
      cid = cid.slice(7); // Remove "ipfs://" prefix
    }

    // For Pinata and Filecoin Pin, use IPFS gateways
    if (this.provider === 'pinata' || this.provider === 'filecoinPin') {
      const gateways = IPFS_GATEWAYS.map(gateway => `${gateway}${cid}`);

      // Try all gateways in parallel - use the first successful response
      const promises = gateways.map(async (gateway) => {
        try {
          const response = await fetch(gateway, {
            signal: AbortSignal.timeout(TIMEOUTS.IPFS_GATEWAY),
          });
          if (response.ok) {
            return await response.text();
          }
          throw new Error(`HTTP ${response.status}`);
        } catch (error) {
          throw error;
        }
      });

      // Use Promise.allSettled to get the first successful result
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled') {
          return result.value;
        }
      }

      throw new Error('Failed to retrieve data from all IPFS gateways');
    } else {
      await this._ensureClient();
      if (!this.client) {
        throw new Error('No IPFS client available');
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of this.client.cat(cid)) {
        chunks.push(chunk);
      }

      // Concatenate chunks and convert to string
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return new TextDecoder().decode(result);
    }
  }

  /**
   * Get JSON data from IPFS by CID
   */
  async getJson<T = Record<string, unknown>>(cid: string): Promise<T> {
    const data = await this.get(cid);
    return JSON.parse(data) as T;
  }

  /**
   * Pin a CID to local node
   */
  async pin(cid: string): Promise<{ pinned: string[] }> {
    if (this.provider === 'filecoinPin') {
      // Filecoin Pin automatically pins data, so this is a no-op
      return { pinned: [cid] };
    } else {
      await this._ensureClient();
      if (!this.client) {
        throw new Error('No IPFS client available');
      }
      await this.client.pin.add(cid);
      return { pinned: [cid] };
    }
  }

  /**
   * Unpin a CID from local node
   */
  async unpin(cid: string): Promise<{ unpinned: string[] }> {
    if (this.provider === 'filecoinPin') {
      // Filecoin Pin doesn't support unpinning in the same way
      return { unpinned: [cid] };
    } else {
      await this._ensureClient();
      if (!this.client) {
        throw new Error('No IPFS client available');
      }
      await this.client.pin.rm(cid);
      return { unpinned: [cid] };
    }
  }

  /**
   * Add JSON data to IPFS and return CID
   */
  async addJson(data: Record<string, unknown>): Promise<string> {
    const jsonStr = JSON.stringify(data, null, 2);
    return this.add(jsonStr);
  }

  /**
   * Add registration file to IPFS and return CID
   */
  async addRegistrationFile(
    registrationFile: RegistrationFile,
    chainId?: number,
    identityRegistryAddress?: string
  ): Promise<string> {
    // Convert from internal format { type, value, meta } to ERC-8004 format { name, endpoint, version }
    const endpoints: Array<Record<string, unknown>> = [];
    for (const ep of registrationFile.endpoints) {
      const endpointDict: Record<string, unknown> = {
        name: ep.type, // EndpointType enum value (e.g., "MCP", "A2A")
        endpoint: ep.value,
      };
      
      // Spread meta fields (version, mcpTools, mcpPrompts, etc.) into the endpoint dict
      if (ep.meta) {
        Object.assign(endpointDict, ep.meta);
      }
      
      endpoints.push(endpointDict);
    }
    
    // Add walletAddress as an endpoint if present
    if (registrationFile.walletAddress) {
      const walletChainId = registrationFile.walletChainId || chainId || 1;
      endpoints.push({
        name: 'agentWallet',
        endpoint: `eip155:${walletChainId}:${registrationFile.walletAddress}`,
      });
    }
    
    // Build registrations array
    const registrations: Array<Record<string, unknown>> = [];
    if (registrationFile.agentId) {
      const [, , tokenId] = registrationFile.agentId.split(':');
      const agentRegistry = chainId && identityRegistryAddress
        ? `eip155:${chainId}:${identityRegistryAddress}`
        : `eip155:1:{identityRegistry}`;
      registrations.push({
        agentId: parseInt(tokenId, 10),
        agentRegistry,
      });
    }
    
    // Build ERC-8004 compliant registration file
    const data = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: registrationFile.name,
      description: registrationFile.description,
      ...(registrationFile.image && { image: registrationFile.image }),
      endpoints,
      ...(registrations.length > 0 && { registrations }),
      ...(registrationFile.trustModels.length > 0 && {
        supportedTrusts: registrationFile.trustModels,
      }),
      active: registrationFile.active,
      x402support: registrationFile.x402support,
    };
    
    return this.addJson(data);
  }

  /**
   * Get registration file from IPFS by CID
   */
  async getRegistrationFile(cid: string): Promise<RegistrationFile> {
    const data = await this.getJson<RegistrationFile>(cid);
    return data;
  }

  /**
   * Close IPFS client connection
   */
  async close(): Promise<void> {
    if (this.client) {
      // IPFS HTTP client doesn't have a close method in the same way
      // But we can clear the reference
      this.client = undefined;
    }
  }
}


```

`/Users/shawwalters/babylon/agent0-ts/src/core/contracts.ts`:

```ts
/**
 * Smart contract ABIs and interfaces for ERC-8004
 */

import type { ChainId } from '../models/types.js';

// ERC-721 ABI (minimal required functions)
export const ERC721_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'operator', type: 'address' },
    ],
    name: 'isApprovedForAll',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'getApproved',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'bool', name: 'approved', type: 'bool' },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'address', name: 'to', type: 'address' },
    ],
    name: 'approve',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ERC-721 URI Storage ABI
export const ERC721_URI_STORAGE_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'string', name: '_tokenURI', type: 'string' },
    ],
    name: 'setTokenURI',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Identity Registry ABI
export const IDENTITY_REGISTRY_ABI = [
  ...ERC721_ABI,
  ...ERC721_URI_STORAGE_ABI,
  {
    inputs: [],
    name: 'register',
    outputs: [{ internalType: 'uint256', name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'tokenUri', type: 'string' }],
    name: 'register',
    outputs: [{ internalType: 'uint256', name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'tokenUri', type: 'string' },
      {
        components: [
          { internalType: 'string', name: 'key', type: 'string' },
          { internalType: 'bytes', name: 'value', type: 'bytes' },
        ],
        internalType: 'struct IdentityRegistry.MetadataEntry[]',
        name: 'metadata',
        type: 'tuple[]',
      },
    ],
    name: 'register',
    outputs: [{ internalType: 'uint256', name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'string', name: 'key', type: 'string' },
    ],
    name: 'getMetadata',
    outputs: [{ internalType: 'bytes', name: '', type: 'bytes' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'string', name: 'key', type: 'string' },
      { internalType: 'bytes', name: 'value', type: 'bytes' },
    ],
    name: 'setMetadata',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'string', name: 'newUri', type: 'string' },
    ],
    name: 'setAgentUri',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { indexed: false, internalType: 'string', name: 'tokenURI', type: 'string' },
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
    ],
    name: 'Registered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { indexed: true, internalType: 'string', name: 'indexedKey', type: 'string' },
      { indexed: false, internalType: 'string', name: 'key', type: 'string' },
      { indexed: false, internalType: 'bytes', name: 'value', type: 'bytes' },
    ],
    name: 'MetadataSet',
    type: 'event',
  },
] as const;

// Reputation Registry ABI
export const REPUTATION_REGISTRY_ABI = [
  {
    inputs: [],
    name: 'getIdentityRegistry',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'uint8', name: 'score', type: 'uint8' },
      { internalType: 'bytes32', name: 'tag1', type: 'bytes32' },
      { internalType: 'bytes32', name: 'tag2', type: 'bytes32' },
      { internalType: 'string', name: 'feedbackUri', type: 'string' },
      { internalType: 'bytes32', name: 'feedbackHash', type: 'bytes32' },
      { internalType: 'bytes', name: 'feedbackAuth', type: 'bytes' },
    ],
    name: 'giveFeedback',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'uint64', name: 'feedbackIndex', type: 'uint64' },
    ],
    name: 'revokeFeedback',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'address', name: 'clientAddress', type: 'address' },
      { internalType: 'uint64', name: 'feedbackIndex', type: 'uint64' },
      { internalType: 'string', name: 'responseUri', type: 'string' },
      { internalType: 'bytes32', name: 'responseHash', type: 'bytes32' },
    ],
    name: 'appendResponse',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'address', name: 'clientAddress', type: 'address' },
    ],
    name: 'getLastIndex',
    outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'address', name: 'clientAddress', type: 'address' },
      { internalType: 'uint64', name: 'index', type: 'uint64' },
    ],
    name: 'readFeedback',
    outputs: [
      { internalType: 'uint8', name: 'score', type: 'uint8' },
      { internalType: 'bytes32', name: 'tag1', type: 'bytes32' },
      { internalType: 'bytes32', name: 'tag2', type: 'bytes32' },
      { internalType: 'bool', name: 'isRevoked', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'address[]', name: 'clientAddresses', type: 'address[]' },
      { internalType: 'bytes32', name: 'tag1', type: 'bytes32' },
      { internalType: 'bytes32', name: 'tag2', type: 'bytes32' },
    ],
    name: 'getSummary',
    outputs: [
      { internalType: 'uint64', name: 'count', type: 'uint64' },
      { internalType: 'uint8', name: 'averageScore', type: 'uint8' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'clientAddress', type: 'address' },
      { indexed: false, internalType: 'uint8', name: 'score', type: 'uint8' },
      { indexed: true, internalType: 'bytes32', name: 'tag1', type: 'bytes32' },
      { indexed: false, internalType: 'bytes32', name: 'tag2', type: 'bytes32' },
      { indexed: false, internalType: 'string', name: 'feedbackUri', type: 'string' },
      { indexed: false, internalType: 'bytes32', name: 'feedbackHash', type: 'bytes32' },
    ],
    name: 'NewFeedback',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'clientAddress', type: 'address' },
      { indexed: true, internalType: 'uint64', name: 'feedbackIndex', type: 'uint64' },
    ],
    name: 'FeedbackRevoked',
    type: 'event',
  },
] as const;

// Validation Registry ABI
export const VALIDATION_REGISTRY_ABI = [
  {
    inputs: [],
    name: 'getIdentityRegistry',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'validatorAddress', type: 'address' },
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'string', name: 'requestUri', type: 'string' },
      { internalType: 'bytes32', name: 'requestHash', type: 'bytes32' },
    ],
    name: 'validationRequest',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'requestHash', type: 'bytes32' },
      { internalType: 'uint8', name: 'response', type: 'uint8' },
      { internalType: 'string', name: 'responseUri', type: 'string' },
      { internalType: 'bytes32', name: 'responseHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'tag', type: 'bytes32' },
    ],
    name: 'validationResponse',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

/**
 * Contract registry for different chains
 */
export const DEFAULT_REGISTRIES: Record<ChainId, Record<string, string>> = {
  11155111: {
    // Ethereum Sepolia
    IDENTITY: '0x8004a6090Cd10A7288092483047B097295Fb8847',
    REPUTATION: '0x8004B8FD1A363aa02fDC07635C0c5F94f6Af5B7E',
    VALIDATION: '0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5',
  },
  84532: {
    // Base Sepolia
    IDENTITY: '0x8004AA63c570c570eBF15376c0dB199918BFe9Fb',
    REPUTATION: '0x8004bd8daB57f14Ed299135749a5CB5c42d341BF',
    VALIDATION: '0x8004C269D0A5647E51E121FeB226200ECE932d55',
  },
  59141: {
    // Linea Sepolia
    IDENTITY: '0x8004aa7C931bCE1233973a0C6A667f73F66282e7',
    REPUTATION: '0x8004bd8483b99310df121c46ED8858616b2Bba02',
    VALIDATION: '0x8004c44d1EFdd699B2A26e781eF7F77c56A9a4EB',
  },
  80002: {
    // Polygon Amoy
    IDENTITY: '0x8004ad19E14B9e0654f73353e8a0B600D46C2898',
    REPUTATION: '0x8004B12F4C2B42d00c46479e859C92e39044C930',
    VALIDATION: '0x8004C11C213ff7BaD36489bcBDF947ba5eee289B',
  },
};

/**
 * Default subgraph URLs for different chains
 */
export const DEFAULT_SUBGRAPH_URLS: Record<ChainId, string> = {
  11155111:
    'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT', // Ethereum Sepolia
  84532:
    'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/GjQEDgEKqoh5Yc8MUgxoQoRATEJdEiH7HbocfR1aFiHa', // Base Sepolia
  80002:
    'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/2A1JB18r1mF2VNP4QBH4mmxd74kbHoM6xLXC8ABAKf7j', // Polygon Amoy
};


```

`/Users/shawwalters/babylon/agent0-ts/src/core/web3-client.ts`:

```ts
/**
 * Web3 integration layer for smart contract interactions using ethers.js
 */

import {
  ethers,
  type Contract,
  type Wallet,
  type Signer,
  type JsonRpcProvider,
  type InterfaceAbi,
} from 'ethers';

export interface TransactionOptions {
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

/**
 * Web3 client for interacting with ERC-8004 smart contracts
 */
export class Web3Client {
  public readonly provider: JsonRpcProvider;
  public readonly signer?: Wallet | Signer;
  public chainId: bigint;

  /**
   * Initialize Web3 client
   * @param rpcUrl - RPC endpoint URL
   * @param signerOrKey - Optional private key string OR ethers Wallet/Signer for signing transactions
   */
  constructor(rpcUrl: string, signerOrKey?: string | Wallet | Signer) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    if (signerOrKey) {
      if (typeof signerOrKey === 'string') {
        // Private key string - create a new Wallet
        // Validate that it's not an empty string
        if (signerOrKey.trim() === '') {
          throw new Error('Private key cannot be empty');
        }
        this.signer = new ethers.Wallet(signerOrKey, this.provider);
      } else {
        // Already a Wallet or Signer - connect to provider if needed
        const currentProvider = (signerOrKey as any).provider;
        if (currentProvider && currentProvider === this.provider) {
          // Already connected to the same provider
          this.signer = signerOrKey;
        } else if (typeof signerOrKey.connect === 'function') {
          // Connect to provider
          try {
            this.signer = signerOrKey.connect(this.provider);
          } catch (error) {
            throw new Error(`Failed to connect signer to provider: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          // Signer without connect method - use as-is
          this.signer = signerOrKey;
        }
      }
    }

    // Get chain ID asynchronously (will be set in async initialization)
    // For now, we'll fetch it when needed
    this.chainId = 0n;
  }

  /**
   * Initialize the client (fetch chain ID)
   */
  async initialize(): Promise<void> {
    const network = await this.provider.getNetwork();
    this.chainId = network.chainId;
  }

  /**
   * Get contract instance
   */
  getContract(address: string, abi: InterfaceAbi): Contract {
    const signerOrProvider = this.signer || this.provider;
    return new ethers.Contract(address, abi, signerOrProvider);
  }

  /**
   * Call a contract method (view/pure function)
   */
  async callContract(
    contract: Contract,
    methodName: string,
    ...args: any[]
  ): Promise<any> {
    const method = contract[methodName];
    if (!method || typeof method !== 'function') {
      throw new Error(`Method ${methodName} not found on contract`);
    }
    return await method(...args);
  }

  /**
   * Execute a contract transaction
   * For overloaded functions like register(), use registerAgent() wrapper instead
   */
  async transactContract(
    contract: Contract,
    methodName: string,
    options: TransactionOptions = {},
    ...args: any[]
  ): Promise<string> {
    if (!this.signer) {
      throw new Error(
        'Cannot execute transaction: SDK is in read-only mode. Provide a private key to enable write operations.'
      );
    }

    // Special handling for register() function with multiple overloads
    if (methodName === 'register') {
      return this.registerAgent(contract, options, ...args);
    }

    const method = contract[methodName];
    if (!method || typeof method !== 'function') {
      throw new Error(`Method ${methodName} not found on contract`);
    }

    // Build transaction options - filter out undefined values
    const txOptions = Object.fromEntries(
      Object.entries(options).filter(([_, value]) => value !== undefined)
    ) as Partial<TransactionOptions>;

    // Send transaction
    const tx = await method(...args);
    const txResponse = await tx;
    return txResponse.hash;
  }

  /**
   * Router wrapper for register() function overloads
   * Intelligently selects the correct overload based on arguments:
   * - register() - no arguments
   * - register(string tokenUri) - just tokenUri
   * - register(string tokenUri, tuple[] metadata) - tokenUri + metadata
   */
  private async registerAgent(
    contract: Contract,
    options: TransactionOptions,
    ...args: any[]
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('No signer available for transaction');
    }

    const contractInterface = contract.interface;

    // Determine which overload to use based on arguments
    let functionName: string;
    let callArgs: any[];

    if (args.length === 0) {
      // register() - no arguments
      functionName = 'register()';
      callArgs = [];
    } else if (args.length === 1 && typeof args[0] === 'string') {
      // register(string tokenUri) - just tokenUri
      functionName = 'register(string)';
      callArgs = [args[0]];
    } else if (args.length === 2 && typeof args[0] === 'string' && Array.isArray(args[1])) {
      // register(string tokenUri, tuple[] metadata) - tokenUri + metadata
      functionName = 'register(string,(string,bytes)[])';
      callArgs = [args[0], args[1]];
    } else {
      throw new Error(
        `Invalid arguments for register(). Expected: () | (string) | (string, tuple[]), got ${args.length} arguments`
      );
    }

    // Get the specific function fragment using the signature
    const functionFragment = contractInterface.getFunction(functionName);
    if (!functionFragment) {
      throw new Error(`Function ${functionName} not found in contract ABI`);
    }

    // Encode function data to avoid ambiguity - this bypasses function resolution
    const data = contractInterface.encodeFunctionData(functionFragment, callArgs);
    
    // Send transaction directly with encoded data (no function call resolution needed)
    const txResponse = await this.signer.sendTransaction({
      to: contract.target as string,
      data: data,
    });
    
    return txResponse.hash;
  }

  /**
   * Wait for transaction to be mined
   */
  async waitForTransaction(
    txHash: string,
    timeout: number = 60000
  ): Promise<ethers.ContractTransactionReceipt> {
    return (await this.provider.waitForTransaction(txHash, undefined, timeout)) as ethers.ContractTransactionReceipt;
  }

  /**
   * Get contract events
   */
  async getEvents(
    contract: Contract,
    eventName: string,
    fromBlock: number = 0,
    toBlock?: number
  ): Promise<ethers.Log[]> {
    const filter = contract.filters[eventName]();
    return await contract.queryFilter(filter, fromBlock, toBlock);
  }

  /**
   * Encode feedback authorization data
   */
  encodeFeedbackAuth(
    agentId: bigint,
    clientAddress: string,
    indexLimit: bigint,
    expiry: bigint,
    chainId: bigint,
    identityRegistry: string,
    signerAddress: string
  ): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'address', 'uint64', 'uint256', 'uint256', 'address', 'address'],
      [agentId, clientAddress, indexLimit, expiry, chainId, identityRegistry, signerAddress]
    );
  }

  /**
   * Sign a message with the account's private key
   */
  async signMessage(message: string | Uint8Array): Promise<string> {
    if (!this.signer) {
      throw new Error('No signer available');
    }
    return await this.signer.signMessage(message);
  }

  /**
   * Recover address from message and signature
   */
  recoverAddress(message: string | Uint8Array, signature: string): string {
    return ethers.verifyMessage(message, signature);
  }

  /**
   * Compute Keccak-256 hash
   */
  keccak256(data: string | Uint8Array): string {
    if (typeof data === 'string') {
      return ethers.keccak256(ethers.toUtf8Bytes(data));
    }
    // For Uint8Array, convert to hex string first
    return ethers.keccak256(ethers.hexlify(data));
  }

  /**
   * Convert address to checksum format
   */
  toChecksumAddress(address: string): string {
    return ethers.getAddress(address);
  }


  /**
   * Check if string is a valid Ethereum address
   */
  isAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Get ETH balance of an address
   */
  async getBalance(address: string): Promise<bigint> {
    return await this.provider.getBalance(address);
  }

  /**
   * Get transaction count (nonce) of an address
   */
  async getTransactionCount(address: string): Promise<number> {
    return await this.provider.getTransactionCount(address, 'pending');
  }

  /**
   * Get the account address (if signer is available)
   */
  get address(): string | undefined {
    if (!this.signer) return undefined;
    // Wallet has address property, Signer might need getAddress()
    if ('address' in this.signer) {
      return this.signer.address as string;
    }
    // For generic Signer, we can't get address synchronously
    // This is a limitation of the Signer interface
    return undefined;
  }
  
  /**
   * Get the account address asynchronously (if signer is available)
   * Use this method when you need the address from a generic Signer
   */
  async getAddress(): Promise<string | undefined> {
    if (!this.signer) return undefined;
    return await this.signer.getAddress();
  }
}


```

`/Users/shawwalters/babylon/agent0-ts/src/core/indexer.ts`:

```ts
/**
 * Agent indexer for discovery and search functionality
 * Simplified version focused on subgraph queries (no local ML indexing)
 */

import type { AgentSummary, SearchParams, SearchResultMeta } from '../models/interfaces.js';
import type { AgentId, ChainId } from '../models/types.js';
import type { Web3Client } from './web3-client.js';
import { SubgraphClient } from './subgraph-client.js';
import { normalizeAddress } from '../utils/validation.js';
import { DEFAULT_SUBGRAPH_URLS } from './contracts.js';

/**
 * Simplified indexer that primarily uses subgraph for queries
 * No local indexing or ML capabilities - all queries go through subgraph
 */
export class AgentIndexer {
  constructor(
    private web3Client: Web3Client,
    private subgraphClient?: SubgraphClient,
    private subgraphUrlOverrides?: Record<ChainId, string>
  ) {}

  /**
   * Get agent summary from index/subgraph
   */
  async getAgent(agentId: AgentId): Promise<AgentSummary> {
    // Use subgraph if available (preferred)
    if (this.subgraphClient) {
      const agent = await this.subgraphClient.getAgentById(agentId);
      if (agent) {
        return agent;
      }
    }

    // Fallback: would need to query blockchain directly
    // For now, throw error if not in subgraph
    throw new Error(`Agent ${agentId} not found. Subgraph required for querying.`);
  }

  /**
   * Search agents with filters
   */
  async searchAgents(
    params: SearchParams = {},
    pageSize: number = 50,
    cursor?: string,
    sort: string[] = []
  ): Promise<{ items: AgentSummary[]; nextCursor?: string; meta?: SearchResultMeta }> {
    // Ensure params is always an object
    const searchParams: SearchParams = params || {};

    // Handle "all" chains shorthand
    if (searchParams.chains === 'all') {
      searchParams.chains = this._getAllConfiguredChains();
    }

    // If chains are explicitly specified (even a single chain), use multi-chain path
    if (searchParams.chains && Array.isArray(searchParams.chains) && searchParams.chains.length > 0) {
      // Validate chains are configured
      const availableChains = new Set(this._getAllConfiguredChains());
      const requestedChains = new Set(searchParams.chains);
      const invalidChains = [...requestedChains].filter(c => !availableChains.has(c));

      if (invalidChains.length > 0) {
        // Filter to valid chains only
        const validChains = searchParams.chains.filter(c => availableChains.has(c));
        if (validChains.length === 0) {
          return {
            items: [],
            nextCursor: undefined,
            meta: {
              chains: searchParams.chains,
              successfulChains: [],
              failedChains: searchParams.chains,
              totalResults: 0,
              timing: { totalMs: 0 },
            },
          };
        }
        searchParams.chains = validChains;
      }

      // Use multi-chain search if multiple chains or single chain different from default
      if (searchParams.chains.length > 1) {
        return this._searchAgentsAcrossChains(searchParams, sort, pageSize, cursor);
      }
    }

    // Single-chain search (existing logic)
    if (!this.subgraphClient) {
      throw new Error('Subgraph client required for agent search');
    }

    // Parse cursor for pagination
    const skip = cursor ? parseInt(cursor, 10) : 0;

    // Use subgraph search which pushes filters and pagination to subgraph level (much more efficient)
    // Fetch one extra record to check if there's a next page
    let agents = await this.subgraphClient.searchAgents(searchParams, pageSize + 1, skip);
    
    // Apply any remaining client-side filtering (for complex filters like array contains)
    agents = this._filterAgents(agents, searchParams);

    // Check if there are more results (we fetched pageSize + 1)
    const hasMore = agents.length > pageSize;
    const paginatedAgents = hasMore ? agents.slice(0, pageSize) : agents;

    // Return next cursor if we have more results
    const nextCursor = hasMore ? String(skip + pageSize) : undefined;

    return {
      items: paginatedAgents,
      nextCursor,
    };
  }

  private _filterAgents(agents: AgentSummary[], params: SearchParams): AgentSummary[] {
    const {
      name,
      mcp,
      a2a,
      ens,
      did,
      walletAddress,
      supportedTrust,
      a2aSkills,
      mcpTools,
      mcpPrompts,
      mcpResources,
      active,
      x402support,
      chains,
    } = params;

    return agents.filter(agent => {
      // Filter by name (flattened from registrationFile)
      if (name && !agent.name?.toLowerCase().includes(name.toLowerCase())) {
        return false;
      }

      // Filter by MCP endpoint (flattened to agent.mcp boolean)
      if (mcp !== undefined && agent.mcp !== mcp) {
        return false;
      }

      // Filter by A2A endpoint (flattened to agent.a2a boolean)
      if (a2a !== undefined && agent.a2a !== a2a) {
        return false;
      }

      // Filter by ENS (flattened from registrationFile)
      if (ens && agent.ens && normalizeAddress(agent.ens) !== normalizeAddress(ens)) {
        return false;
      }

      // Filter by DID (flattened from registrationFile)
      if (did && agent.did !== did) {
        return false;
      }

      // Filter by wallet address (flattened from registrationFile)
      if (walletAddress && agent.walletAddress && normalizeAddress(agent.walletAddress) !== normalizeAddress(walletAddress)) {
        return false;
      }

      // Filter by supported trusts (flattened from registrationFile)
      if (supportedTrust && supportedTrust.length > 0) {
        const agentTrusts = agent.supportedTrusts || [];
        if (!supportedTrust.some((trust: any) => agentTrusts.includes(trust))) {
          return false;
        }
      }

      // Filter by A2A skills (flattened from registrationFile)
      if (a2aSkills && a2aSkills.length > 0) {
        const agentSkills = agent.a2aSkills || [];
        if (!a2aSkills.some(skill => agentSkills.includes(skill))) {
          return false;
        }
      }

      // Filter by MCP tools (flattened from registrationFile)
      if (mcpTools && mcpTools.length > 0) {
        const agentTools = agent.mcpTools || [];
        if (!mcpTools.some(tool => agentTools.includes(tool))) {
          return false;
        }
      }

      // Filter by MCP prompts (flattened from registrationFile)
      if (mcpPrompts && mcpPrompts.length > 0) {
        const agentPrompts = agent.mcpPrompts || [];
        if (!mcpPrompts.some(prompt => agentPrompts.includes(prompt))) {
          return false;
        }
      }

      // Filter by MCP resources (flattened from registrationFile)
      if (mcpResources && mcpResources.length > 0) {
        const agentResources = agent.mcpResources || [];
        if (!mcpResources.some(resource => agentResources.includes(resource))) {
          return false;
        }
      }

      // Filter by active status (flattened from registrationFile)
      if (active !== undefined && agent.active !== active) {
        return false;
      }

      // Filter by x402support (flattened from registrationFile)
      if (x402support !== undefined && agent.x402support !== x402support) {
        return false;
      }

      // Filter by chain (only if chains is an array, not 'all')
      if (chains && Array.isArray(chains) && chains.length > 0 && !chains.includes(agent.chainId)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get all configured chains (chains with subgraph URLs)
   */
  private _getAllConfiguredChains(): ChainId[] {
    const chains: ChainId[] = [];
    
    // Add chains from overrides
    if (this.subgraphUrlOverrides) {
      chains.push(...Object.keys(this.subgraphUrlOverrides).map(Number));
    }
    
    // Add chains from defaults
    for (const chainId of Object.keys(DEFAULT_SUBGRAPH_URLS)) {
      const chainIdNum = Number(chainId);
      if (!chains.includes(chainIdNum)) {
        chains.push(chainIdNum);
      }
    }
    
    return chains.sort((a, b) => a - b);
  }

  /**
   * Get subgraph client for a specific chain
   */
  private _getSubgraphClientForChain(chainId: ChainId): SubgraphClient | null {
    // Check overrides first
    let subgraphUrl: string | undefined;
    if (this.subgraphUrlOverrides && chainId in this.subgraphUrlOverrides) {
      subgraphUrl = this.subgraphUrlOverrides[chainId];
    } else if (chainId in DEFAULT_SUBGRAPH_URLS) {
      subgraphUrl = DEFAULT_SUBGRAPH_URLS[chainId];
    }
    
    if (!subgraphUrl) {
      return null;
    }
    
    return new SubgraphClient(subgraphUrl);
  }

  /**
   * Parse multi-chain pagination cursor
   */
  private _parseMultiChainCursor(cursor?: string): { _global_offset: number } {
    if (!cursor) {
      return { _global_offset: 0 };
    }
    
    try {
      const parsed = JSON.parse(cursor);
      return {
        _global_offset: typeof parsed._global_offset === 'number' ? parsed._global_offset : 0,
      };
    } catch {
      // Fallback: try to parse as simple number
      const offset = parseInt(cursor, 10);
      return { _global_offset: isNaN(offset) ? 0 : offset };
    }
  }

  /**
   * Create multi-chain pagination cursor
   */
  private _createMultiChainCursor(globalOffset: number): string {
    return JSON.stringify({ _global_offset: globalOffset });
  }

  /**
   * Apply cross-chain filters (for fields not supported by subgraph WHERE clause)
   */
  private _applyCrossChainFilters(agents: AgentSummary[], params: SearchParams): AgentSummary[] {
    return this._filterAgents(agents, params);
  }

  /**
   * Deduplicate agents across chains (by name and description)
   */
  private _deduplicateAgentsCrossChain(agents: AgentSummary[], params: SearchParams): AgentSummary[] {
    // For now, return as-is (no deduplication)
    // Python SDK has deduplication logic but it's optional
    return agents;
  }

  /**
   * Sort agents across chains
   */
  private _sortAgentsCrossChain(agents: AgentSummary[], sort: string[]): AgentSummary[] {
    if (!sort || sort.length === 0) {
      return agents;
    }

    const sortField = sort[0].split(':');
    const field = sortField[0] || 'createdAt';
    const direction = (sortField[1] as 'asc' | 'desc') || 'desc';

    return [...agents].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (field) {
        case 'createdAt':
          aVal = a.extras?.createdAt || 0;
          bVal = b.extras?.createdAt || 0;
          break;
        case 'name':
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
          break;
        case 'chainId':
          aVal = a.chainId;
          bVal = b.chainId;
          break;
        default:
          aVal = a.extras?.[field] || 0;
          bVal = b.extras?.[field] || 0;
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Search agents across multiple chains in parallel
   */
  private async _searchAgentsAcrossChains(
    params: SearchParams,
    sort: string[],
    pageSize: number,
    cursor?: string,
    timeout: number = 30000
  ): Promise<{ items: AgentSummary[]; nextCursor?: string; meta: SearchResultMeta }> {
    const startTime = Date.now();

    // Step 1: Determine which chains to query
    const chainsToQuery = (params.chains && Array.isArray(params.chains) && params.chains.length > 0)
      ? params.chains
      : this._getAllConfiguredChains();

    if (chainsToQuery.length === 0) {
      return {
        items: [],
        nextCursor: undefined,
        meta: {
          chains: [],
          successfulChains: [],
          failedChains: [],
          totalResults: 0,
          timing: { totalMs: 0 },
        },
      };
    }

    // Step 2: Parse pagination cursor
    const chainCursors = this._parseMultiChainCursor(cursor);
    const globalOffset = chainCursors._global_offset;

    // Step 3: Define async function for querying a single chain
    const querySingleChain = async (chainId: ChainId): Promise<{
      chainId: ChainId;
      status: 'success' | 'error' | 'timeout' | 'unavailable';
      agents: AgentSummary[];
      error?: string;
    }> => {
      try {
        const subgraphClient = this._getSubgraphClientForChain(chainId);

        if (!subgraphClient) {
          return {
            chainId,
            status: 'unavailable',
            agents: [],
            error: `No subgraph configured for chain ${chainId}`,
          };
        }

        // Build search params for this chain (remove chains filter)
        const chainParams: SearchParams = { ...params };
        delete chainParams.chains;

        // Execute subgraph query (fetch extra to allow for filtering/sorting)
        const agents = await subgraphClient.searchAgents(chainParams, pageSize * 3, 0);

        return {
          chainId,
          status: 'success',
          agents,
        };
      } catch (error) {
        return {
          chainId,
          status: 'error',
          agents: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };

    // Step 4: Execute all chain queries in parallel with timeout
    const chainPromises = chainsToQuery.map(chainId => {
      return Promise.race([
        querySingleChain(chainId),
        new Promise<{ chainId: ChainId; status: 'timeout'; agents: AgentSummary[] }>((resolve) => {
          setTimeout(() => {
            resolve({
              chainId,
              status: 'timeout',
              agents: [],
            });
          }, timeout);
        }),
      ]);
    });

    const chainResults = await Promise.allSettled(chainPromises);

    // Step 5: Extract successful results and track failures
    const allAgents: AgentSummary[] = [];
    const successfulChains: ChainId[] = [];
    const failedChains: ChainId[] = [];

    for (let i = 0; i < chainResults.length; i++) {
      const result = chainResults[i];
      const chainId = chainsToQuery[i];

      if (result.status === 'fulfilled') {
        const chainResult = result.value;

        if (chainResult.status === 'success') {
          successfulChains.push(chainId);
          allAgents.push(...chainResult.agents);
        } else {
          failedChains.push(chainId);
        }
      } else {
        // Promise rejected
        failedChains.push(chainId);
      }
    }

    // If ALL chains failed, return error metadata
    if (successfulChains.length === 0) {
      const queryTime = Date.now() - startTime;
      return {
        items: [],
        nextCursor: undefined,
        meta: {
          chains: chainsToQuery,
          successfulChains: [],
          failedChains,
          totalResults: 0,
          timing: { totalMs: queryTime },
        },
      };
    }

    // Step 6: Apply cross-chain filtering
    const filteredAgents = this._applyCrossChainFilters(allAgents, params);

    // Step 7: Deduplicate if requested
    const deduplicatedAgents = this._deduplicateAgentsCrossChain(filteredAgents, params);

    // Step 8: Sort across chains
    const sortedAgents = this._sortAgentsCrossChain(deduplicatedAgents, sort);

    // Step 9: Paginate
    const startIdx = globalOffset;
    const endIdx = startIdx + pageSize;
    const paginatedAgents = sortedAgents.slice(startIdx, endIdx);

    // Step 10: Calculate next cursor
    const nextCursor = sortedAgents.length > endIdx
      ? this._createMultiChainCursor(endIdx)
      : undefined;

    // Step 11: Build response with metadata
    const queryTime = Date.now() - startTime;

    return {
      items: paginatedAgents,
      nextCursor,
      meta: {
        chains: chainsToQuery,
        successfulChains,
        failedChains,
        totalResults: sortedAgents.length,
        timing: {
          totalMs: queryTime,
          averagePerChainMs: chainsToQuery.length > 0 ? Math.floor(queryTime / chainsToQuery.length) : undefined,
        },
      },
    };
  }

  /**
   * Search agents by reputation
   */
  async searchAgentsByReputation(
    agents?: string[],
    tags?: string[],
    reviewers?: string[],
    capabilities?: string[],
    skills?: string[],
    tasks?: string[],
    names?: string[],
    minAverageScore?: number,
    includeRevoked: boolean = false,
    first: number = 50,
    skip: number = 0,
    sort: string[] = ['createdAt:desc'],
    chains?: ChainId[] | 'all'
  ): Promise<{ items: AgentSummary[]; nextCursor?: string; meta?: SearchResultMeta }> {
    // Handle "all" chains shorthand
    let chainsToQuery: ChainId[] | undefined;
    if (chains === 'all') {
      chainsToQuery = this._getAllConfiguredChains();
    } else if (chains && Array.isArray(chains) && chains.length > 0) {
      chainsToQuery = chains;
    }

    // If chains are specified, use multi-chain search
    // Route to multi-chain if multiple chains OR if single chain is specified (to ensure correct subgraph client)
    if (chainsToQuery && chainsToQuery.length > 0) {
      return this._searchAgentsByReputationAcrossChains(
        agents,
        tags,
        reviewers,
        capabilities,
        skills,
        tasks,
        names,
        minAverageScore,
        includeRevoked,
        first,
        skip,
        sort,
        chainsToQuery
      );
    }

    // Single-chain search (existing logic)
    if (!this.subgraphClient) {
      throw new Error('Subgraph client required for reputation search');
    }

    // Parse sort parameter
    let orderBy = 'createdAt';
    let orderDirection: 'asc' | 'desc' = 'desc';
    if (sort && sort.length > 0) {
      const sortField = sort[0].split(':');
      orderBy = sortField[0] || orderBy;
      orderDirection = (sortField[1] as 'asc' | 'desc') || orderDirection;
    }

    try {
      const agentsData = await this.subgraphClient.searchAgentsByReputation(
        agents,
        tags,
        reviewers,
        capabilities,
        skills,
        tasks,
        names,
        minAverageScore,
        includeRevoked,
        first,
        skip,
        orderBy,
        orderDirection
      );

      // Transform to AgentSummary with averageScore in extras
      const items: AgentSummary[] = agentsData.map((agent) => {
        const regFile = agent.registrationFile;
        
        return {
          chainId: parseInt(agent.chainId?.toString() || '0', 10),
          agentId: agent.id || '',
          name: regFile?.name || '',
          image: regFile?.image || undefined,
          description: regFile?.description || '',
          owners: agent.owner ? [normalizeAddress(agent.owner)] : [],
          operators: (agent.operators || []).map((op: string) => normalizeAddress(op)),
          mcp: !!regFile?.mcpEndpoint,
          a2a: !!regFile?.a2aEndpoint,
          ens: regFile?.ens || undefined,
          did: regFile?.did || undefined,
          walletAddress: regFile?.agentWallet ? normalizeAddress(regFile.agentWallet) : undefined,
          supportedTrusts: regFile?.supportedTrusts || [],
          a2aSkills: regFile?.a2aSkills || [],
          mcpTools: regFile?.mcpTools || [],
          mcpPrompts: regFile?.mcpPrompts || [],
          mcpResources: regFile?.mcpResources || [],
          active: regFile?.active ?? false,
          x402support: regFile?.x402support ?? false,
          extras: {
            averageScore: agent.averageScore !== null ? agent.averageScore : undefined,
          },
        };
      });

      const nextCursor = items.length === first ? String(skip + items.length) : undefined;

      return {
        items,
        nextCursor,
      };
    } catch (error) {
      throw new Error(`Failed to search agents by reputation: ${error}`);
    }
  }

  /**
   * Search agents by reputation across multiple chains in parallel
   */
  private async _searchAgentsByReputationAcrossChains(
    agents?: string[],
    tags?: string[],
    reviewers?: string[],
    capabilities?: string[],
    skills?: string[],
    tasks?: string[],
    names?: string[],
    minAverageScore?: number,
    includeRevoked: boolean = false,
    pageSize: number = 50,
    skip: number = 0,
    sort: string[] = ['createdAt:desc'],
    chains: ChainId[] = [],
    timeout: number = 30000
  ): Promise<{ items: AgentSummary[]; nextCursor?: string; meta: SearchResultMeta }> {
    const startTime = Date.now();

    if (chains.length === 0) {
      return {
        items: [],
        nextCursor: undefined,
        meta: {
          chains: [],
          successfulChains: [],
          failedChains: [],
          totalResults: 0,
          timing: { totalMs: 0 },
        },
      };
    }

    // Parse sort parameter
    let orderBy = 'createdAt';
    let orderDirection: 'asc' | 'desc' = 'desc';
    if (sort && sort.length > 0) {
      const sortField = sort[0].split(':');
      orderBy = sortField[0] || orderBy;
      orderDirection = (sortField[1] as 'asc' | 'desc') || orderDirection;
    }

    // Define async function for querying a single chain
    const querySingleChain = async (chainId: ChainId): Promise<{
      chainId: ChainId;
      status: 'success' | 'error' | 'timeout' | 'unavailable';
      agents: Array<any>; // Will be transformed to AgentSummary later
      error?: string;
    }> => {
      try {
        const subgraphClient = this._getSubgraphClientForChain(chainId);

        if (!subgraphClient) {
          return {
            chainId,
            status: 'unavailable',
            agents: [],
            error: `No subgraph configured for chain ${chainId}`,
          };
        }

        // Execute reputation search query
        try {
          const agentsData = await subgraphClient.searchAgentsByReputation(
            agents,
            tags,
            reviewers,
            capabilities,
            skills,
            tasks,
            names,
            minAverageScore,
            includeRevoked,
            pageSize * 3, // Fetch extra to allow for filtering/sorting
            0, // We'll handle pagination after aggregation
            orderBy,
            orderDirection
          );

          return {
            chainId,
            status: 'success',
            agents: agentsData,
          };
        } catch (error) {
          return {
            chainId,
            status: 'error',
            agents: [],
            error: error instanceof Error ? error.message : String(error),
          };
        }
      } catch (error) {
        return {
          chainId,
          status: 'error',
          agents: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };

    // Execute all chain queries in parallel with timeout
    const chainPromises = chains.map(chainId => {
      return Promise.race([
        querySingleChain(chainId),
        new Promise<{ chainId: ChainId; status: 'timeout'; agents: any[] }>((resolve) => {
          setTimeout(() => {
            resolve({
              chainId,
              status: 'timeout',
              agents: [],
            });
          }, timeout);
        }),
      ]);
    });

    const chainResults = await Promise.allSettled(chainPromises);

    // Extract successful results and track failures
    const allAgents: Array<any> = []; // Will be transformed to AgentSummary later
    const successfulChains: ChainId[] = [];
    const failedChains: ChainId[] = [];

    for (let i = 0; i < chainResults.length; i++) {
      const result = chainResults[i];
      const chainId = chains[i];

      if (result.status === 'fulfilled') {
        const chainResult = result.value;

        if (chainResult.status === 'success') {
          successfulChains.push(chainId);
          allAgents.push(...chainResult.agents);
        } else {
          failedChains.push(chainId);
        }
      } else {
        failedChains.push(chainId);
      }
    }

    // If ALL chains failed, return error metadata
    if (successfulChains.length === 0) {
      const queryTime = Date.now() - startTime;
      return {
        items: [],
        nextCursor: undefined,
        meta: {
          chains,
          successfulChains: [],
          failedChains,
          totalResults: 0,
          timing: { totalMs: queryTime },
        },
      };
    }

    // Transform to AgentSummary with averageScore in extras
    const results: AgentSummary[] = allAgents.map((agent) => {
      const regFile = agent.registrationFile || {};
      
      return {
        chainId: parseInt(agent.chainId?.toString() || '0', 10),
        agentId: agent.id || '',
        name: regFile?.name || '',
        image: regFile?.image || undefined,
        description: regFile?.description || '',
        owners: agent.owner ? [normalizeAddress(agent.owner)] : [],
        operators: (agent.operators || []).map((op: string) => normalizeAddress(op)),
        mcp: !!regFile?.mcpEndpoint,
        a2a: !!regFile?.a2aEndpoint,
        ens: regFile?.ens || undefined,
        did: regFile?.did || undefined,
        walletAddress: regFile?.agentWallet ? normalizeAddress(regFile.agentWallet) : undefined,
        supportedTrusts: regFile?.supportedTrusts || [],
        a2aSkills: regFile?.a2aSkills || [],
        mcpTools: regFile?.mcpTools || [],
        mcpPrompts: regFile?.mcpPrompts || [],
        mcpResources: regFile?.mcpResources || [],
        active: regFile?.active ?? false,
        x402support: regFile?.x402support ?? false,
        extras: {
          averageScore: agent.averageScore !== null ? agent.averageScore : undefined,
        },
      };
    });

    // Sort by averageScore (descending) if available, otherwise by createdAt
    results.sort((a, b) => {
      const aScore = a.extras?.averageScore ?? 0;
      const bScore = b.extras?.averageScore ?? 0;
      if (aScore !== bScore) {
        return bScore - aScore; // Descending
      }
      // Secondary sort by chainId, then agentId
      if (a.chainId !== b.chainId) {
        return a.chainId - b.chainId;
      }
      return a.agentId.localeCompare(b.agentId);
    });

    // Apply pagination
    const paginatedResults = results.slice(skip, skip + pageSize);
    const nextCursor = results.length > skip + pageSize
      ? String(skip + pageSize)
      : undefined;

    // Build response with metadata
    const queryTime = Date.now() - startTime;

    return {
      items: paginatedResults,
      nextCursor,
      meta: {
        chains,
        successfulChains,
        failedChains,
        totalResults: results.length,
        timing: {
          totalMs: queryTime,
          averagePerChainMs: chains.length > 0 ? Math.floor(queryTime / chains.length) : undefined,
        },
      },
    };
  }
}


```

`/Users/shawwalters/babylon/agent0-ts/src/core/agent.ts`:

```ts
/**
 * Agent class for managing individual agents
 */

import { ethers } from 'ethers';
import type {
  RegistrationFile,
  Endpoint,
} from '../models/interfaces.js';
import type { AgentId, Address, URI } from '../models/types.js';
import { EndpointType, TrustModel } from '../models/enums.js';
import type { SDK } from './sdk.js';
import { EndpointCrawler } from './endpoint-crawler.js';
import { parseAgentId } from '../utils/id-format.js';
import { TIMEOUTS } from '../utils/constants.js';
import { validateSkill, validateDomain } from './oasf-validator.js';

/**
 * Agent class for managing individual agents
 */
export class Agent {
  private registrationFile: RegistrationFile;
  private _endpointCrawler: EndpointCrawler;
  private _dirtyMetadata = new Set<string>();
  private _lastRegisteredWallet?: Address;
  private _lastRegisteredEns?: string;

  constructor(private sdk: SDK, registrationFile: RegistrationFile) {
    this.registrationFile = registrationFile;
    this._endpointCrawler = new EndpointCrawler(5000);
  }

  // Read-only properties
  get agentId(): AgentId | undefined {
    return this.registrationFile.agentId;
  }

  get agentURI(): URI | undefined {
    return this.registrationFile.agentURI;
  }

  get name(): string {
    return this.registrationFile.name;
  }

  get description(): string {
    return this.registrationFile.description;
  }

  get image(): URI | undefined {
    return this.registrationFile.image;
  }

  get mcpEndpoint(): string | undefined {
    const ep = this.registrationFile.endpoints.find((e) => e.type === EndpointType.MCP);
    return ep?.value;
  }

  get a2aEndpoint(): string | undefined {
    const ep = this.registrationFile.endpoints.find((e) => e.type === EndpointType.A2A);
    return ep?.value;
  }

  get ensEndpoint(): string | undefined {
    const ep = this.registrationFile.endpoints.find((e) => e.type === EndpointType.ENS);
    return ep?.value;
  }

  get walletAddress(): Address | undefined {
    return this.registrationFile.walletAddress;
  }

  get mcpTools(): string[] | undefined {
    const ep = this.registrationFile.endpoints.find((e) => e.type === EndpointType.MCP);
    return ep?.meta?.mcpTools;
  }

  get mcpPrompts(): string[] | undefined {
    const ep = this.registrationFile.endpoints.find((e) => e.type === EndpointType.MCP);
    return ep?.meta?.mcpPrompts;
  }

  get mcpResources(): string[] | undefined {
    const ep = this.registrationFile.endpoints.find((e) => e.type === EndpointType.MCP);
    return ep?.meta?.mcpResources;
  }

  get a2aSkills(): string[] | undefined {
    const ep = this.registrationFile.endpoints.find((e) => e.type === EndpointType.A2A);
    return ep?.meta?.a2aSkills;
  }

  // Endpoint management
  async setMCP(endpoint: string, version: string = '2025-06-18', autoFetch: boolean = true): Promise<this> {
    // Remove existing MCP endpoint if any
    this.registrationFile.endpoints = this.registrationFile.endpoints.filter(
      (ep) => ep.type !== EndpointType.MCP
    );

    // Try to fetch capabilities from the endpoint (soft fail)
    const meta: Record<string, unknown> = { version };
    if (autoFetch) {
      try {
        const capabilities = await this._endpointCrawler.fetchMcpCapabilities(endpoint);
        if (capabilities) {
          if (capabilities.mcpTools) meta.mcpTools = capabilities.mcpTools;
          if (capabilities.mcpPrompts) meta.mcpPrompts = capabilities.mcpPrompts;
          if (capabilities.mcpResources) meta.mcpResources = capabilities.mcpResources;
        }
      } catch (error) {
        // Soft fail - continue without capabilities
      }
    }

    // Add new MCP endpoint
    const mcpEndpoint: Endpoint = {
      type: EndpointType.MCP,
      value: endpoint,
      meta,
    };
    this.registrationFile.endpoints.push(mcpEndpoint);
    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);

    return this;
  }

  async setA2A(agentcard: string, version: string = '0.30', autoFetch: boolean = true): Promise<this> {
    // Remove existing A2A endpoint if any
    this.registrationFile.endpoints = this.registrationFile.endpoints.filter(
      (ep) => ep.type !== EndpointType.A2A
    );

    // Try to fetch capabilities from the endpoint (soft fail)
    const meta: Record<string, unknown> = { version };
    if (autoFetch) {
      try {
        const capabilities = await this._endpointCrawler.fetchA2aCapabilities(agentcard);
        if (capabilities?.a2aSkills) {
          meta.a2aSkills = capabilities.a2aSkills;
        }
      } catch (error) {
        // Soft fail - continue without capabilities
      }
    }

    // Add new A2A endpoint
    const a2aEndpoint: Endpoint = {
      type: EndpointType.A2A,
      value: agentcard,
      meta,
    };
    this.registrationFile.endpoints.push(a2aEndpoint);
    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);

    return this;
  }

  setENS(name: string, version: string = '1.0'): this {
    // Remove existing ENS endpoints
    this.registrationFile.endpoints = this.registrationFile.endpoints.filter(
      (ep) => ep.type !== EndpointType.ENS
    );

    // Check if ENS changed
    if (name !== this._lastRegisteredEns) {
      this._dirtyMetadata.add('agentName');
    }

    // Add new ENS endpoint
    const ensEndpoint: Endpoint = {
      type: EndpointType.ENS,
      value: name,
      meta: { version },
    };
    this.registrationFile.endpoints.push(ensEndpoint);
    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);

    return this;
  }

  // OASF endpoint management
  private _getOrCreateOasfEndpoint(): Endpoint {
    // Find existing OASF endpoint
    const existing = this.registrationFile.endpoints.find(
      (ep) => ep.type === EndpointType.OASF
    );
    if (existing) {
      return existing;
    }

    // Create new OASF endpoint with default values
    const oasfEndpoint: Endpoint = {
      type: EndpointType.OASF,
      value: 'https://github.com/agntcy/oasf/',
      meta: { version: 'v0.8.0', skills: [], domains: [] },
    };
    this.registrationFile.endpoints.push(oasfEndpoint);
    return oasfEndpoint;
  }

  addSkill(slug: string, validateOASF: boolean = false): this {
    /**
     * Add a skill to the OASF endpoint.
     * @param slug The skill slug to add (e.g., "natural_language_processing/summarization")
     * @param validateOASF If true, validate the slug against the OASF taxonomy (default: false)
     * @returns this for method chaining
     * @throws Error if validateOASF=true and the slug is not valid
     */
    if (validateOASF) {
      if (!validateSkill(slug)) {
        throw new Error(
          `Invalid OASF skill slug: ${slug}. ` +
            'Use validateOASF=false to skip validation.'
        );
      }
    }

    const oasfEndpoint = this._getOrCreateOasfEndpoint();

    // Initialize skills array if missing
    if (!oasfEndpoint.meta) {
      oasfEndpoint.meta = {};
    }
    if (!Array.isArray(oasfEndpoint.meta.skills)) {
      oasfEndpoint.meta.skills = [];
    }

    // Add slug if not already present (avoid duplicates)
    const skills = oasfEndpoint.meta.skills as string[];
    if (!skills.includes(slug)) {
      skills.push(slug);
    }

    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
    return this;
  }

  removeSkill(slug: string): this {
    /**
     * Remove a skill from the OASF endpoint.
     * @param slug The skill slug to remove
     * @returns this for method chaining
     */
    // Find OASF endpoint
    const oasfEndpoint = this.registrationFile.endpoints.find(
      (ep) => ep.type === EndpointType.OASF
    );

    if (oasfEndpoint && oasfEndpoint.meta) {
      const skills = oasfEndpoint.meta.skills;
      if (Array.isArray(skills)) {
        const index = skills.indexOf(slug);
        if (index !== -1) {
          skills.splice(index, 1);
        }
      }
      this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
    }

    return this;
  }

  addDomain(slug: string, validateOASF: boolean = false): this {
    /**
     * Add a domain to the OASF endpoint.
     * @param slug The domain slug to add (e.g., "finance_and_business/investment_services")
     * @param validateOASF If true, validate the slug against the OASF taxonomy (default: false)
     * @returns this for method chaining
     * @throws Error if validateOASF=true and the slug is not valid
     */
    if (validateOASF) {
      if (!validateDomain(slug)) {
        throw new Error(
          `Invalid OASF domain slug: ${slug}. ` +
            'Use validateOASF=false to skip validation.'
        );
      }
    }

    const oasfEndpoint = this._getOrCreateOasfEndpoint();

    // Initialize domains array if missing
    if (!oasfEndpoint.meta) {
      oasfEndpoint.meta = {};
    }
    if (!Array.isArray(oasfEndpoint.meta.domains)) {
      oasfEndpoint.meta.domains = [];
    }

    // Add slug if not already present (avoid duplicates)
    const domains = oasfEndpoint.meta.domains as string[];
    if (!domains.includes(slug)) {
      domains.push(slug);
    }

    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
    return this;
  }

  removeDomain(slug: string): this {
    /**
     * Remove a domain from the OASF endpoint.
     * @param slug The domain slug to remove
     * @returns this for method chaining
     */
    // Find OASF endpoint
    const oasfEndpoint = this.registrationFile.endpoints.find(
      (ep) => ep.type === EndpointType.OASF
    );

    if (oasfEndpoint && oasfEndpoint.meta) {
      const domains = oasfEndpoint.meta.domains;
      if (Array.isArray(domains)) {
        const index = domains.indexOf(slug);
        if (index !== -1) {
          domains.splice(index, 1);
        }
      }
      this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
    }

    return this;
  }

  setAgentWallet(address: Address, chainId: number): this {
    this.registrationFile.walletAddress = address;
    this.registrationFile.walletChainId = chainId;

    // Check if wallet changed
    if (address !== this._lastRegisteredWallet) {
      this._dirtyMetadata.add('agentWallet');
    }

    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
    return this;
  }

  setActive(active: boolean): this {
    this.registrationFile.active = active;
    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
    return this;
  }

  setX402Support(x402Support: boolean): this {
    this.registrationFile.x402support = x402Support;
    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
    return this;
  }

  setTrust(
    reputation: boolean = false,
    cryptoEconomic: boolean = false,
    teeAttestation: boolean = false
  ): this {
    const trustModels: (TrustModel | string)[] = [];
    if (reputation) trustModels.push(TrustModel.REPUTATION);
    if (cryptoEconomic) trustModels.push(TrustModel.CRYPTO_ECONOMIC);
    if (teeAttestation) trustModels.push(TrustModel.TEE_ATTESTATION);

    this.registrationFile.trustModels = trustModels;
    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
    return this;
  }

  setMetadata(kv: Record<string, unknown>): this {
    // Mark all provided keys as dirty
    for (const key of Object.keys(kv)) {
      this._dirtyMetadata.add(key);
    }

    Object.assign(this.registrationFile.metadata, kv);
    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
    return this;
  }

  getMetadata(): Record<string, unknown> {
    return { ...this.registrationFile.metadata };
  }

  delMetadata(key: string): this {
    if (key in this.registrationFile.metadata) {
      delete this.registrationFile.metadata[key];
      this._dirtyMetadata.delete(key);
      this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
    }
    return this;
  }

  getRegistrationFile(): RegistrationFile {
    return this.registrationFile;
  }

  /**
   * Update basic agent information
   */
  updateInfo(name?: string, description?: string, image?: URI): this {
    if (name !== undefined) {
      this.registrationFile.name = name;
    }
    if (description !== undefined) {
      this.registrationFile.description = description;
    }
    if (image !== undefined) {
      this.registrationFile.image = image;
    }

    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
    return this;
  }

  /**
   * Register agent on-chain with IPFS flow
   */
  async registerIPFS(): Promise<RegistrationFile> {
    // Validate basic info
    if (!this.registrationFile.name || !this.registrationFile.description) {
      throw new Error('Agent must have name and description before registration');
    }

    if (this.registrationFile.agentId) {
      // Agent already registered - update registration file and redeploy
      // Option 2D: Add logging and timeout handling
      const chainId = await this.sdk.chainId();
      const identityRegistryAddress = await this.sdk.getIdentityRegistry().getAddress();
      
      const ipfsCid = await this.sdk.ipfsClient!.addRegistrationFile(
        this.registrationFile,
        chainId,
        identityRegistryAddress
      );

      // Update metadata on-chain if changed
      // Only send transactions for dirty (changed) metadata to save gas
      if (this._dirtyMetadata.size > 0) {
        try {
          await this._updateMetadataOnChain();
        } catch (error) {
          // Transaction was sent and will eventually confirm - continue silently
        }
      }

      // Update agent URI on-chain
      const { tokenId } = parseAgentId(this.registrationFile.agentId);
      
      const txHash = await this.sdk.web3Client.transactContract(
        this.sdk.getIdentityRegistry(),
        'setAgentUri',
        {},
        BigInt(tokenId),
        `ipfs://${ipfsCid}`
      );
      
      // Wait for transaction to be confirmed (30 second timeout like Python)
      // If timeout, continue - transaction was sent and will eventually confirm
      try {
        await this.sdk.web3Client.waitForTransaction(txHash, TIMEOUTS.TRANSACTION_WAIT);
      } catch (error) {
        // Transaction was sent and will eventually confirm - continue silently
      }

      // Clear dirty flags
      this._lastRegisteredWallet = this.walletAddress;
      this._lastRegisteredEns = this.ensEndpoint;
      this._dirtyMetadata.clear();

      this.registrationFile.agentURI = `ipfs://${ipfsCid}`;
      return this.registrationFile;
    } else {
      // First time registration
      // Step 1: Register on-chain without URI
      await this._registerWithoutUri();

      // Step 2: Upload to IPFS
      const chainId = await this.sdk.chainId();
      const identityRegistryAddress = await this.sdk.getIdentityRegistry().getAddress();
      const ipfsCid = await this.sdk.ipfsClient!.addRegistrationFile(
        this.registrationFile,
        chainId,
        identityRegistryAddress
      );

      // Step 3: Set agent URI on-chain
      const { tokenId } = parseAgentId(this.registrationFile.agentId!);
      const txHash = await this.sdk.web3Client.transactContract(
        this.sdk.getIdentityRegistry(),
        'setAgentUri',
        {},
        BigInt(tokenId),
        `ipfs://${ipfsCid}`
      );
      
      // Wait for transaction to be confirmed
      await this.sdk.web3Client.waitForTransaction(txHash);

      // Clear dirty flags
      this._lastRegisteredWallet = this.walletAddress;
      this._lastRegisteredEns = this.ensEndpoint;
      this._dirtyMetadata.clear();

      this.registrationFile.agentURI = `ipfs://${ipfsCid}`;
      return this.registrationFile;
    }
  }

  /**
   * Register agent on-chain with HTTP URI
   */
  async registerHTTP(agentUri: string): Promise<RegistrationFile> {
    // Validate basic info
    if (!this.registrationFile.name || !this.registrationFile.description) {
      throw new Error('Agent must have name and description before registration');
    }

    if (this.registrationFile.agentId) {
      // Agent already registered - update agent URI
      await this.setAgentUri(agentUri);
      return this.registrationFile;
    } else {
      // First time registration
      return await this._registerWithUri(agentUri);
    }
  }

  /**
   * Set agent URI (for updates)
   */
  async setAgentUri(agentUri: string): Promise<void> {
    if (!this.registrationFile.agentId) {
      throw new Error('Agent must be registered before setting URI');
    }

    const { tokenId } = parseAgentId(this.registrationFile.agentId);
    await this.sdk.web3Client.transactContract(
      this.sdk.getIdentityRegistry(),
      'setAgentUri',
      {},
      BigInt(tokenId),
      agentUri
    );

    this.registrationFile.agentURI = agentUri;
    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
  }

  /**
   * Transfer agent ownership
   */
  async transfer(newOwner: Address): Promise<{ txHash: string; from: Address; to: Address; agentId: AgentId }> {
    if (!this.registrationFile.agentId) {
      throw new Error('Agent must be registered before transfer');
    }

    const { tokenId } = parseAgentId(this.registrationFile.agentId);
    const currentOwner = this.sdk.web3Client.address;
    if (!currentOwner) {
      throw new Error('No signer available');
    }

    // Validate address - normalize to lowercase first
    const normalizedAddress = newOwner.toLowerCase();
    if (!this.sdk.web3Client.isAddress(normalizedAddress)) {
      throw new Error(`Invalid address: ${newOwner}`);
    }

    // Validate not zero address (check before expensive operations)
    if (normalizedAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('Cannot transfer agent to zero address');
    }

    // Convert to checksum format
    const checksumAddress = this.sdk.web3Client.toChecksumAddress(normalizedAddress);

    // Validate not transferring to self
    if (checksumAddress.toLowerCase() === currentOwner.toLowerCase()) {
      throw new Error('Cannot transfer agent to yourself');
    }

    const identityRegistry = this.sdk.getIdentityRegistry();
    const txHash = await this.sdk.web3Client.transactContract(
      identityRegistry,
      'transferFrom',
      {},
      currentOwner,
      checksumAddress,
      BigInt(tokenId)
    );

    return {
      txHash,
      from: currentOwner,
      to: checksumAddress,
      agentId: this.registrationFile.agentId,
    };
  }

  /**
   * Private helper methods
   */
  private async _registerWithoutUri(): Promise<void> {
    // Collect metadata for registration
    const metadataEntries = this._collectMetadataForRegistration();

    // Mint agent with metadata
    const identityRegistry = this.sdk.getIdentityRegistry();
    
    // If we have metadata, use register(string, tuple[])
    // Otherwise use register() with no args
    let txHash: string;
    if (metadataEntries.length > 0) {
      txHash = await this.sdk.web3Client.transactContract(
        identityRegistry,
        'register',
        {}, // Transaction options
        '', // Empty tokenUri
        metadataEntries
      );
    } else {
      txHash = await this.sdk.web3Client.transactContract(
        identityRegistry,
        'register',
        {} // Transaction options
        // No arguments - calls register()
      );
    }

    // Wait for transaction
    const receipt = await this.sdk.web3Client.waitForTransaction(txHash);

    // Extract agent ID from events
    const agentId = this._extractAgentIdFromReceipt(receipt);

    // Update registration file
    const chainId = await this.sdk.chainId();
    this.registrationFile.agentId = `${chainId}:${agentId}`;
    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
  }

  private async _registerWithUri(agentUri: string): Promise<RegistrationFile> {
    // Collect metadata for registration
    const metadataEntries = this._collectMetadataForRegistration();

    // Register with URI and metadata
    const identityRegistry = this.sdk.getIdentityRegistry();
    const txHash = await this.sdk.web3Client.transactContract(
      identityRegistry,
      'register',
      {},
      agentUri,
      metadataEntries
    );

    // Wait for transaction
    const receipt = await this.sdk.web3Client.waitForTransaction(txHash);

    // Extract agent ID from events
    const agentId = this._extractAgentIdFromReceipt(receipt);

    // Update registration file
    const chainId = await this.sdk.chainId();
    this.registrationFile.agentId = `${chainId}:${agentId}`;
    this.registrationFile.agentURI = agentUri;
    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);

    return this.registrationFile;
  }

  private async _updateMetadataOnChain(): Promise<void> {
    const metadataEntries = this._collectMetadataForRegistration();
    const { tokenId } = parseAgentId(this.registrationFile.agentId!);
    const identityRegistry = this.sdk.getIdentityRegistry();

    // Update metadata one by one (like Python SDK)
    // Only send transactions for dirty (changed) metadata keys
    for (const entry of metadataEntries) {
      if (this._dirtyMetadata.has(entry.key)) {
        const txHash = await this.sdk.web3Client.transactContract(
          identityRegistry,
          'setMetadata',
          {},
          BigInt(tokenId),
          entry.key,
          entry.value
        );

        // Wait with 30 second timeout (like Python SDK)
        // If timeout, log warning but continue - transaction was sent and will eventually confirm
        try {
          await this.sdk.web3Client.waitForTransaction(txHash, TIMEOUTS.TRANSACTION_WAIT);
        } catch (error) {
          // Transaction was sent and will eventually confirm - continue silently
        }
      }
    }
  }

  private _collectMetadataForRegistration(): Array<{ key: string; value: Uint8Array }> {
    const entries: Array<{ key: string; value: Uint8Array }> = [];

    // Collect wallet address if set
    if (this.registrationFile.walletAddress && this.registrationFile.walletChainId) {
      const walletValue = `eip155:${this.registrationFile.walletChainId}:${this.registrationFile.walletAddress}`;
      entries.push({
        key: 'agentWallet',
        value: new TextEncoder().encode(walletValue),
      });
    }

    // Collect custom metadata
    for (const [key, value] of Object.entries(this.registrationFile.metadata)) {
      let valueBytes: Uint8Array;
      if (typeof value === 'string') {
        valueBytes = new TextEncoder().encode(value);
      } else if (typeof value === 'number') {
        valueBytes = new TextEncoder().encode(value.toString());
      } else {
        valueBytes = new TextEncoder().encode(JSON.stringify(value));
      }

      entries.push({ key, value: valueBytes });
    }

    return entries;
  }

  private _extractAgentIdFromReceipt(receipt: ethers.ContractTransactionReceipt): bigint {
    // Parse events from receipt to find Registered event
    const identityRegistry = this.sdk.getIdentityRegistry();
    const transferEventTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // Transfer(address,address,uint256)

    // Find the event in the logs
    for (const log of receipt.logs || []) {
      try {
        // Try parsing as Registered event
        const parsed = identityRegistry.interface.parseLog({
          topics: Array.isArray(log.topics) ? log.topics.map((t: string | ethers.BytesLike) => typeof t === 'string' ? t : ethers.hexlify(t)) : log.topics || [],
          data: typeof log.data === 'string' ? log.data : ethers.hexlify(log.data || '0x'),
        });
        if (parsed && parsed.name === 'Registered') {
          return BigInt(parsed.args.agentId.toString());
        }
      } catch {
        // Not a Registered event, try Transfer event MP (ERC-721)
        try {
          const topics = Array.isArray(log.topics) ? log.topics : [];
          // Transfer event has topic[0] = Transfer signature, topic[3] = tokenId (if 4 topics)
          if (topics.length >= 4) {
            const topic0 = typeof topics[0] === 'string' ? topics[0] : topics[0].toString();
            if (topic0 === transferEventTopic || topic0.toLowerCase() === transferEventTopic.toLowerCase()) {
              // Extract tokenId from topic[3]
              const tokenIdHex = typeof topics[3] === 'string' ? topics[3] : topics[3].toString();
              // Remove 0x prefix if present and convert
              const tokenIdStr = tokenIdHex.startsWith('0x') ? tokenIdHex.slice(2) : tokenIdHex;
              return BigInt('0x' + tokenIdStr);
            }
          }
        } catch {
          // Continue searching
        }
      }
    }

    // Fallback: try to get total supply and use latest token ID
    // Note: This is async but we're in a sync method, so we'll try to call but it might not work
    // Better to throw error and let caller handle

    throw new Error('Could not extract agent ID from transaction receipt - no Registered or Transfer event found');
  }
}


```

`/Users/shawwalters/babylon/agent0-ts/src/core/endpoint-crawler.ts`:

```ts
/**
 * Endpoint Crawler for MCP and A2A Servers
 * Automatically fetches capabilities (tools, prompts, resources, skills) from endpoints
 */

export interface McpCapabilities {
  mcpTools?: string[];
  mcpPrompts?: string[];
  mcpResources?: string[];
}

export interface A2aCapabilities {
  a2aSkills?: string[];
}

/**
 * Helper to create JSON-RPC request
 */
function createJsonRpcRequest(method: string, params?: Record<string, unknown>, requestId: number = 1) {
  return {
    jsonrpc: '2.0',
    method,
    id: requestId,
    params: params || {},
  };
}

/**
 * Crawls MCP and A2A endpoints to fetch capabilities
 */
export class EndpointCrawler {
  private timeout: number;

  constructor(timeout: number = 5000) {
    this.timeout = timeout;
  }

  /**
   * Fetch MCP capabilities (tools, prompts, resources) from an MCP server
   */
  async fetchMcpCapabilities(endpoint: string): Promise<McpCapabilities | null> {
    // Ensure endpoint is HTTP/HTTPS
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      // Invalid endpoint format - return null
      return null;
    }

    // Try JSON-RPC approach first (for real MCP servers)
    const capabilities = await this._fetchViaJsonRpc(endpoint);
    if (capabilities) {
      return capabilities;
    }

    // Fallback to static agentcard.json
    try {
      const agentcardUrl = `${endpoint}/agentcard.json`;
      const response = await fetch(agentcardUrl, {
        signal: AbortSignal.timeout(this.timeout),
        redirect: 'follow',
      });

      if (response.ok) {
        const data = await response.json();

        // Extract capabilities from agentcard
        const result: McpCapabilities = {
          mcpTools: this._extractList(data, 'tools'),
          mcpPrompts: this._extractList(data, 'prompts'),
          mcpResources: this._extractList(data, 'resources'),
        };

        if (result.mcpTools?.length || result.mcpPrompts?.length || result.mcpResources?.length) {
          return result;
        }
      }
    } catch (error) {
      // Silently fail - soft failure pattern
    }

    return null;
  }

  /**
   * Try to fetch capabilities via JSON-RPC
   */
  private async _fetchViaJsonRpc(httpUrl: string): Promise<McpCapabilities | null> {
    try {
      // Make all JSON-RPC calls in parallel for better performance
      const [tools, resources, prompts] = await Promise.all([
        this._jsonRpcCall(httpUrl, 'tools/list'),
        this._jsonRpcCall(httpUrl, 'resources/list'),
        this._jsonRpcCall(httpUrl, 'prompts/list'),
      ]);

      const mcpTools: string[] = [];
      const mcpResources: string[] = [];
      const mcpPrompts: string[] = [];

      // Extract names from tools
      if (tools && typeof tools === 'object' && 'tools' in tools) {
        const toolsArray = (tools as any).tools;
        if (Array.isArray(toolsArray)) {
          for (const tool of toolsArray) {
            if (tool && typeof tool === 'object' && 'name' in tool) {
              mcpTools.push(tool.name);
            }
          }
        }
      }

      // Extract names from resources
      if (resources && typeof resources === 'object' && 'resources' in resources) {
        const resourcesArray = (resources as any).resources;
        if (Array.isArray(resourcesArray)) {
          for (const resource of resourcesArray) {
            if (resource && typeof resource === 'object' && 'name' in resource) {
              mcpResources.push(resource.name);
            }
          }
        }
      }

      // Extract names from prompts
      if (prompts && typeof prompts === 'object' && 'prompts' in prompts) {
        const promptsArray = (prompts as any).prompts;
        if (Array.isArray(promptsArray)) {
          for (const prompt of promptsArray) {
            if (prompt && typeof prompt === 'object' && 'name' in prompt) {
              mcpPrompts.push(prompt.name);
            }
          }
        }
      }

      if (mcpTools.length || mcpResources.length || mcpPrompts.length) {
        return {
          mcpTools: mcpTools.length > 0 ? mcpTools : undefined,
          mcpResources: mcpResources.length > 0 ? mcpResources : undefined,
          mcpPrompts: mcpPrompts.length > 0 ? mcpPrompts : undefined,
        };
      }
    } catch (error) {
      // JSON-RPC approach failed - continue to fallback
    }

    return null;
  }

  /**
   * Make a JSON-RPC call and return the result
   */
  private async _jsonRpcCall(url: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    try {
      const payload = createJsonRpcRequest(method, params);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        return null;
      }

      // Check if response is SSE format
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      if (contentType.includes('text/event-stream') || text.includes('event: message')) {
        // Parse SSE format
        const result = this._parseSseResponse(text);
        if (result) {
          return result;
        }
      }

      // Regular JSON response
      const result = JSON.parse(text);
      if (result.result !== undefined) {
        return result.result;
      }
      return result;
    } catch (error) {
      // JSON-RPC call failed - continue to next method
      return null;
    }
  }

  /**
   * Parse Server-Sent Events (SSE) format response
   */
  private _parseSseResponse(sseText: string): any | null {
    try {
      // Look for "data:" lines containing JSON
      const lines = sseText.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6); // Remove "data: " prefix
          const data = JSON.parse(jsonStr);
          if (data.result !== undefined) {
            return data.result;
          }
          return data;
        }
      }
    } catch (error) {
      // Failed to parse SSE response - continue
    }
    return null;
  }

  /**
   * Fetch A2A capabilities (skills) from an A2A server
   */
  async fetchA2aCapabilities(endpoint: string): Promise<A2aCapabilities | null> {
    try {
      // Ensure endpoint is HTTP/HTTPS
      if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
        // Invalid endpoint format - skip
        return null;
      }

      // Try multiple well-known paths for A2A agent cards
      const agentcardUrls = [
        `${endpoint}/agentcard.json`,
        `${endpoint}/.well-known/agent.json`,
        `${endpoint.replace(/\/$/, '')}/.well-known/agent.json`,
      ];

      for (const agentcardUrl of agentcardUrls) {
        try {
          const response = await fetch(agentcardUrl, {
            signal: AbortSignal.timeout(this.timeout),
            redirect: 'follow',
          });

          if (response.ok) {
            const data = await response.json();

            // Extract skills from agentcard
            const skills = this._extractList(data, 'skills');

            if (skills && skills.length > 0) {
              return { a2aSkills: skills };
            }
          }
        } catch {
          // Try next URL
          continue;
        }
      }
    } catch (error) {
      // Unexpected error - continue silently
    }

    return null;
  }

  /**
   * Extract a list of strings from nested JSON data
   */
  private _extractList(data: any, key: string): string[] {
    const result: string[] = [];

    // Try top-level key
    if (key in data && Array.isArray(data[key])) {
      for (const item of data[key]) {
        if (typeof item === 'string') {
          result.push(item);
        } else if (item && typeof item === 'object') {
          // For objects, try to extract name/id field
          const nameFields = ['name', 'id', 'identifier', 'title'];
          for (const nameField of nameFields) {
            if (nameField in item && typeof item[nameField] === 'string') {
              result.push(item[nameField]);
              break;
            }
          }
        }
      }
    }

    // Try nested in 'capabilities' or 'abilities'
    if (result.length === 0) {
      const containerKeys = ['capabilities', 'abilities', 'features'];
      for (const containerKey of containerKeys) {
        if (containerKey in data && data[containerKey] && typeof data[containerKey] === 'object') {
          if (key in data[containerKey] && Array.isArray(data[containerKey][key])) {
            for (const item of data[containerKey][key]) {
              if (typeof item === 'string') {
                result.push(item);
              } else if (item && typeof item === 'object') {
                const nameFields = ['name', 'id', 'identifier', 'title'];
                for (const nameField of nameFields) {
                  if (nameField in item && typeof item[nameField] === 'string') {
                    result.push(item[nameField]);
                    break;
                  }
                }
              }
            }
          }
          if (result.length > 0) {
            break;
          }
        }
      }
    }

    return result;
  }
}


```

`/Users/shawwalters/babylon/agent0-ts/src/core/feedback-manager.ts`:

```ts
/**
 * Feedback management system for Agent0 SDK
 */

import { ethers } from 'ethers';
import type {
  Feedback,
  SearchFeedbackParams,
  FeedbackIdTuple,
} from '../models/interfaces.js';
import type { AgentId, Address, URI, Timestamp, IdemKey } from '../models/types.js';
import type { Web3Client } from './web3-client.js';
import type { IPFSClient } from './ipfs-client.js';
import type { SubgraphClient } from './subgraph-client.js';
import { parseAgentId, formatAgentId, formatFeedbackId, parseFeedbackId } from '../utils/id-format.js';
import { DEFAULTS } from '../utils/constants.js';

export interface FeedbackAuth {
  agentId: bigint;
  clientAddress: Address;
  indexLimit: bigint;
  expiry: bigint;
  chainId: bigint;
  identityRegistry: Address;
  signerAddress: Address;
}

/**
 * Manages feedback operations for the Agent0 SDK
 */
export class FeedbackManager {
  private getSubgraphClientForChain?: (chainId?: number) => SubgraphClient | undefined;
  private defaultChainId?: number;

  constructor(
    private web3Client: Web3Client,
    private ipfsClient?: IPFSClient,
    private reputationRegistry?: ethers.Contract,
    private identityRegistry?: ethers.Contract,
    private subgraphClient?: SubgraphClient
  ) {}

  /**
   * Set function to get subgraph client for a specific chain (for multi-chain support)
   */
  setSubgraphClientGetter(
    getter: (chainId?: number) => SubgraphClient | undefined,
    defaultChainId: number
  ): void {
    this.getSubgraphClientForChain = getter;
    this.defaultChainId = defaultChainId;
  }

  /**
   * Set reputation registry contract (for lazy initialization)
   */
  setReputationRegistry(registry: ethers.Contract): void {
    this.reputationRegistry = registry;
  }

  /**
   * Set identity registry contract (for lazy initialization)
   */
  setIdentityRegistry(registry: ethers.Contract): void {
    this.identityRegistry = registry;
  }

  /**
   * Sign feedback authorization for a client
   */
  async signFeedbackAuth(
    agentId: AgentId,
    clientAddress: Address,
    indexLimit?: number,
    expiryHours: number = DEFAULTS.FEEDBACK_EXPIRY_HOURS
  ): Promise<string> {
    // Parse agent ID to get token ID
    const { tokenId } = parseAgentId(agentId);

    // Get current feedback index if not provided
    let indexLimitValue = indexLimit;
    if (indexLimitValue === undefined && this.reputationRegistry) {
      try {
        const lastIndex = await this.web3Client.callContract(
          this.reputationRegistry,
          'getLastIndex',
          BigInt(tokenId),
          clientAddress
        );
        indexLimitValue = Number(lastIndex) + 1;
      } catch {
        // If we can't get the index, default to 1 (for first feedback)
        indexLimitValue = 1;
      }
    } else if (indexLimitValue === undefined) {
      indexLimitValue = 1;
    }

    // Calculate expiry timestamp
    const expiry = BigInt(Math.floor(Date.now() / 1000) + expiryHours * 3600);

    // Get chain ID (await if needed)
    let chainId: bigint;
    if (this.web3Client.chainId === 0n) {
      await this.web3Client.initialize();
      chainId = this.web3Client.chainId;
    } else {
      chainId = this.web3Client.chainId;
    }

    const identityRegistryAddress = this.identityRegistry
      ? await this.identityRegistry.getAddress()
      : '0x0';
    const signerAddress = this.web3Client.address || '0x0';

    if (!signerAddress || signerAddress === '0x0') {
      throw new Error('No signer available for feedback authorization');
    }

    // Encode feedback auth data
    const authData = this.web3Client.encodeFeedbackAuth(
      BigInt(tokenId),
      clientAddress,
      BigInt(indexLimitValue),
      expiry,
      chainId,
      identityRegistryAddress,
      signerAddress
    );

    // Hash the encoded data (matching contract's keccak256(abi.encode(...)))
    // The contract expects: keccak256(abi.encode(...)) then signed with Ethereum message prefix
    const messageHash = ethers.keccak256(ethers.getBytes(authData));

    // Sign the hash (ethers.js will add the Ethereum signed message prefix automatically)
    const signature = await this.web3Client.signMessage(ethers.getBytes(messageHash));

    // Combine auth data and signature
    // Both are hex strings, combine them
    const authDataNoPrefix = authData.startsWith('0x') ? authData.slice(2) : authData;
    const sigNoPrefix = signature.startsWith('0x') ? signature.slice(2) : signature;
    return '0x' + authDataNoPrefix + sigNoPrefix;
  }

  /**
   * Prepare feedback file (local file/object) according to spec
   */
  prepareFeedback(
    agentId: AgentId,
    score?: number, // 0-100
    tags?: string[],
    text?: string,
    capability?: string,
    name?: string,
    skill?: string,
    task?: string,
    context?: Record<string, unknown>,
    proofOfPayment?: Record<string, unknown>,
    extra?: Record<string, unknown>
  ): Record<string, unknown> {
    const tagsArray = tags || [];

    // Parse agent ID to get token ID
    const { tokenId } = parseAgentId(agentId);

    // Get current timestamp in ISO format
    const createdAt = new Date().toISOString();

    // Determine chain ID and registry address
    const chainId = this.web3Client.chainId;
    const identityRegistryAddress = this.identityRegistry
      ? (this.identityRegistry.target as string)
      : '0x0';
    const clientAddress = this.web3Client.address || '0x0';

    // Build feedback data according to spec
    const feedbackData: Record<string, unknown> = {
      // MUST FIELDS
      agentRegistry: `eip155:${chainId}:${identityRegistryAddress}`,
      agentId: tokenId,
      clientAddress: `eip155:${chainId}:${clientAddress}`,
      createdAt,
      feedbackAuth: '', // Will be filled when giving feedback
      score: score !== undefined ? Math.round(score) : 0, // Score as integer (0-100)

      // MAY FIELDS
      tag1: tagsArray[0] || undefined,
      tag2: tagsArray.length > 1 ? tagsArray[1] : undefined,
      skill,
      context,
      task,
      capability,
      name,
      proofOfPayment: proofOfPayment,
    };

    // Remove undefined values to keep the structure clean
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(feedbackData)) {
      if (value !== undefined && value !== null) {
        cleaned[key] = value;
      }
    }

    if (extra) {
      Object.assign(cleaned, extra);
    }

    return cleaned;
  }

  /**
   * Give feedback (maps 8004 endpoint)
   */
  async giveFeedback(
    agentId: AgentId,
    feedbackFile: Record<string, unknown>,
    idem?: IdemKey,
    feedbackAuth?: string
  ): Promise<Feedback> {
    // Parse agent ID
    const { tokenId } = parseAgentId(agentId);

    // Get client address (the one giving feedback)
    const clientAddress = this.web3Client.address;
    if (!clientAddress) {
      throw new Error('No signer available. Cannot give feedback without a wallet.');
    }

    // Get current feedback index for this client-agent pair
    let feedbackIndex: number;
    try {
      if (!this.reputationRegistry) {
        throw new Error('Reputation registry not available');
      }
      const lastIndex = await this.web3Client.callContract(
        this.reputationRegistry,
        'getLastIndex',
        BigInt(tokenId),
        clientAddress
      );
      feedbackIndex = Number(lastIndex) + 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get feedback index: ${errorMessage}`);
    }

    // Prepare feedback auth (use provided auth or create new one)
    let authBytes: string;
    if (feedbackAuth) {
      authBytes = feedbackAuth;
    } else {
      const authHex = await this.signFeedbackAuth(agentId, clientAddress, feedbackIndex, 24);
      authBytes = authHex;
    }

    // Update feedback file with auth
    feedbackFile.feedbackAuth = authBytes.startsWith('0x') ? authBytes : '0x' + authBytes;

    // Prepare on-chain data (only basic fields, no capability/endpoint)
    const score = feedbackFile.score !== undefined ? Number(feedbackFile.score) : 0;
    const tag1Str = typeof feedbackFile.tag1 === 'string' ? feedbackFile.tag1 : '';
    const tag2Str = typeof feedbackFile.tag2 === 'string' ? feedbackFile.tag2 : '';
    const tag1 = this._stringToBytes32(tag1Str);
    const tag2 = this._stringToBytes32(tag2Str);

    // Handle off-chain file storage
    let feedbackUri = '';
    let feedbackHash = '0x' + '00'.repeat(32); // Default empty hash

    if (this.ipfsClient) {
      // Store feedback file on IPFS
      try {
        const cid = await this.ipfsClient.addJson(feedbackFile);
        feedbackUri = `ipfs://${cid}`;
        // Calculate hash of sorted JSON
        const sortedJson = JSON.stringify(feedbackFile, Object.keys(feedbackFile).sort());
        feedbackHash = this.web3Client.keccak256(sortedJson);
      } catch (error) {
        // Failed to store on IPFS - log error but continue without IPFS storage
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Feedback] Failed to store feedback file on IPFS: ${errorMessage}`);
        // Continue without IPFS storage - feedback will be stored on-chain only
      }
    } else if (feedbackFile.context || feedbackFile.capability || feedbackFile.name) {
      // If we have rich data but no IPFS, we need to store it somewhere
      throw new Error('Rich feedback data requires IPFS client for storage');
    }

    // Submit to blockchain
    if (!this.reputationRegistry) {
      throw new Error('Reputation registry not available');
    }

    try {
      const txHash = await this.web3Client.transactContract(
        this.reputationRegistry,
        'giveFeedback',
        {},
        BigInt(tokenId),
        score,
        tag1,
        tag2,
        feedbackUri,
        feedbackHash,
        ethers.getBytes(authBytes.startsWith('0x') ? authBytes : '0x' + authBytes)
      );

      // Wait for transaction confirmation
      await this.web3Client.waitForTransaction(txHash);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to submit feedback to blockchain: ${errorMessage}`);
    }

    // Create feedback object
    const parsedId = parseFeedbackId(formatFeedbackId(agentId, clientAddress, feedbackIndex));

    // Extract typed values from feedbackFile (Record<string, unknown>)
    const tag1Value = typeof feedbackFile.tag1 === 'string' ? feedbackFile.tag1 : undefined;
    const tag2Value = typeof feedbackFile.tag2 === 'string' ? feedbackFile.tag2 : undefined;
    const textValue = typeof feedbackFile.text === 'string' ? feedbackFile.text : undefined;
    const contextValue = feedbackFile.context && typeof feedbackFile.context === 'object' && !Array.isArray(feedbackFile.context)
      ? feedbackFile.context as Record<string, any>
      : undefined;
    const proofOfPaymentValue = feedbackFile.proofOfPayment && typeof feedbackFile.proofOfPayment === 'object' && !Array.isArray(feedbackFile.proofOfPayment)
      ? feedbackFile.proofOfPayment as Record<string, any>
      : undefined;

    return {
      id: [parsedId.agentId, parsedId.clientAddress, parsedId.feedbackIndex] as FeedbackIdTuple,
      agentId,
      reviewer: clientAddress,
      score: score > 0 ? score : undefined,
      tags: [tag1Value, tag2Value].filter(Boolean) as string[],
      text: textValue,
      context: contextValue,
      proofOfPayment: proofOfPaymentValue,
      fileURI: feedbackUri || undefined,
      createdAt: Math.floor(Date.now() / 1000),
      answers: [],
      isRevoked: false,
      // Off-chain only fields
      capability: typeof feedbackFile.capability === 'string' ? feedbackFile.capability : undefined,
      name: typeof feedbackFile.name === 'string' ? feedbackFile.name : undefined,
      skill: typeof feedbackFile.skill === 'string' ? feedbackFile.skill : undefined,
      task: typeof feedbackFile.task === 'string' ? feedbackFile.task : undefined,
    };
  }

  /**
   * Get single feedback with responses
   * Currently only supports blockchain query - subgraph support coming soon
   */
  async getFeedback(
    agentId: AgentId,
    clientAddress: Address,
    feedbackIndex: number
  ): Promise<Feedback> {
    return await this._getFeedbackFromBlockchain(agentId, clientAddress, feedbackIndex);
  }

  /**
   * Get feedback from blockchain
   */
  private async _getFeedbackFromBlockchain(
    agentId: AgentId,
    clientAddress: Address,
    feedbackIndex: number
  ): Promise<Feedback> {
    if (!this.reputationRegistry) {
      throw new Error('Reputation registry not available');
    }

    const { tokenId } = parseAgentId(agentId);

    try {
      const [score, tag1Bytes, tag2Bytes, isRevoked] = await this.web3Client.callContract(
        this.reputationRegistry,
        'readFeedback',
        BigInt(tokenId),
        clientAddress,
        BigInt(feedbackIndex)
      );

      const tags = this._bytes32ToTags(tag1Bytes, tag2Bytes);

      return {
        id: [agentId, clientAddress.toLowerCase(), feedbackIndex] as FeedbackIdTuple,
        agentId,
        reviewer: clientAddress,
        score: Number(score),
        tags,
        createdAt: Math.floor(Date.now() / 1000), // Approximate, could be improved
        answers: [],
        isRevoked: Boolean(isRevoked),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read feedback from blockchain: ${errorMessage}`);
    }
  }

  /**
   * Search feedback with filters
   * Uses subgraph if available, otherwise returns empty array
   * Supports chainId:agentId format in params.agents
   */
  async searchFeedback(params: SearchFeedbackParams): Promise<Feedback[]> {
    // Determine which subgraph client to use based on agentId chainId
    let subgraphClientToUse = this.subgraphClient;
    let formattedAgents: string[] | undefined;
    
    // If agents are specified, check if they have chainId prefixes
    if (params.agents && params.agents.length > 0 && this.getSubgraphClientForChain) {
      // Parse first agentId to determine chain
      const firstAgentId = params.agents[0];
      let chainId: number | undefined;
      let fullAgentId: string;
      
      if (firstAgentId.includes(':')) {
        const parsed = parseAgentId(firstAgentId);
        chainId = parsed.chainId;
        fullAgentId = firstAgentId;
        // Get subgraph client for the specified chain
        subgraphClientToUse = this.getSubgraphClientForChain(chainId);
        // Format all agentIds to ensure they have chainId prefix
        formattedAgents = params.agents.map(agentId => {
          if (agentId.includes(':')) {
            return agentId;
          } else {
            // Format with the same chainId as the first agent
            return formatAgentId(chainId!, parseInt(agentId, 10));
          }
        });
      } else {
        // Use default chain - format agentIds with default chainId
        chainId = this.defaultChainId;
        if (this.defaultChainId !== undefined) {
          formattedAgents = params.agents.map(agentId => {
            if (agentId.includes(':')) {
              return agentId;
            } else {
              return formatAgentId(this.defaultChainId!, parseInt(agentId, 10));
            }
          });
        } else {
          formattedAgents = params.agents;
        }
        // Don't change subgraphClientToUse - use the default one
      }
    } else {
      formattedAgents = params.agents;
    }

    if (!subgraphClientToUse) {
      // Fallback not implemented (would require blockchain queries)
      // For now, return empty if subgraph unavailable
      return [];
    }

    // Query subgraph
    const feedbacksData = await subgraphClientToUse.searchFeedback(
      {
        agents: formattedAgents || params.agents,
        reviewers: params.reviewers,
        tags: params.tags,
        capabilities: params.capabilities,
        skills: params.skills,
        tasks: params.tasks,
        names: params.names,
        minScore: params.minScore,
        maxScore: params.maxScore,
        includeRevoked: params.includeRevoked || false,
      },
      100, // first
      0, // skip
      'createdAt',
      'desc'
    );

    // Map to Feedback objects
    const feedbacks: Feedback[] = [];
    for (const fbData of feedbacksData) {
      // Parse agentId from feedback ID
      const feedbackId = fbData.id;
      const parts = feedbackId.split(':');
      let agentIdStr: string;
      let clientAddr: string;
      let feedbackIdx: number;

      if (parts.length >= 2) {
        agentIdStr = `${parts[0]}:${parts[1]}`;
        clientAddr = parts.length > 2 ? parts[2] : '';
        feedbackIdx = parts.length > 3 ? parseInt(parts[3], 10) : 1;
      } else {
        agentIdStr = feedbackId;
        clientAddr = '';
        feedbackIdx = 1;
      }

      const feedback = this._mapSubgraphFeedbackToModel(fbData, agentIdStr, clientAddr, feedbackIdx);
      feedbacks.push(feedback);
    }

    return feedbacks;
  }

  /**
   * Map subgraph feedback data to Feedback model
   */
  private _mapSubgraphFeedbackToModel(
    feedbackData: any,
    agentId: AgentId,
    clientAddress: Address,
    feedbackIndex: number
  ): Feedback {
    const feedbackFile = feedbackData.feedbackFile || {};

    // Map responses
    const responsesData = feedbackData.responses || [];
    const answers = responsesData.map((resp: any) => ({
      responder: resp.responder,
      responseUri: resp.responseUri,
      responseHash: resp.responseHash,
      createdAt: resp.createdAt ? parseInt(resp.createdAt, 10) : undefined,
    }));

    // Map tags - check if they're hex bytes32 or plain strings
    const tags: string[] = [];
    const tag1 = feedbackData.tag1 || feedbackFile.tag1;
    const tag2 = feedbackData.tag2 || feedbackFile.tag2;

    // Convert hex bytes32 to readable tags
    if (tag1 || tag2) {
      tags.push(...this._hexBytes32ToTags(tag1 || '', tag2 || ''));
    }

    // Build proof of payment object if available
    let proofOfPayment: Record<string, any> | undefined;
    if (feedbackFile.proofOfPaymentFromAddress) {
      proofOfPayment = {
        fromAddress: feedbackFile.proofOfPaymentFromAddress,
        toAddress: feedbackFile.proofOfPaymentToAddress,
        chainId: feedbackFile.proofOfPaymentChainId,
        txHash: feedbackFile.proofOfPaymentTxHash,
      };
    }

    // Build context object if available
    let context: Record<string, any> | undefined;
    if (feedbackFile.context) {
      try {
        context = typeof feedbackFile.context === 'string'
          ? JSON.parse(feedbackFile.context)
          : feedbackFile.context;
      } catch {
        context = { raw: feedbackFile.context };
      }
    }

    const id: FeedbackIdTuple = [agentId, clientAddress, feedbackIndex];

    return {
      id,
      agentId,
      reviewer: clientAddress,
      score: feedbackData.score !== undefined && feedbackData.score !== null ? Number(feedbackData.score) : undefined,
      tags,
      text: feedbackFile.text || undefined,
      context,
      proofOfPayment,
      fileURI: feedbackData.feedbackUri || undefined,
      createdAt: feedbackData.createdAt ? parseInt(feedbackData.createdAt, 10) : Math.floor(Date.now() / 1000),
      answers,
      isRevoked: feedbackData.isRevoked || false,
      capability: feedbackFile.capability || undefined,
      name: feedbackFile.name || undefined,
      skill: feedbackFile.skill || undefined,
      task: feedbackFile.task || undefined,
    };
  }

  /**
   * Convert hex bytes32 tags back to strings, or return plain strings as-is
   * The subgraph now stores tags as human-readable strings (not hex),
   * so this method handles both formats for backwards compatibility
   */
  private _hexBytes32ToTags(tag1: string, tag2: string): string[] {
    const tags: string[] = [];

    if (tag1 && tag1 !== '0x' + '00'.repeat(32)) {
      // If it's already a plain string (from subgraph), use it directly
      if (!tag1.startsWith('0x')) {
        if (tag1) {
          tags.push(tag1);
        }
      } else {
        // Try to convert from hex bytes32 (on-chain format)
        try {
          const hexBytes = ethers.getBytes(tag1);
          const tag1Str = new TextDecoder('utf-8', { fatal: false }).decode(
            hexBytes.filter((b) => b !== 0)
          );
          if (tag1Str) {
            tags.push(tag1Str);
          }
        } catch {
          // Ignore invalid hex strings
        }
      }
    }

    if (tag2 && tag2 !== '0x' + '00'.repeat(32)) {
      // If it's already a plain string (from subgraph), use it directly
      if (!tag2.startsWith('0x')) {
        if (tag2) {
          tags.push(tag2);
        }
      } else {
        // Try to convert from hex bytes32 (on-chain format)
        try {
          const hexBytes = ethers.getBytes(tag2);
          const tag2Str = new TextDecoder('utf-8', { fatal: false }).decode(
            hexBytes.filter((b) => b !== 0)
          );
          if (tag2Str) {
            tags.push(tag2Str);
          }
        } catch {
          // Ignore invalid hex strings
        }
      }
    }

    return tags;
  }

  /**
   * Append response to feedback
   */
  async appendResponse(
    agentId: AgentId,
    clientAddress: Address,
    feedbackIndex: number,
    responseUri: URI,
    responseHash: string
  ): Promise<string> {
    if (!this.reputationRegistry) {
      throw new Error('Reputation registry not available');
    }

    const { tokenId } = parseAgentId(agentId);

    try {
      const txHash = await this.web3Client.transactContract(
        this.reputationRegistry,
        'appendResponse',
        {},
        BigInt(tokenId),
        clientAddress,
        BigInt(feedbackIndex),
        responseUri,
        responseHash
      );

      return txHash;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to append response: ${errorMessage}`);
    }
  }

  /**
   * Revoke feedback
   */
  async revokeFeedback(agentId: AgentId, feedbackIndex: number): Promise<string> {
    if (!this.reputationRegistry) {
      throw new Error('Reputation registry not available');
    }

    const { tokenId } = parseAgentId(agentId);

    // Get client address (the one revoking - must be the reviewer)
    const clientAddress = this.web3Client.address;
    if (!clientAddress) {
      throw new Error('No signer available');
    }

    try {
      const txHash = await this.web3Client.transactContract(
        this.reputationRegistry,
        'revokeFeedback',
        {},
        BigInt(tokenId),
        BigInt(feedbackIndex)
      );

      return txHash;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to revoke feedback: ${errorMessage}`);
    }
  }

  /**
   * Convert string to bytes32 for blockchain storage
   */
  private _stringToBytes32(text: string): string {
    if (!text) {
      return '0x' + '00'.repeat(32);
    }

    // Encode as UTF-8 and pad/truncate to 32 bytes
    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);
    const padded = new Uint8Array(32);
    const length = Math.min(encoded.length, 32);
    padded.set(encoded.slice(0, length), 0);

    return ethers.hexlify(padded);
  }

  /**
   * Convert bytes32 tags back to strings
   */
  private _bytes32ToTags(tag1Bytes: string, tag2Bytes: string): string[] {
    const tags: string[] = [];

    if (tag1Bytes && tag1Bytes !== '0x' + '00'.repeat(32)) {
      try {
        const tag1 = ethers.toUtf8String(tag1Bytes).replace(/\0/g, '').trim();
        if (tag1) {
          tags.push(tag1);
        }
      } catch {
        // If UTF-8 decode fails, skip this tag
      }
    }

    if (tag2Bytes && tag2Bytes !== '0x' + '00'.repeat(32)) {
      try {
        const tag2 = ethers.toUtf8String(tag2Bytes).replace(/\0/g, '').trim();
        if (tag2) {
          tags.push(tag2);
        }
      } catch {
        // If UTF-8 decode fails, skip this tag
      }
    }

    return tags;
  }

  /**
   * Get reputation summary
   * Supports chainId:agentId format
   */
  async getReputationSummary(
    agentId: AgentId,
    tag1?: string,
    tag2?: string
  ): Promise<{ count: number; averageScore: number }> {
    // Parse chainId from agentId
    let chainId: number | undefined;
    let fullAgentId: string;
    let tokenId: number;
    
    let subgraphClient: SubgraphClient | undefined;
    
    if (agentId.includes(':')) {
      const parsed = parseAgentId(agentId);
      chainId = parsed.chainId;
      tokenId = parsed.tokenId;
      fullAgentId = agentId;
      // Get subgraph client for the specified chain
      if (this.getSubgraphClientForChain) {
        subgraphClient = this.getSubgraphClientForChain(chainId);
      }
    } else {
      // Use default chain
      chainId = this.defaultChainId;
      tokenId = parseInt(agentId, 10);
      if (this.defaultChainId !== undefined) {
        fullAgentId = formatAgentId(this.defaultChainId, tokenId);
      } else {
        // Fallback: use agentId as-is if no default chain
        fullAgentId = agentId;
      }
      // Use default subgraph client
      subgraphClient = this.subgraphClient;
    }

    // Try subgraph first if available
    if (subgraphClient) {
      try {
        // Use subgraph to calculate reputation
        // Query feedback for this agent
        const feedbacksData = await subgraphClient.searchFeedback(
            {
              agents: [fullAgentId],
            },
            1000, // first
            0, // skip
            'createdAt',
            'desc'
          );

          // Filter by tags if provided
          let filteredFeedbacks = feedbacksData;
          if (tag1 || tag2) {
            filteredFeedbacks = feedbacksData.filter((fb: any) => {
              const fbTag1 = fb.tag1 || '';
              const fbTag2 = fb.tag2 || '';
              if (tag1 && tag2) {
                return (fbTag1 === tag1 && fbTag2 === tag2) || (fbTag1 === tag2 && fbTag2 === tag1);
              } else if (tag1) {
                return fbTag1 === tag1 || fbTag2 === tag1;
              } else if (tag2) {
                return fbTag1 === tag2 || fbTag2 === tag2;
              }
              return true;
            });
          }

          // Filter out revoked feedback
          const validFeedbacks = filteredFeedbacks.filter((fb: any) => !fb.isRevoked);

          if (validFeedbacks.length > 0) {
            const scores = validFeedbacks
              .map((fb: any) => fb.score)
              .filter((score: any) => score !== null && score !== undefined && score > 0);
            
            if (scores.length > 0) {
              const sum = scores.reduce((a: number, b: number) => a + b, 0);
              const averageScore = sum / scores.length;
              return {
                count: validFeedbacks.length,
                averageScore: Math.round(averageScore * 100) / 100, // Round to 2 decimals
              };
            }
          }

        return { count: 0, averageScore: 0 };
      } catch (error) {
        // Fall through to blockchain query if subgraph fails
      }
    }

    // Fallback to blockchain query (requires matching chain)
    if (!this.reputationRegistry) {
      throw new Error('Reputation registry not available');
    }

    // For blockchain query, we need the chain to match the SDK's default chain
    // If chainId is specified and different, we can't use blockchain query
    if (chainId !== undefined && this.defaultChainId !== undefined && chainId !== this.defaultChainId) {
      throw new Error(
        `Blockchain reputation summary not supported for chain ${chainId}. ` +
        `SDK is configured for chain ${this.defaultChainId}. ` +
        `Use subgraph-based summary instead.`
      );
    }

    try {
      const tag1Bytes = tag1 ? this._stringToBytes32(tag1) : '0x' + '00'.repeat(32);
      const tag2Bytes = tag2 ? this._stringToBytes32(tag2) : '0x' + '00'.repeat(32);

      // Get all clients who gave feedback
      const clients = await this.web3Client.callContract(
        this.reputationRegistry,
        'getClients',
        BigInt(tokenId)
      );

      if (!Array.isArray(clients) || clients.length === 0) {
        return { count: 0, averageScore: 0 };
      }

      const [count, averageScore] = await this.web3Client.callContract(
        this.reputationRegistry,
        'getSummary',
        BigInt(tokenId),
        clients,
        tag1Bytes,
        tag2Bytes
      );

      return {
        count: Number(count),
        averageScore: Number(averageScore),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get reputation summary: ${errorMessage}`);
    }
  }
}


```

`/Users/shawwalters/babylon/agent0-ts/src/core/oasf-validator.ts`:

```ts
/**
 * OASF taxonomy validation utilities
 */

import allSkills from '../taxonomies/all_skills.json';
import allDomains from '../taxonomies/all_domains.json';

interface SkillsData {
  skills: Record<string, unknown>;
}

interface DomainsData {
  domains: Record<string, unknown>;
}

/**
 * Validate if a skill slug exists in the OASF taxonomy
 * @param slug The skill slug to validate (e.g., "natural_language_processing/summarization")
 * @returns True if the skill exists in the taxonomy, False otherwise
 */
export function validateSkill(slug: string): boolean {
  const skillsData = allSkills as SkillsData;
  const skills = skillsData.skills || {};
  return slug in skills;
}

/**
 * Validate if a domain slug exists in the OASF taxonomy
 * @param slug The domain slug to validate (e.g., "finance_and_business/investment_services")
 * @returns True if the domain exists in the taxonomy, False otherwise
 */
export function validateDomain(slug: string): boolean {
  const domainsData = allDomains as DomainsData;
  const domains = domainsData.domains || {};
  return slug in domains;
}


```

`/Users/shawwalters/babylon/agent0-ts/src/core/sdk.ts`:

```ts
/**
 * Main SDK class for Agent0
 */

import { ethers } from 'ethers';
import type {
  AgentSummary,
  Feedback,
  SearchParams,
  SearchFeedbackParams,
  SearchResultMeta,
  RegistrationFile,
  Endpoint,
} from '../models/interfaces.js';
import type { AgentRegistrationFile as SubgraphRegistrationFile } from '../models/generated/subgraph-types.js';
import type { AgentId, ChainId, Address, URI } from '../models/types.js';
import { EndpointType, TrustModel } from '../models/enums.js';
import { formatAgentId, parseAgentId } from '../utils/id-format.js';
import { IPFS_GATEWAYS, TIMEOUTS } from '../utils/constants.js';
import { Web3Client, type TransactionOptions } from './web3-client.js';
import { IPFSClient, type IPFSClientConfig } from './ipfs-client.js';
import { SubgraphClient } from './subgraph-client.js';
import { FeedbackManager } from './feedback-manager.js';
import { AgentIndexer } from './indexer.js';
import { Agent } from './agent.js';
import {
  IDENTITY_REGISTRY_ABI,
  REPUTATION_REGISTRY_ABI,
  VALIDATION_REGISTRY_ABI,
  DEFAULT_REGISTRIES,
  DEFAULT_SUBGRAPH_URLS,
} from './contracts.js';

export interface SDKConfig {
  chainId: ChainId;
  rpcUrl: string;
  signer?: string | ethers.Wallet | ethers.Signer; // Private key string OR ethers Wallet/Signer (optional for read-only operations)
  registryOverrides?: Record<ChainId, Record<string, Address>>;
  // IPFS configuration
  ipfs?: 'node' | 'filecoinPin' | 'pinata';
  ipfsNodeUrl?: string;
  filecoinPrivateKey?: string;
  pinataJwt?: string;
  // Subgraph configuration
  subgraphUrl?: string;
  subgraphOverrides?: Record<ChainId, string>;
}

/**
 * Main SDK class for Agent0
 */
export class SDK {
  private readonly _web3Client: Web3Client;
  private _ipfsClient?: IPFSClient;
  private _subgraphClient?: SubgraphClient;
  private readonly _feedbackManager: FeedbackManager;
  private readonly _indexer: AgentIndexer;
  private _identityRegistry?: ethers.Contract;
  private _reputationRegistry?: ethers.Contract;
  private _validationRegistry?: ethers.Contract;
  private readonly _registries: Record<string, Address>;
  private readonly _chainId: ChainId;
  private readonly _subgraphUrls: Record<ChainId, string> = {};

  constructor(config: SDKConfig) {
    this._chainId = config.chainId;

    // Initialize Web3 client
    this._web3Client = new Web3Client(config.rpcUrl, config.signer);
    // Note: chainId will be fetched asynchronously on first use

    // Resolve registry addresses
    const registryOverrides = config.registryOverrides || {};
    const defaultRegistries = DEFAULT_REGISTRIES[config.chainId] || {};
    this._registries = { ...defaultRegistries, ...(registryOverrides[config.chainId] || {}) };

    // Resolve subgraph URL
    if (config.subgraphOverrides) {
      Object.assign(this._subgraphUrls, config.subgraphOverrides);
    }

    let resolvedSubgraphUrl: string | undefined;
    if (config.chainId in this._subgraphUrls) {
      resolvedSubgraphUrl = this._subgraphUrls[config.chainId];
    } else if (config.chainId in DEFAULT_SUBGRAPH_URLS) {
      resolvedSubgraphUrl = DEFAULT_SUBGRAPH_URLS[config.chainId];
    } else if (config.subgraphUrl) {
      resolvedSubgraphUrl = config.subgraphUrl;
    }

    // Initialize subgraph client if URL available
    if (resolvedSubgraphUrl) {
      this._subgraphClient = new SubgraphClient(resolvedSubgraphUrl);
    }

    // Initialize indexer
    this._indexer = new AgentIndexer(this._web3Client, this._subgraphClient, this._subgraphUrls);

    // Initialize IPFS client
    if (config.ipfs) {
      this._ipfsClient = this._initializeIpfsClient(config);
    }

    // Initialize feedback manager (will set registries after they're created)
    this._feedbackManager = new FeedbackManager(
      this._web3Client,
      this._ipfsClient,
      undefined, // reputationRegistry - will be set lazily
      undefined, // identityRegistry - will be set lazily
      this._subgraphClient
    );

    // Set subgraph client getter for multi-chain support
    this._feedbackManager.setSubgraphClientGetter(
      (chainId) => this.getSubgraphClient(chainId),
      this._chainId
    );
  }

  /**
   * Initialize IPFS client based on configuration
   */
  private _initializeIpfsClient(config: SDKConfig): IPFSClient {
    if (!config.ipfs) {
      throw new Error('IPFS provider not specified');
    }

    const ipfsConfig: IPFSClientConfig = {};

    if (config.ipfs === 'node') {
      if (!config.ipfsNodeUrl) {
        throw new Error("ipfsNodeUrl is required when ipfs='node'");
      }
      ipfsConfig.url = config.ipfsNodeUrl;
    } else if (config.ipfs === 'filecoinPin') {
      if (!config.filecoinPrivateKey) {
        throw new Error("filecoinPrivateKey is required when ipfs='filecoinPin'");
      }
      ipfsConfig.filecoinPinEnabled = true;
      ipfsConfig.filecoinPrivateKey = config.filecoinPrivateKey;
    } else if (config.ipfs === 'pinata') {
      if (!config.pinataJwt) {
        throw new Error("pinataJwt is required when ipfs='pinata'");
      }
      ipfsConfig.pinataEnabled = true;
      ipfsConfig.pinataJwt = config.pinataJwt;
    } else {
      throw new Error(`Invalid ipfs value: ${config.ipfs}. Must be 'node', 'filecoinPin', or 'pinata'`);
    }

    return new IPFSClient(ipfsConfig);
  }

  /**
   * Get current chain ID
   */
  async chainId(): Promise<ChainId> {
    if (this._web3Client.chainId === 0n) {
      await this._web3Client.initialize();
    }
    return Number(this._web3Client.chainId);
  }

  /**
   * Get resolved registry addresses for current chain
   */
  registries(): Record<string, Address> {
    return { ...this._registries };
  }

  /**
   * Get subgraph client for a specific chain
   */
  getSubgraphClient(chainId?: ChainId): SubgraphClient | undefined {
    const targetChain = chainId !== undefined ? chainId : this._chainId;

    // Check if we already have a client for this chain
    if (targetChain === this._chainId && this._subgraphClient) {
      return this._subgraphClient;
    }

    // Resolve URL for target chain
    let url: string | undefined;
    if (targetChain in this._subgraphUrls) {
      url = this._subgraphUrls[targetChain];
    } else if (targetChain in DEFAULT_SUBGRAPH_URLS) {
      url = DEFAULT_SUBGRAPH_URLS[targetChain];
    }

    if (url) {
      return new SubgraphClient(url);
    }
    return undefined;
  }

  /**
   * Get identity registry contract
   */
  getIdentityRegistry(): ethers.Contract {
    if (!this._identityRegistry) {
      const address = this._registries.IDENTITY;
      if (!address) {
        throw new Error(`No identity registry address for chain ${this._chainId}`);
      }
      this._identityRegistry = this._web3Client.getContract(address, IDENTITY_REGISTRY_ABI);
    }
    return this._identityRegistry;
  }

  /**
   * Get reputation registry contract
   */
  getReputationRegistry(): ethers.Contract {
    if (!this._reputationRegistry) {
      const address = this._registries.REPUTATION;
      if (!address) {
        throw new Error(`No reputation registry address for chain ${this._chainId}`);
      }
      this._reputationRegistry = this._web3Client.getContract(address, REPUTATION_REGISTRY_ABI);

      // Update feedback manager
      this._feedbackManager.setReputationRegistry(this._reputationRegistry);
    }
    return this._reputationRegistry;
  }

  /**
   * Get validation registry contract
   */
  getValidationRegistry(): ethers.Contract {
    if (!this._validationRegistry) {
      const address = this._registries.VALIDATION;
      if (!address) {
        throw new Error(`No validation registry address for chain ${this._chainId}`);
      }
      this._validationRegistry = this._web3Client.getContract(address, VALIDATION_REGISTRY_ABI);
    }
    return this._validationRegistry;
  }

  /**
   * Check if SDK is in read-only mode (no signer)
   */
  get isReadOnly(): boolean {
    return !this._web3Client.address;
  }

  // Agent lifecycle methods

  /**
   * Create a new agent (off-chain object in memory)
   */
  createAgent(name: string, description: string, image?: URI): Agent {
    const registrationFile: RegistrationFile = {
      name,
      description,
      image,
      endpoints: [],
      trustModels: [],
      owners: [],
      operators: [],
      active: false,
      x402support: false,
      metadata: {},
      updatedAt: Math.floor(Date.now() / 1000),
    };
    return new Agent(this, registrationFile);
  }

  /**
   * Load an existing agent (hydrates from registration file if registered)
   */
  async loadAgent(agentId: AgentId): Promise<Agent> {
    // Parse agent ID
    const { chainId, tokenId } = parseAgentId(agentId);

    const currentChainId = await this.chainId();
    if (chainId !== currentChainId) {
      throw new Error(`Agent ${agentId} is not on current chain ${currentChainId}`);
    }

    // Get token URI from contract
    let tokenUri: string;
    try {
      const identityRegistry = this.getIdentityRegistry();
      tokenUri = await this._web3Client.callContract(identityRegistry, 'tokenURI', BigInt(tokenId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load agent ${agentId}: ${errorMessage}`);
    }

    // Load registration file - handle empty URI (agent registered without URI yet)
    let registrationFile: RegistrationFile;
    if (!tokenUri || tokenUri === '') {
      // Agent registered but no URI set yet - create empty registration file
      registrationFile = this._createEmptyRegistrationFile();
    } else {
      registrationFile = await this._loadRegistrationFile(tokenUri);
    }
    
    registrationFile.agentId = agentId;
    registrationFile.agentURI = tokenUri || undefined;

    return new Agent(this, registrationFile);
  }

  /**
   * Get agent summary from subgraph (read-only)
   * Supports both default chain and explicit chain specification via chainId:tokenId format
   */
  async getAgent(agentId: AgentId): Promise<AgentSummary | null> {
    // Parse agentId to extract chainId if present
    // If no colon, assume it's just tokenId on default chain
    let parsedChainId: number;
    let formattedAgentId: string;
    
    if (agentId.includes(':')) {
      const parsed = parseAgentId(agentId);
      parsedChainId = parsed.chainId;
      formattedAgentId = agentId; // Already in correct format
    } else {
      // No colon - use default chain
      parsedChainId = this._chainId;
      formattedAgentId = formatAgentId(this._chainId, parseInt(agentId, 10));
    }
    
    // Determine which chain to query
    const targetChainId = parsedChainId !== this._chainId ? parsedChainId : undefined;
    
    // Get subgraph client for the target chain (or use default)
    const subgraphClient = targetChainId
      ? this.getSubgraphClient(targetChainId)
      : this._subgraphClient;
    
    if (!subgraphClient) {
      throw new Error(`Subgraph client required for getAgent on chain ${targetChainId || this._chainId}`);
    }
    
    return subgraphClient.getAgentById(formattedAgentId);
  }

  /**
   * Search agents with filters
   * Supports multi-chain search when chains parameter is provided
   */
  async searchAgents(
    params?: SearchParams,
    sort?: string[],
    pageSize: number = 50,
    cursor?: string
  ): Promise<{ items: AgentSummary[]; nextCursor?: string; meta?: SearchResultMeta }> {
    const searchParams: SearchParams = params || {};
    return this._indexer.searchAgents(searchParams, pageSize, cursor, sort || []);
  }

  /**
   * Search agents by reputation
   * Supports multi-chain search when chains parameter is provided
   */
  async searchAgentsByReputation(
    agents?: AgentId[],
    tags?: string[],
    reviewers?: Address[],
    capabilities?: string[],
    skills?: string[],
    tasks?: string[],
    names?: string[],
    minAverageScore?: number,
    includeRevoked: boolean = false,
    pageSize: number = 50,
    cursor?: string,
    sort?: string[],
    chains?: ChainId[] | 'all'
  ): Promise<{ items: AgentSummary[]; nextCursor?: string; meta?: SearchResultMeta }> {
    // Parse cursor to skip value
    let skip = 0;
    if (cursor) {
      try {
        skip = parseInt(cursor, 10);
      } catch {
        skip = 0;
      }
    }

    // Default sort
    if (!sort) {
      sort = ['createdAt:desc'];
    }

    return this._indexer.searchAgentsByReputation(
      agents,
      tags,
      reviewers,
      capabilities,
      skills,
      tasks,
      names,
      minAverageScore,
      includeRevoked,
      pageSize,
      skip,
      sort,
      chains
    );
  }

  /**
   * Transfer agent ownership
   */
  async transferAgent(agentId: AgentId, newOwner: Address): Promise<{
    txHash: string;
    from: Address;
    to: Address;
    agentId: AgentId;
  }> {
    const agent = await this.loadAgent(agentId);
    return agent.transfer(newOwner);
  }

  /**
   * Check if address is agent owner
   */
  async isAgentOwner(agentId: AgentId, address: Address): Promise<boolean> {
    const { tokenId } = parseAgentId(agentId);
    const identityRegistry = this.getIdentityRegistry();
    const owner = await this._web3Client.callContract(identityRegistry, 'ownerOf', BigInt(tokenId));
    return owner.toLowerCase() === address.toLowerCase();
  }

  /**
   * Get agent owner
   */
  async getAgentOwner(agentId: AgentId): Promise<Address> {
    const { tokenId } = parseAgentId(agentId);
    const identityRegistry = this.getIdentityRegistry();
    return await this._web3Client.callContract(identityRegistry, 'ownerOf', BigInt(tokenId));
  }

  // Feedback methods

  /**
   * Sign feedback authorization for a client
   */
  async signFeedbackAuth(
    agentId: AgentId,
    clientAddress: Address,
    indexLimit?: number,
    expiryHours: number = 24
  ): Promise<string> {
    // Update feedback manager with registries
    this._feedbackManager.setReputationRegistry(this.getReputationRegistry());
    this._feedbackManager.setIdentityRegistry(this.getIdentityRegistry());

    return this._feedbackManager.signFeedbackAuth(agentId, clientAddress, indexLimit, expiryHours);
  }

  /**
   * Prepare feedback file
   */
  prepareFeedback(
    agentId: AgentId,
    score?: number,
    tags?: string[],
    text?: string,
    capability?: string,
    name?: string,
    skill?: string,
    task?: string,
    context?: Record<string, unknown>,
    proofOfPayment?: Record<string, unknown>,
    extra?: Record<string, unknown>
  ): Record<string, unknown> {
    return this._feedbackManager.prepareFeedback(
      agentId,
      score,
      tags,
      text,
      capability,
      name,
      skill,
      task,
      context,
      proofOfPayment,
      extra
    );
  }

  /**
   * Give feedback
   */
  async giveFeedback(
    agentId: AgentId,
    feedbackFile: Record<string, unknown>,
    feedbackAuth?: string
  ): Promise<Feedback> {
    // Update feedback manager with registries
    this._feedbackManager.setReputationRegistry(this.getReputationRegistry());
    this._feedbackManager.setIdentityRegistry(this.getIdentityRegistry());

    return this._feedbackManager.giveFeedback(agentId, feedbackFile, undefined, feedbackAuth);
  }

  /**
   * Read feedback
   */
  async getFeedback(agentId: AgentId, clientAddress: Address, feedbackIndex: number): Promise<Feedback> {
    return this._feedbackManager.getFeedback(agentId, clientAddress, feedbackIndex);
  }

  /**
   * Search feedback
   */
  async searchFeedback(
    agentId: AgentId,
    tags?: string[],
    capabilities?: string[],
    skills?: string[],
    minScore?: number,
    maxScore?: number
  ): Promise<Feedback[]> {
    const params: SearchFeedbackParams = {
      agents: [agentId],
      tags,
      capabilities,
      skills,
      minScore,
      maxScore,
    };
    return this._feedbackManager.searchFeedback(params);
  }

  /**
   * Append response to feedback
   */
  async appendResponse(
    agentId: AgentId,
    clientAddress: Address,
    feedbackIndex: number,
    response: { uri: URI; hash: string }
  ): Promise<string> {
    // Update feedback manager with registries
    this._feedbackManager.setReputationRegistry(this.getReputationRegistry());

    return this._feedbackManager.appendResponse(agentId, clientAddress, feedbackIndex, response.uri, response.hash);
  }

  /**
   * Revoke feedback
   */
  async revokeFeedback(agentId: AgentId, feedbackIndex: number): Promise<string> {
    // Update feedback manager with registries
    this._feedbackManager.setReputationRegistry(this.getReputationRegistry());

    return this._feedbackManager.revokeFeedback(agentId, feedbackIndex);
  }

  /**
   * Get reputation summary
   */
  async getReputationSummary(
    agentId: AgentId,
    tag1?: string,
    tag2?: string
  ): Promise<{ count: number; averageScore: number }> {
    // Update feedback manager with registries
    this._feedbackManager.setReputationRegistry(this.getReputationRegistry());

    return this._feedbackManager.getReputationSummary(agentId, tag1, tag2);
  }

  /**
   * Create an empty registration file structure
   */
  private _createEmptyRegistrationFile(): RegistrationFile {
    return {
      name: '',
      description: '',
      endpoints: [],
      trustModels: [],
      owners: [],
      operators: [],
      active: false,
      x402support: false,
      metadata: {},
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Private helper methods
   */
  private async _loadRegistrationFile(tokenUri: string): Promise<RegistrationFile> {
    try {
      // Fetch from IPFS or HTTP
      let rawData: unknown;
      if (tokenUri.startsWith('ipfs://')) {
        const cid = tokenUri.slice(7);
        if (this._ipfsClient) {
          // Use IPFS client if available
          rawData = await this._ipfsClient.getJson(cid);
        } else {
          // Fallback to HTTP gateways if no IPFS client configured
          const gateways = IPFS_GATEWAYS.map(gateway => `${gateway}${cid}`);
          
          let fetched = false;
          for (const gateway of gateways) {
            try {
              const response = await fetch(gateway, {
                signal: AbortSignal.timeout(TIMEOUTS.IPFS_GATEWAY),
              });
              if (response.ok) {
                rawData = await response.json();
                fetched = true;
                break;
              }
            } catch {
              continue;
            }
          }
          
          if (!fetched) {
            throw new Error('Failed to retrieve data from all IPFS gateways');
          }
        }
      } else if (tokenUri.startsWith('http://') || tokenUri.startsWith('https://')) {
        const response = await fetch(tokenUri);
        if (!response.ok) {
          throw new Error(`Failed to fetch registration file: HTTP ${response.status}`);
        }
        rawData = await response.json();
      } else if (tokenUri.startsWith('data:')) {
        // Data URIs are not supported
        throw new Error(`Data URIs are not supported. Expected HTTP(S) or IPFS URI, got: ${tokenUri}`);
      } else if (!tokenUri || tokenUri.trim() === '') {
        // Empty URI - return empty registration file (agent registered without URI)
        return this._createEmptyRegistrationFile();
      } else {
        throw new Error(`Unsupported URI scheme: ${tokenUri}`);
      }

      // Validate rawData is an object before transformation
      if (typeof rawData !== 'object' || rawData === null || Array.isArray(rawData)) {
        throw new Error('Invalid registration file format: expected an object');
      }

      // Transform IPFS/HTTP file format to RegistrationFile format
      return this._transformRegistrationFile(rawData as Record<string, unknown>);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load registration file: ${errorMessage}`);
    }
  }

  /**
   * Transform raw registration file (from IPFS/HTTP) to RegistrationFile format
   * Accepts raw JSON data which may have legacy format or new format
   */
  private _transformRegistrationFile(rawData: Record<string, unknown>): RegistrationFile {
    const endpoints = this._transformEndpoints(rawData);
    const { walletAddress, walletChainId } = this._extractWalletInfo(rawData);
    
    // Extract trust models with proper type checking
    const trustModels: (TrustModel | string)[] = Array.isArray(rawData.supportedTrust)
      ? rawData.supportedTrust
      : Array.isArray(rawData.trustModels)
      ? rawData.trustModels
      : [];

    return {
      name: typeof rawData.name === 'string' ? rawData.name : '',
      description: typeof rawData.description === 'string' ? rawData.description : '',
      image: typeof rawData.image === 'string' ? rawData.image : undefined,
      endpoints,
      trustModels,
      owners: Array.isArray(rawData.owners) ? rawData.owners.filter((o): o is Address => typeof o === 'string') : [],
      operators: Array.isArray(rawData.operators) ? rawData.operators.filter((o): o is Address => typeof o === 'string') : [],
      active: typeof rawData.active === 'boolean' ? rawData.active : false,
      x402support: typeof rawData.x402support === 'boolean' ? rawData.x402support : false,
      metadata: typeof rawData.metadata === 'object' && rawData.metadata !== null && !Array.isArray(rawData.metadata) 
        ? rawData.metadata as Record<string, unknown>
        : {},
      updatedAt: typeof rawData.updatedAt === 'number' ? rawData.updatedAt : Math.floor(Date.now() / 1000),
      walletAddress,
      walletChainId,
    };
  }

  /**
   * Transform endpoints from old format { name, endpoint, version } to new format { type, value, meta }
   */
  private _transformEndpoints(rawData: Record<string, unknown>): Endpoint[] {
    const endpoints: Endpoint[] = [];
    
    if (!rawData.endpoints || !Array.isArray(rawData.endpoints)) {
      return endpoints;
    }
    
    for (const ep of rawData.endpoints) {
      // Check if it's already in the new format
      if (ep.type && ep.value !== undefined) {
        endpoints.push({
          type: ep.type as EndpointType,
          value: ep.value,
          meta: ep.meta,
        } as Endpoint);
      } else {
        // Transform from old format
        const transformed = this._transformEndpointLegacy(ep, rawData);
        if (transformed) {
          endpoints.push(transformed);
        }
      }
    }
    
    return endpoints;
  }

  /**
   * Transform a single endpoint from legacy format
   */
  private _transformEndpointLegacy(ep: Record<string, unknown>, rawData: Record<string, unknown>): Endpoint | null {
    const name = typeof ep.name === 'string' ? ep.name : '';
    const value = typeof ep.endpoint === 'string' ? ep.endpoint : '';
    const version = typeof ep.version === 'string' ? ep.version : undefined;

    // Map endpoint names to types using case-insensitive lookup
    const nameLower = name.toLowerCase();
    const ENDPOINT_TYPE_MAP: Record<string, EndpointType> = {
      'mcp': EndpointType.MCP,
      'a2a': EndpointType.A2A,
      'ens': EndpointType.ENS,
      'did': EndpointType.DID,
      'agentwallet': EndpointType.WALLET,
      'wallet': EndpointType.WALLET,
    };

    let type: string;
    if (ENDPOINT_TYPE_MAP[nameLower]) {
      type = ENDPOINT_TYPE_MAP[nameLower];
      
      // Special handling for wallet endpoints - parse eip155 format
      if (type === EndpointType.WALLET) {
        const walletMatch = value.match(/eip155:(\d+):(0x[a-fA-F0-9]{40})/);
        if (walletMatch) {
          rawData._walletAddress = walletMatch[2];
          rawData._walletChainId = parseInt(walletMatch[1], 10);
        }
      }
    } else {
      type = name; // Fallback to name as type
    }

    return {
      type: type as EndpointType,
      value,
      meta: version ? { version } : undefined,
    } as Endpoint;
  }

  /**
   * Extract wallet address and chain ID from raw data
   */
  private _extractWalletInfo(rawData: Record<string, unknown>): { walletAddress?: string; walletChainId?: number } {
    // Priority: extracted from endpoints > direct fields
    if (typeof rawData._walletAddress === 'string' && typeof rawData._walletChainId === 'number') {
      return {
        walletAddress: rawData._walletAddress,
        walletChainId: rawData._walletChainId,
      };
    }
    
    if (typeof rawData.walletAddress === 'string' && typeof rawData.walletChainId === 'number') {
      return {
        walletAddress: rawData.walletAddress,
        walletChainId: rawData.walletChainId,
      };
    }
    
    return {};
  }

  // Expose clients for advanced usage
  get web3Client(): Web3Client {
    return this._web3Client;
  }

  get ipfsClient(): IPFSClient | undefined {
    return this._ipfsClient;
  }

  get subgraphClient(): SubgraphClient | undefined {
    return this._subgraphClient;
  }
}


```

`/Users/shawwalters/babylon/agent0-ts/src/utils/validation.ts`:

```ts
/**
 * Validation utilities
 */

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  // Ethereum address: 0x followed by 40 hex characters
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate AgentId format
 * Format: "chainId:tokenId" where both are positive integers
 */
export function isValidAgentId(agentId: string): boolean {
  if (!agentId || typeof agentId !== 'string') {
    return false;
  }
  const parts = agentId.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const chainId = parseInt(parts[0], 10);
  const tokenId = parseInt(parts[1], 10);
  return !isNaN(chainId) && !isNaN(tokenId) && chainId > 0 && tokenId >= 0;
}

/**
 * Validate URI format (basic validation)
 */
export function isValidURI(uri: string): boolean {
  if (!uri || typeof uri !== 'string') {
    return false;
  }
  try {
    const url = new URL(uri);
    return url.protocol === 'http:' || url.protocol === 'https:' || uri.startsWith('ipfs://');
  } catch {
    // If URL parsing fails, it might still be a valid IPFS URI
    return uri.startsWith('ipfs://') || uri.startsWith('/ipfs/');
  }
}

/**
 * Validate feedback score (0-100)
 */
export function isValidScore(score: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= 100;
}

/**
 * Normalize address to lowercase for consistent storage and comparison
 */
export function normalizeAddress(address: string): string {
  if (address.startsWith('0x') || address.startsWith('0X')) {
    return '0x' + address.slice(2).toLowerCase();
  }
  return address.toLowerCase();
}


```

`/Users/shawwalters/babylon/agent0-ts/src/utils/id-format.ts`:

```ts
/**
 * Utility functions for parsing and formatting Agent IDs and Feedback IDs
 */

import { normalizeAddress } from './validation.js';

/**
 * Parse an AgentId string into chainId and tokenId
 * Format: "chainId:tokenId" or just "tokenId" (when chain is implicit)
 */
export function parseAgentId(agentId: string | null | undefined): { chainId: number; tokenId: number } {
  if (!agentId || typeof agentId !== 'string') {
    throw new Error(`Invalid AgentId: ${agentId}. Expected a non-empty string in format "chainId:tokenId"`);
  }
  
  if (agentId.includes(':')) {
    const [chainId, tokenId] = agentId.split(':');
    const parsedChainId = parseInt(chainId, 10);
    const parsedTokenId = parseInt(tokenId, 10);
    
    if (isNaN(parsedChainId) || isNaN(parsedTokenId)) {
      throw new Error(`Invalid AgentId format: ${agentId}. ChainId and tokenId must be valid numbers`);
    }
    
    return {
      chainId: parsedChainId,
      tokenId: parsedTokenId,
    };
  }
  throw new Error(`Invalid AgentId format: ${agentId}. Expected "chainId:tokenId"`);
}

/**
 * Format chainId and tokenId into AgentId string
 */
export function formatAgentId(chainId: number, tokenId: number): string {
  return `${chainId}:${tokenId}`;
}

/**
 * Parse a FeedbackId string into its components
 * Format: "agentId:clientAddress:feedbackIndex"
 * Note: agentId may contain colons (e.g., "11155111:123"), so we split from the right
 */
export function parseFeedbackId(feedbackId: string): {
  agentId: string;
  clientAddress: string;
  feedbackIndex: number;
} {
  const lastColonIndex = feedbackId.lastIndexOf(':');
  const secondLastColonIndex = feedbackId.lastIndexOf(':', lastColonIndex - 1);

  if (lastColonIndex === -1 || secondLastColonIndex === -1) {
    throw new Error(`Invalid feedback ID format: ${feedbackId}`);
  }

  const agentId = feedbackId.slice(0, secondLastColonIndex);
  const clientAddress = feedbackId.slice(secondLastColonIndex + 1, lastColonIndex);
  const feedbackIndexStr = feedbackId.slice(lastColonIndex + 1);

  const feedbackIndex = parseInt(feedbackIndexStr, 10);
  if (isNaN(feedbackIndex)) {
    throw new Error(`Invalid feedback index: ${feedbackIndexStr}`);
  }

  // Normalize address to lowercase for consistency
  const normalizedAddress = normalizeAddress(clientAddress);

  return {
    agentId,
    clientAddress: normalizedAddress,
    feedbackIndex,
  };
}

/**
 * Format feedback ID components into FeedbackId string
 */
export function formatFeedbackId(
  agentId: string,
  clientAddress: string,
  feedbackIndex: number
): string {
  // Normalize address to lowercase
  const normalizedAddress = normalizeAddress(clientAddress);

  return `${agentId}:${normalizedAddress}:${feedbackIndex}`;
}


```

`/Users/shawwalters/babylon/agent0-ts/src/utils/constants.ts`:

```ts
/**
 * Shared constants for Agent0 SDK
 */

/**
 * IPFS gateway URLs for fallback retrieval
 */
export const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
] as const;

/**
 * Timeout values in milliseconds
 */
export const TIMEOUTS = {
  IPFS_GATEWAY: 10000, // 10 seconds
  PINATA_UPLOAD: 80000, // 80 seconds
  TRANSACTION_WAIT: 30000, // 30 seconds
  ENDPOINT_CRAWLER_DEFAULT: 5000, // 5 seconds
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  FEEDBACK_EXPIRY_HOURS: 24,
  SEARCH_PAGE_SIZE: 50,
} as const;


```

`/Users/shawwalters/babylon/agent0-ts/src/utils/index.ts`:

```ts
/**
 * Utility functions
 */

export * from './id-format.js';
export * from './validation.js';
export * from './constants.js';


```

`/Users/shawwalters/babylon/agent0-ts/src/models/types.ts`:

```ts
/**
 * Type aliases for Agent0 SDK
 */

// AgentId format: "chainId:tokenId" (e.g., "8453:1234") or just tokenId when chain is implicit
export type AgentId = string;

// Chain ID (numeric)
export type ChainId = number;

// Ethereum address (0x-hex format)
export type Address = string;

// URI (https://... or ipfs://...)
export type URI = string;

// IPFS CID (if used)
export type CID = string;

// Unix timestamp in seconds
export type Timestamp = number;

// Idempotency key for write operations
export type IdemKey = string;


```

`/Users/shawwalters/babylon/agent0-ts/src/models/index.ts`:

```ts
/**
 * Agent0 SDK Models
 * Re-exports all types, interfaces, and enums
 */

export * from './types.js';
export * from './enums.js';
export * from './interfaces.js';


```

`/Users/shawwalters/babylon/agent0-ts/src/models/enums.ts`:

```ts
/**
 * Enums for Agent0 SDK
 */

/**
 * Types of endpoints that agents can advertise
 */
export enum EndpointType {
  MCP = 'MCP',
  A2A = 'A2A',
  ENS = 'ENS',
  DID = 'DID',
  WALLET = 'wallet',
  OASF = 'OASF',
}

/**
 * Trust models supported by the SDK
 */
export enum TrustModel {
  REPUTATION = 'reputation',
  CRYPTO_ECONOMIC = 'crypto-economic',
  TEE_ATTESTATION = 'tee-attestation',
}


```

`/Users/shawwalters/babylon/agent0-ts/src/models/interfaces.ts`:

```ts
/**
 * Core interfaces for Agent0 SDK
 */

import type { AgentId, Address, URI, Timestamp } from './types.js';
import type { EndpointType, TrustModel } from './enums.js';

/**
 * Represents an agent endpoint
 */
export interface Endpoint {
  type: EndpointType;
  value: string; // endpoint value (URL, name, DID, ENS)
  meta?: Record<string, any>; // optional metadata
}

/**
 * Agent registration file structure
 */
export interface RegistrationFile {
  agentId?: AgentId; // None until minted
  agentURI?: URI; // where this file is (or will be) published
  name: string;
  description: string;
  image?: URI;
  walletAddress?: Address;
  walletChainId?: number; // Chain ID for the wallet address
  endpoints: Endpoint[];
  trustModels: (TrustModel | string)[];
  owners: Address[]; // from chain (read-only, hydrated)
  operators: Address[]; // from chain (read-only, hydrated)
  active: boolean; // SDK extension flag
  x402support: boolean; // Binary flag for x402 payment support
  metadata: Record<string, any>; // arbitrary, SDK-managed
  updatedAt: Timestamp;
}

/**
 * Summary information for agent discovery and search
 */
export interface AgentSummary {
  chainId: number; // ChainId
  agentId: AgentId;
  name: string;
  image?: URI;
  description: string;
  owners: Address[];
  operators: Address[];
  mcp: boolean;
  a2a: boolean;
  ens?: string;
  did?: string;
  walletAddress?: Address;
  supportedTrusts: string[]; // normalized string keys
  a2aSkills: string[];
  mcpTools: string[];
  mcpPrompts: string[];
  mcpResources: string[];
  active: boolean;
  x402support: boolean;
  extras: Record<string, any>;
}

/**
 * Feedback data structure
 */
export interface Feedback {
  id: FeedbackIdTuple; // (agentId, clientAddress, feedbackIndex)
  agentId: AgentId;
  reviewer: Address;
  score?: number; // 0-100
  tags: string[];
  text?: string;
  context?: Record<string, any>;
  proofOfPayment?: Record<string, any>;
  fileURI?: URI;
  createdAt: Timestamp;
  answers: Array<Record<string, any>>;
  isRevoked: boolean;

  // Off-chain only fields (not stored on blockchain)
  capability?: string; // MCP capability: "prompts", "resources", "tools", "completions"
  name?: string; // MCP tool/resource name
  skill?: string; // A2A skill
  task?: string; // A2A task
}

/**
 * Feedback ID tuple: [agentId, clientAddress, feedbackIndex]
 */
export type FeedbackIdTuple = [AgentId, Address, number];

/**
 * Feedback ID string format: "agentId:clientAddress:feedbackIndex"
 */
export type FeedbackId = string;

/**
 * Parameters for agent search
 */
export interface SearchParams {
  chains?: number[] | 'all'; // ChainId[] or 'all' to search all configured chains
  name?: string; // case-insensitive substring
  description?: string; // semantic; vector distance < threshold
  owners?: Address[];
  operators?: Address[];
  mcp?: boolean;
  a2a?: boolean;
  ens?: string; // exact, case-insensitive
  did?: string; // exact
  walletAddress?: Address;
  supportedTrust?: string[];
  a2aSkills?: string[];
  mcpTools?: string[];
  mcpPrompts?: string[];
  mcpResources?: string[];
  active?: boolean;
  x402support?: boolean;
}

/**
 * Parameters for feedback search
 */
export interface SearchFeedbackParams {
  agents?: AgentId[];
  tags?: string[];
  reviewers?: Address[];
  capabilities?: string[];
  skills?: string[];
  tasks?: string[];
  names?: string[]; // MCP tool/resource/prompt names
  minScore?: number; // 0-100
  maxScore?: number; // 0-100
  includeRevoked?: boolean;
}

/**
 * Metadata for multi-chain search results
 */
export interface SearchResultMeta {
  chains: number[]; // ChainId[]
  successfulChains: number[]; // ChainId[]
  failedChains: number[]; // ChainId[]
  totalResults: number;
  timing: {
    totalMs: number;
    averagePerChainMs?: number;
  };
}


```

`/Users/shawwalters/babylon/agent0-ts/src/index.ts`:

```ts
/**
 * Agent0 TypeScript SDK
 * Main entry point - exports public API
 */

// Export models
export * from './models/index.js';

// Export utilities
export * from './utils/index.js';

// Export core classes
export { SDK } from './core/sdk.js';
export type { SDKConfig } from './core/sdk.js';
export { Agent } from './core/agent.js';
export { Web3Client } from './core/web3-client.js';
export type { TransactionOptions } from './core/web3-client.js';
export { IPFSClient } from './core/ipfs-client.js';
export type { IPFSClientConfig } from './core/ipfs-client.js';
export { SubgraphClient } from './core/subgraph-client.js';
export { FeedbackManager } from './core/feedback-manager.js';
export { EndpointCrawler } from './core/endpoint-crawler.js';
export type { McpCapabilities, A2aCapabilities } from './core/endpoint-crawler.js';
export { AgentIndexer } from './core/indexer.js';

// Export contract definitions
export * from './core/contracts.js';


```

`/Users/shawwalters/babylon/agent0-ts/src/taxonomies/all_domains.json`:

```json
{
  "metadata": {
    "version": "0.8.0",
    "description": "Comprehensive collection of all OASF domains",
    "identifier_format": "Slash-separated path matching file structure (e.g., 'technology/software_engineering/devops')",
    "total_domains": 204
  },
  "categories": {
    "caption": "Domains",
    "description": "A comprehensive table outlining distinct fields of application and knowledge areas within the framework.",
    "name": "domain_categories",
    "attributes": {
      "technology": {
        "caption": "Technology",
        "description": "Development, management, and use of systems, devices, and software to solve problems and enhance human capabilities."
      },
      "finance_and_business": {
        "caption": "Finance and Business",
        "description": "Managing money, investments, and financial risks within businesses or for individuals. Subdomains: Corporate Finance, Personal Finance, Risk Management, Accounting, and Financial Analysis."
      },
      "life_science": {
        "caption": "Life Science",
        "description": "Scientific research and innovations in biology, genetics, biotechnology, and other related fields, with the goal of understanding life processes and advancing medical and environmental solutions. Subdomains: Biotechnology, Pharmaceutical Research, Genomics, Bioinformatics, and Molecular Biology."
      },
      "trust_and_safety": {
        "caption": "Trust and Safety",
        "description": "Maintaining a secure and reliable environment, primarily online, by managing risks, preventing harm, and ensuring safety and privacy. Subdomains: Online Safety, Content Moderation, Fraud Prevention, Data Privacy, and Risk Management."
      },
      "human_resources": {
        "caption": "Human Resources",
        "description": "Managing and optimizing the workforce of an organization, focusing on recruitment, employee development, and workplace culture. Subdomains: Recruitment, Employee Relations, Training and Development, Compensation and Benefits, and HR Analytics."
      },
      "education": {
        "caption": "Education",
        "description": "Systems, methods, and technologies used to teach, learn, and foster knowledge development in individuals and communities. Subdomains: E-Learning, Curriculum Design, Learning Management Systems, Educational Technology, and Pedagogy."
      },
      "industrial_manufacturing": {
        "caption": "Industrial Manufacturing",
        "description": "Production of goods, use of automation and technology in manufacturing, and industrial processes to create products on a large scale. Subdomains: Automation, Robotics, Supply Chain Management, Lean Manufacturing, and Process Engineering."
      },
      "transportation": {
        "caption": "Transportation",
        "description": "Systems and processes involved in the movement of goods and people, as well as the physical infrastructure supporting them. Subdomains: Logistics, Automotive, Public Transit, Supply Chain, Freight, and Autonomous Vehicles."
      },
      "healthcare": {
        "caption": "Healthcare",
        "description": "Management, delivery, and innovation of medical services, treatments, and technologies aimed at improving the health and well-being of individuals and populations."
      },
      "legal": {
        "caption": "Legal",
        "description": "Legal systems, compliance, regulatory frameworks, contract management, and judicial processes. Subdomains: Contract Law, Intellectual Property, Regulatory Compliance, Litigation, Legal Research, and Corporate Governance."
      },
      "agriculture": {
        "caption": "Agriculture",
        "description": "Cultivation of plants and livestock, farm management, agtech innovations, and sustainable food production systems. Subdomains: Precision Agriculture, Crop Management, Livestock Management, Agricultural Technology, and Sustainable Farming."
      },
      "energy": {
        "caption": "Energy",
        "description": "Production, distribution, and management of energy resources including renewable energy, power grids, and energy efficiency. Subdomains: Renewable Energy, Oil and Gas, Power Generation, Energy Storage, Smart Grids, and Energy Management."
      },
      "media_and_entertainment": {
        "caption": "Media and Entertainment",
        "description": "Creation, distribution, and consumption of content across various media platforms including broadcasting, streaming, gaming, and publishing. Subdomains: Content Creation, Broadcasting, Streaming Services, Gaming, Publishing, and Digital Media."
      },
      "real_estate": {
        "caption": "Real Estate",
        "description": "Property management, real estate transactions, construction, urban planning, and property technology. Subdomains: Property Management, Real Estate Investment, Construction, Urban Planning, PropTech, and Facilities Management."
      },
      "hospitality_and_tourism": {
        "caption": "Hospitality and Tourism",
        "description": "Services related to travel, accommodation, food service, event management, and tourism operations. Subdomains: Hotel Management, Travel Services, Event Planning, Food and Beverage, Tourism Operations, and Guest Experience."
      },
      "telecommunications": {
        "caption": "Telecommunications",
        "description": "Communication networks, mobile services, internet infrastructure, and connectivity solutions. Subdomains: Mobile Networks, Broadband, Satellite Communications, Network Infrastructure, VoIP, and 5G/6G Technologies."
      },
      "environmental_science": {
        "caption": "Environmental Science",
        "description": "Study and management of environmental systems, climate change, conservation, and sustainability practices. Subdomains: Climate Science, Conservation, Environmental Monitoring, Sustainability, Waste Management, and Pollution Control."
      },
      "government_and_public_sector": {
        "caption": "Government and Public Sector",
        "description": "Public administration, civic services, policy making, and governance systems. Subdomains: Public Administration, Policy Development, Civic Technology, Emergency Services, Urban Services, and Regulatory Agencies."
      },
      "research_and_development": {
        "caption": "Research and Development",
        "description": "Scientific research, innovation, experimental development, and knowledge creation across disciplines. Subdomains: Scientific Research, Innovation Management, Laboratory Operations, Patent Development, Experimental Design, and Research Analytics."
      },
      "retail_and_ecommerce": {
        "caption": "Retail and E-commerce",
        "description": "Sales operations, customer experience, inventory management, and online marketplace platforms. Subdomains: E-commerce Platforms, Retail Operations, Inventory Management, Customer Experience, Payment Systems, and Supply Chain."
      },
      "social_services": {
        "caption": "Social Services",
        "description": "Welfare programs, community support, non-profit operations, and social welfare systems. Subdomains: Community Services, Non-profit Management, Social Welfare, Child Services, Elder Care, and Disability Services."
      },
      "sports_and_fitness": {
        "caption": "Sports and Fitness",
        "description": "Athletic performance, fitness management, sports analytics, and recreational activities. Subdomains: Sports Analytics, Fitness Training, Sports Medicine, Event Management, Recreational Programs, and Performance Tracking."
      },
      "insurance": {
        "caption": "Insurance",
        "description": "Risk assessment, policy management, claims processing, and insurance product development. Subdomains: Underwriting, Claims Management, Risk Assessment, Policy Administration, Actuarial Science, and InsurTech."
      },
      "marketing_and_advertising": {
        "caption": "Marketing and Advertising",
        "description": "Brand management, customer engagement, digital marketing, advertising campaigns, and market research. Subdomains: Digital Marketing, Brand Management, Market Research, Advertising Technology, Content Marketing, and Customer Analytics."
      }
    }
  },
  "domains": {
    "agriculture/agricultural_technology": {
      "caption": "Agricultural Technology",
      "description": "Innovation and technology applications in farming including drones, IoT, and automation.",
      "extends": "agriculture",
      "name": "agricultural_technology",
      "attributes": {}
    },
    "agriculture/agriculture": {
      "caption": "Agriculture",
      "description": "Cultivation of plants and livestock, farm management, agtech innovations, and sustainable food production systems.",
      "extends": "base_domain",
      "name": "agriculture",
      "category": "agriculture",
      "attributes": {}
    },
    "agriculture/crop_management": {
      "caption": "Crop Management",
      "description": "Planning, monitoring, and optimizing crop production and yield.",
      "extends": "agriculture",
      "name": "crop_management",
      "attributes": {}
    },
    "agriculture/livestock_management": {
      "caption": "Livestock Management",
      "description": "Care, breeding, and management of farm animals and livestock operations.",
      "extends": "agriculture",
      "name": "livestock_management",
      "attributes": {}
    },
    "agriculture/precision_agriculture": {
      "caption": "Precision Agriculture",
      "description": "Data-driven farming using sensors, GPS, and analytics for optimized crop management.",
      "extends": "agriculture",
      "name": "precision_agriculture",
      "attributes": {}
    },
    "agriculture/sustainable_farming": {
      "caption": "Sustainable Farming",
      "description": "Environmentally responsible agricultural practices and organic farming methods.",
      "extends": "agriculture",
      "name": "sustainable_farming",
      "attributes": {}
    },
    "education/curriculum_design": {
      "caption": "Curriculum Design",
      "description": "Creating structured educational content and learning experiences for students. Subdomains: Instructional Design, Learning Objectives, Assessment Strategies, and Content Development.",
      "extends": "education",
      "name": "curriculum_design",
      "attributes": {}
    },
    "education/e_learning": {
      "caption": "E-Learning",
      "description": "Delivering educational content and instruction through digital platforms and online courses. Subdomains: Online Course Development, Virtual Classrooms, Interactive Learning Tools, and Mobile Learning.",
      "extends": "education",
      "name": "e_learning",
      "attributes": {}
    },
    "education/education": {
      "caption": "Education",
      "description": "Systems, methods, and technologies used to teach, learn, and foster knowledge development in individuals and communities. Subdomains: E-Learning, Curriculum Design, Learning Management Systems, Educational Technology, Pedagogy",
      "extends": "base_domain",
      "category": "education",
      "name": "education",
      "attributes": {}
    },
    "education/educational_technology": {
      "caption": "Educational Technology",
      "description": "Integrating digital tools and resources to enhance teaching and learning experiences. Subdomains: EdTech Innovations, Classroom Technology, Digital Content, and Gamification in Education.",
      "extends": "education",
      "name": "educational_technology",
      "attributes": {}
    },
    "education/learning_management_systems": {
      "caption": "Learning Management Systems",
      "description": "Software platforms for delivering, tracking, and managing educational courses and training programs. Subdomains: User Experience Design, Content Management, Reporting and Analytics, and System Integration.",
      "extends": "education",
      "name": "learning_management_systems",
      "attributes": {}
    },
    "education/pedagogy": {
      "caption": "Pedagogy",
      "description": "The methods and practices of teaching, focusing on how best to convey knowledge and skills to learners. Subdomains: Teaching Strategies, Student-Centered Learning, Instructional Theory, and Learning Styles.",
      "extends": "education",
      "name": "pedagogy",
      "attributes": {}
    },
    "energy/energy": {
      "caption": "Energy",
      "description": "Production, distribution, and management of energy resources including renewable energy, power grids, and energy efficiency.",
      "extends": "base_domain",
      "name": "energy",
      "category": "energy",
      "attributes": {}
    },
    "energy/energy_management": {
      "caption": "Energy Management",
      "description": "Optimization of energy consumption, efficiency programs, and demand response.",
      "extends": "energy",
      "name": "energy_management",
      "attributes": {}
    },
    "energy/energy_storage": {
      "caption": "Energy Storage",
      "description": "Battery systems, pumped hydro, and other energy storage technologies.",
      "extends": "energy",
      "name": "energy_storage",
      "attributes": {}
    },
    "energy/oil_and_gas": {
      "caption": "Oil and Gas",
      "description": "Exploration, extraction, refining, and distribution of petroleum products.",
      "extends": "energy",
      "name": "oil_and_gas",
      "attributes": {}
    },
    "energy/power_generation": {
      "caption": "Power Generation",
      "description": "Electricity generation from various sources including nuclear, thermal, and renewable.",
      "extends": "energy",
      "name": "power_generation",
      "attributes": {}
    },
    "energy/renewable_energy": {
      "caption": "Renewable Energy",
      "description": "Solar, wind, hydro, and other sustainable energy sources and technologies.",
      "extends": "energy",
      "name": "renewable_energy",
      "attributes": {}
    },
    "energy/smart_grids": {
      "caption": "Smart Grids",
      "description": "Intelligent power distribution networks with automated monitoring and control.",
      "extends": "energy",
      "name": "smart_grids",
      "attributes": {}
    },
    "environmental_science/climate_science": {
      "caption": "Climate Science",
      "description": "Climate modeling, climate change research, atmospheric science, and weather prediction",
      "extends": "environmental_science",
      "name": "climate_science",
      "attributes": {}
    },
    "environmental_science/conservation_biology": {
      "caption": "Conservation Biology",
      "description": "Species conservation, habitat protection, biodiversity, and wildlife management",
      "extends": "environmental_science",
      "name": "conservation_biology",
      "attributes": {}
    },
    "environmental_science/ecology": {
      "caption": "Ecology",
      "description": "Ecosystem science, ecological modeling, population dynamics, and environmental interactions",
      "extends": "environmental_science",
      "name": "ecology",
      "attributes": {}
    },
    "environmental_science/environmental_monitoring": {
      "caption": "Environmental Monitoring",
      "description": "Air quality monitoring, water quality testing, pollution tracking, and environmental sensors",
      "extends": "environmental_science",
      "name": "environmental_monitoring",
      "attributes": {}
    },
    "environmental_science/environmental_policy": {
      "caption": "Environmental Policy",
      "description": "Environmental regulations, policy development, compliance, and environmental law",
      "extends": "environmental_science",
      "name": "environmental_policy",
      "attributes": {}
    },
    "environmental_science/environmental_science": {
      "caption": "Environmental Science",
      "description": "Domain covering climate science, environmental monitoring, sustainability, conservation, and ecological research",
      "extends": "base_domain",
      "name": "environmental_science",
      "category": "environmental_science",
      "attributes": {}
    },
    "environmental_science/sustainability": {
      "caption": "Sustainability",
      "description": "Sustainable practices, carbon footprint reduction, circular economy, and green technology",
      "extends": "environmental_science",
      "name": "sustainability",
      "attributes": {}
    },
    "finance_and_business/banking": {
      "caption": "Banking",
      "description": "Operations of financial institutions involved in accepting deposits, lending money, and other financial services. Subdomains: Retail Banking, Investment Banking, Corporate Banking, and Digital Banking.",
      "extends": "finance_and_business",
      "name": "banking",
      "attributes": {}
    },
    "finance_and_business/consumer_goods": {
      "caption": "Consumer Goods",
      "description": "Creation, marketing, and distribution of products intended for personal use. Subdomains: Product Development, Consumer Behavior, Marketing, Retail, and Supply Chain Management.",
      "extends": "finance_and_business",
      "name": "consumer_goods",
      "attributes": {}
    },
    "finance_and_business/finance": {
      "caption": "Finance",
      "description": "Managing money, investments, and financial risks within businesses or for individuals. Subdomains: Corporate Finance, Personal Finance, Risk Management, Accounting, and Financial Analysis.",
      "extends": "finance_and_business",
      "name": "finance",
      "attributes": {}
    },
    "finance_and_business/finance_and_business": {
      "caption": "Finance and Business",
      "description": "Management of money, investments, and business operations, alongside the development and delivery of products and services in various industries.",
      "extends": "base_domain",
      "name": "finance_and_business",
      "category": "finance_and_business",
      "attributes": {}
    },
    "finance_and_business/investment_services": {
      "caption": "Investment Services",
      "description": "Managing financial assets, investment portfolios, and providing advisory services to clients. Subdomains: Asset Management, Hedge Funds, Private Equity, Mutual Funds, and Financial Planning.",
      "extends": "finance_and_business",
      "name": "investment_services",
      "attributes": {}
    },
    "finance_and_business/retail": {
      "caption": "Retail",
      "description": "Sale of goods and services directly to consumers through various channels. Subdomains: E-commerce, In-store Retail, Inventory Management, Customer Experience, and Omnichannel Retail.",
      "extends": "finance_and_business",
      "name": "retail",
      "attributes": {}
    },
    "government_and_public_sector/civic_engagement": {
      "caption": "Civic Engagement",
      "description": "Citizen participation, community outreach, public consultation, and participatory governance",
      "extends": "government_and_public_sector",
      "name": "civic_engagement",
      "attributes": {}
    },
    "government_and_public_sector/e_government": {
      "caption": "E-Government",
      "description": "Digital government services, online portals, citizen engagement platforms, and digital identity",
      "extends": "government_and_public_sector",
      "name": "e_government",
      "attributes": {}
    },
    "government_and_public_sector/emergency_management": {
      "caption": "Emergency Management",
      "description": "Disaster response, emergency planning, crisis management, and public safety coordination",
      "extends": "government_and_public_sector",
      "name": "emergency_management",
      "attributes": {}
    },
    "government_and_public_sector/government_and_public_sector": {
      "caption": "Government and Public Sector",
      "description": "Domain covering public administration, civic services, e-government, policy making, and public infrastructure",
      "extends": "base_domain",
      "name": "government_and_public_sector",
      "category": "government_and_public_sector",
      "attributes": {}
    },
    "government_and_public_sector/public_administration": {
      "caption": "Public Administration",
      "description": "Government operations, administrative processes, civil service, and bureaucratic systems",
      "extends": "government_and_public_sector",
      "name": "public_administration",
      "attributes": {}
    },
    "government_and_public_sector/public_infrastructure": {
      "caption": "Public Infrastructure",
      "description": "Infrastructure planning, public works, utilities management, and infrastructure maintenance",
      "extends": "government_and_public_sector",
      "name": "public_infrastructure",
      "attributes": {}
    },
    "government_and_public_sector/public_policy": {
      "caption": "Public Policy",
      "description": "Policy development, legislative processes, policy analysis, and public affairs",
      "extends": "government_and_public_sector",
      "name": "public_policy",
      "attributes": {}
    },
    "healthcare/health_information_systems": {
      "caption": "Health Information Systems",
      "description": "Systems for managing healthcare data to support clinical and administrative decision-making. Subdomains: Hospital Information Systems, Clinical Decision Support, Health Data Security, and Interoperability Solutions.",
      "extends": "healthcare",
      "name": "health_information_systems",
      "attributes": {}
    },
    "healthcare/healthcare": {
      "caption": "Healthcare",
      "description": "Management, delivery, and innovation of medical services, treatments, and technologies aimed at improving the health and well-being of individuals and populations.",
      "extends": "base_domain",
      "name": "healthcare",
      "category": "healthcare",
      "attributes": {}
    },
    "healthcare/healthcare_informatics": {
      "caption": "Healthcare Informatics",
      "description": "The management and analysis of healthcare data to improve patient care and operational efficiency. Subdomains: Electronic Health Records, Health Data Analytics, Clinical Informatics, and Health IT Systems.",
      "extends": "healthcare",
      "name": "healthcare_informatics",
      "attributes": {}
    },
    "healthcare/medical_technology": {
      "caption": "Medical Technology",
      "description": "Innovations and devices used to improve the diagnosis, treatment, and management of health conditions. Subdomains: Medical Devices, Diagnostic Equipment, Wearable Health Tech, and Biotech Innovations.",
      "extends": "healthcare",
      "name": "medical_technology",
      "attributes": {}
    },
    "healthcare/patient_management_systems": {
      "caption": "Patient Management Systems",
      "description": "Software solutions that help healthcare providers manage patient information and clinical processes. Subdomains: Appointment Scheduling, Patient Portals, Billing and Coding, and Health Record Management.",
      "extends": "healthcare",
      "name": "patient_management_systems",
      "attributes": {}
    },
    "healthcare/telemedicine": {
      "caption": "Telemedicine",
      "description": "The delivery of healthcare services through telecommunications technology. Subdomains: Remote Consultation, Telehealth Platforms, Mobile Health, and Virtual Care.",
      "extends": "healthcare",
      "name": "telemedicine",
      "attributes": {}
    },
    "hospitality_and_tourism/event_planning": {
      "caption": "Event Planning",
      "description": "Conference management, event coordination, venue management, and event services",
      "extends": "hospitality_and_tourism",
      "name": "event_planning",
      "attributes": {}
    },
    "hospitality_and_tourism/food_and_beverage": {
      "caption": "Food and Beverage",
      "description": "Restaurant management, catering services, menu planning, and culinary operations",
      "extends": "hospitality_and_tourism",
      "name": "food_and_beverage",
      "attributes": {}
    },
    "hospitality_and_tourism/hospitality_and_tourism": {
      "caption": "Hospitality and Tourism",
      "description": "Domain covering hotel management, travel services, tourism, event planning, and hospitality technology",
      "extends": "base_domain",
      "name": "hospitality_and_tourism",
      "category": "hospitality_and_tourism",
      "attributes": {}
    },
    "hospitality_and_tourism/hospitality_technology": {
      "caption": "Hospitality Technology",
      "description": "Property management systems, booking engines, guest experience platforms, and hospitality software",
      "extends": "hospitality_and_tourism",
      "name": "hospitality_technology",
      "attributes": {}
    },
    "hospitality_and_tourism/hotel_management": {
      "caption": "Hotel Management",
      "description": "Hotel operations, reservations, guest services, and property management systems",
      "extends": "hospitality_and_tourism",
      "name": "hotel_management",
      "attributes": {}
    },
    "hospitality_and_tourism/tourism_management": {
      "caption": "Tourism Management",
      "description": "Destination management, tourist attractions, tourism marketing, and visitor experiences",
      "extends": "hospitality_and_tourism",
      "name": "tourism_management",
      "attributes": {}
    },
    "hospitality_and_tourism/travel_services": {
      "caption": "Travel Services",
      "description": "Travel booking, itinerary planning, travel agencies, and booking platforms",
      "extends": "hospitality_and_tourism",
      "name": "travel_services",
      "attributes": {}
    },
    "human_resources/compensation_and_benefits": {
      "caption": "Compensation and Benefits",
      "description": "Designing and managing salary structures, bonuses, and benefits to attract and retain employees. Subdomains: Salary Benchmarking, Benefits Administration, Incentive Programs, and Retirement Planning.",
      "extends": "human_resources",
      "name": "compensation_and_benefits",
      "attributes": {}
    },
    "human_resources/employee_relations": {
      "caption": "Employee Relations",
      "description": "Maintaining positive relationships between the employer and employees to foster a productive work environment. Subdomains: Conflict Resolution, Employee Engagement, Workplace Culture, and Labor Relations.",
      "extends": "human_resources",
      "name": "employee_relations",
      "attributes": {}
    },
    "human_resources/hr_analytics": {
      "caption": "HR Analytics",
      "description": "Using data analysis to improve HR decision-making, workforce planning, and employee performance metrics. Subdomains: People Analytics, Predictive HR, Workforce Metrics, and Data-Driven HR Strategies.",
      "extends": "human_resources",
      "name": "hr_analytics",
      "attributes": {}
    },
    "human_resources/human_resources": {
      "caption": "Human Resources",
      "description": "Managing and optimizing the workforce of an organization, focusing on recruitment, employee development, and workplace culture. Subdomains: Recruitment, Employee Relations, Training and Development, Compensation and Benefits, and HR Analytics.",
      "extends": "base_domain",
      "name": "human_resources",
      "category": "human_resources",
      "attributes": {}
    },
    "human_resources/recruitment": {
      "caption": "Recruitment",
      "description": "Attracting, screening, and selecting qualified candidates for job openings within an organization. Subdomains: Talent Acquisition, Candidate Sourcing, Interviewing Techniques, and Onboarding Processes.",
      "extends": "human_resources",
      "name": "recruitment",
      "attributes": {}
    },
    "human_resources/training_and_development": {
      "caption": "Training and Development",
      "description": "Providing employees with skills and knowledge to enhance their job performance and career growth. Subdomains: Skills Training, Leadership Development, Career Pathing, and E-Learning Platforms.",
      "extends": "human_resources",
      "name": "training_and_development",
      "attributes": {}
    },
    "industrial_manufacturing/automation": {
      "caption": "Automation",
      "description": "Using technology to perform processes with minimal human intervention. Subdomains: Automated Manufacturing, Control Systems, Industrial IoT, and Process Automation.",
      "extends": "industrial_manufacturing",
      "name": "automation",
      "attributes": {}
    },
    "industrial_manufacturing/industrial_manufacturing": {
      "caption": "Industrial Manufacturing",
      "description": "The use of automation and technology in manufacturing, production of goods, and industrial processes to create products on a large scale. Subdomains: Automation, Robotics, Supply Chain Management, Lean Manufacturing, and Process Engineering.",
      "extends": "base_domain",
      "name": "industrial_manufacturing",
      "category": "industrial_manufacturing",
      "attributes": {}
    },
    "industrial_manufacturing/lean_manufacturing": {
      "caption": "Lean Manufacturing",
      "description": "Methodology focusing on minimizing waste and maximizing efficiency in the production process. Subdomains: Continuous Improvement, Six Sigma, Value Stream Mapping, and Kaizen.",
      "extends": "industrial_manufacturing",
      "name": "lean_manufacturing",
      "attributes": {}
    },
    "industrial_manufacturing/process_engineering": {
      "caption": "Process Engineering",
      "description": "Designing, implementing, and optimizing industrial processes to improve efficiency and quality. Subdomains: Process Design, Process Optimization, Quality Control, and Safety Engineering.",
      "extends": "industrial_manufacturing",
      "name": "process_engineering",
      "attributes": {}
    },
    "industrial_manufacturing/robotics": {
      "caption": "Robotics",
      "description": "Designing and using robots for manufacturing tasks to enhance productivity and precision. Subdomains: Robotic Process Automation, Industrial Robotics, AI and Robotics, and Collaborative Robots.",
      "extends": "industrial_manufacturing",
      "name": "robotics",
      "attributes": {}
    },
    "industrial_manufacturing/supply_chain_management": {
      "caption": "Supply Chain Management",
      "description": "Coordinating and managing all activities involved in the production and delivery of goods. Subdomains: Inventory Management, Procurement, Logistics Management, and Demand Forecasting.",
      "extends": "industrial_manufacturing",
      "name": "supply_chain_management",
      "attributes": {}
    },
    "insurance/actuarial_science": {
      "caption": "Actuarial Science",
      "description": "Actuarial analysis, risk modeling, statistical modeling, and pricing strategies",
      "extends": "insurance",
      "name": "actuarial_science",
      "attributes": {}
    },
    "insurance/claims_processing": {
      "caption": "Claims Processing",
      "description": "Claims management, loss adjustment, claims automation, and settlement processes",
      "extends": "insurance",
      "name": "claims_processing",
      "attributes": {}
    },
    "insurance/insurance": {
      "caption": "Insurance",
      "description": "Domain covering insurance products, risk assessment, claims processing, underwriting, and insurance technology",
      "extends": "base_domain",
      "name": "insurance",
      "category": "insurance",
      "attributes": {}
    },
    "insurance/insurance_sales": {
      "caption": "Insurance Sales",
      "description": "Agent management, distribution channels, customer acquisition, and sales platforms",
      "extends": "insurance",
      "name": "insurance_sales",
      "attributes": {}
    },
    "insurance/insurtech": {
      "caption": "InsurTech",
      "description": "Insurance technology, digital insurance platforms, telematics, and insurance innovation",
      "extends": "insurance",
      "name": "insurtech",
      "attributes": {}
    },
    "insurance/policy_management": {
      "caption": "Policy Management",
      "description": "Policy administration, renewals, endorsements, and policy lifecycle management",
      "extends": "insurance",
      "name": "policy_management",
      "attributes": {}
    },
    "insurance/underwriting": {
      "caption": "Underwriting",
      "description": "Risk assessment, policy pricing, underwriting automation, and risk evaluation",
      "extends": "insurance",
      "name": "underwriting",
      "attributes": {}
    },
    "legal/contract_law": {
      "caption": "Contract Law",
      "description": "Legal principles governing agreements and contracts between parties.",
      "extends": "legal",
      "name": "contract_law",
      "attributes": {}
    },
    "legal/corporate_governance": {
      "caption": "Corporate Governance",
      "description": "Systems, principles, and processes for directing and controlling corporations.",
      "extends": "legal",
      "name": "corporate_governance",
      "attributes": {}
    },
    "legal/intellectual_property": {
      "caption": "Intellectual Property",
      "description": "Protection and management of patents, trademarks, copyrights, and trade secrets.",
      "extends": "legal",
      "name": "intellectual_property",
      "attributes": {}
    },
    "legal/legal": {
      "caption": "Legal",
      "description": "Legal systems, compliance, regulatory frameworks, contract management, and judicial processes.",
      "extends": "base_domain",
      "name": "legal",
      "category": "legal",
      "attributes": {}
    },
    "legal/legal_research": {
      "caption": "Legal Research",
      "description": "Investigation of legal precedents, statutes, and case law.",
      "extends": "legal",
      "name": "legal_research",
      "attributes": {}
    },
    "legal/litigation": {
      "caption": "Litigation",
      "description": "Legal proceedings and dispute resolution through court systems.",
      "extends": "legal",
      "name": "litigation",
      "attributes": {}
    },
    "legal/regulatory_compliance": {
      "caption": "Regulatory Compliance",
      "description": "Ensuring adherence to laws, regulations, and industry standards.",
      "extends": "legal",
      "name": "regulatory_compliance",
      "attributes": {}
    },
    "life_science/bioinformatics": {
      "caption": "Bioinformatics",
      "description": "the application of computational techniques to analyze and interpret biological data. Subdomains: Sequence Analysis, Systems Biology, Data Mining, and Structural Bioinformatics.",
      "extends": "life_science",
      "name": "bioinformatics",
      "attributes": {}
    },
    "life_science/biotechnology": {
      "caption": "Biotechnology",
      "description": "The application of biological systems and organisms to develop or create products and technologies that improve the quality of human life. Subdomains: Medical Biotechnology, Agricultural Biotechnology, Industrial Biotechnology, and Environmental Biotechnology.",
      "extends": "life_science",
      "name": "biotechnology",
      "attributes": {}
    },
    "life_science/genomics": {
      "caption": "Genomics",
      "description": "The study of genomes to understand genetic structure, function, and evolution. Subdomains: Comparative Genomics, Functional Genomics, Population Genomics, and Metagenomics.",
      "extends": "life_science",
      "name": "genomics",
      "attributes": {}
    },
    "life_science/life_science": {
      "caption": "Life Science",
      "description": "Scientific research and innovations in biology, genetics, biotechnology, and other related fields, with the goal of understanding life processes and advancing medical and environmental solutions. Subdomains: Biotechnology, Pharmaceutical Research, Genomics, Bioinformatics, and Molecular Biology.",
      "extends": "base_domain",
      "name": "life_science",
      "category": "life_science",
      "attributes": {}
    },
    "life_science/molecular_biology": {
      "caption": "Molecular Biology",
      "description": "Molecular Biology is the branch of biology that focuses on the structure, function, and interactions of biological macromolecules, such as DNA, RNA, and proteins. Subdomains: Genomics, Gene Expression, and Cell Signaling.",
      "extends": "life_science",
      "name": "molecular_biology",
      "attributes": {}
    },
    "life_science/pharmaceutical_research": {
      "caption": "Pharmaceutical Research",
      "description": "The discovery, development, and testing of new drugs and therapies to treat diseases and improve health outcomes. Subdomains: Drug Discovery, Clinical Trials, Pharmacology, and Regulatory Affairs.",
      "extends": "life_science",
      "name": "pharmaceutical_research",
      "attributes": {}
    },
    "marketing_and_advertising/advertising": {
      "caption": "Advertising",
      "description": "Ad campaigns, media buying, creative development, and advertising platforms",
      "extends": "marketing_and_advertising",
      "name": "advertising",
      "attributes": {}
    },
    "marketing_and_advertising/brand_management": {
      "caption": "Brand Management",
      "description": "Brand strategy, brand identity, brand positioning, and reputation management",
      "extends": "marketing_and_advertising",
      "name": "brand_management",
      "attributes": {}
    },
    "marketing_and_advertising/digital_marketing": {
      "caption": "Digital Marketing",
      "description": "SEO, SEM, content marketing, social media marketing, and online campaigns",
      "extends": "marketing_and_advertising",
      "name": "digital_marketing",
      "attributes": {}
    },
    "marketing_and_advertising/market_research": {
      "caption": "Market Research",
      "description": "Consumer research, market analysis, competitive intelligence, and research methodologies",
      "extends": "marketing_and_advertising",
      "name": "market_research",
      "attributes": {}
    },
    "marketing_and_advertising/marketing_analytics": {
      "caption": "Marketing Analytics",
      "description": "Marketing metrics, ROI analysis, attribution modeling, and performance tracking",
      "extends": "marketing_and_advertising",
      "name": "marketing_analytics",
      "attributes": {}
    },
    "marketing_and_advertising/marketing_and_advertising": {
      "caption": "Marketing and Advertising",
      "description": "Domain covering digital marketing, advertising campaigns, brand management, market research, and marketing automation",
      "extends": "base_domain",
      "name": "marketing_and_advertising",
      "category": "marketing_and_advertising",
      "attributes": {}
    },
    "marketing_and_advertising/marketing_automation": {
      "caption": "Marketing Automation",
      "description": "Marketing platforms, campaign automation, lead nurturing, and marketing technology",
      "extends": "marketing_and_advertising",
      "name": "marketing_automation",
      "attributes": {}
    },
    "media_and_entertainment/broadcasting": {
      "caption": "Broadcasting",
      "description": "Radio and television broadcasting systems and operations.",
      "extends": "media_and_entertainment",
      "name": "broadcasting",
      "attributes": {}
    },
    "media_and_entertainment/content_creation": {
      "caption": "Content Creation",
      "description": "Production of digital and traditional media content including video, audio, and written material.",
      "extends": "media_and_entertainment",
      "name": "content_creation",
      "attributes": {}
    },
    "media_and_entertainment/digital_media": {
      "caption": "Digital Media",
      "description": "Social media, blogs, podcasts, and other digital content platforms.",
      "extends": "media_and_entertainment",
      "name": "digital_media",
      "attributes": {}
    },
    "media_and_entertainment/gaming": {
      "caption": "Gaming",
      "description": "Video game development, esports, and interactive entertainment.",
      "extends": "media_and_entertainment",
      "name": "gaming",
      "attributes": {}
    },
    "media_and_entertainment/media_and_entertainment": {
      "caption": "Media and Entertainment",
      "description": "Creation, distribution, and consumption of content across various media platforms including broadcasting, streaming, gaming, and publishing.",
      "extends": "base_domain",
      "name": "media_and_entertainment",
      "category": "media_and_entertainment",
      "attributes": {}
    },
    "media_and_entertainment/publishing": {
      "caption": "Publishing",
      "description": "Book, magazine, and digital publishing operations and distribution.",
      "extends": "media_and_entertainment",
      "name": "publishing",
      "attributes": {}
    },
    "media_and_entertainment/streaming_services": {
      "caption": "Streaming Services",
      "description": "On-demand video and audio streaming platforms and content delivery.",
      "extends": "media_and_entertainment",
      "name": "streaming_services",
      "attributes": {}
    },
    "real_estate/construction": {
      "caption": "Construction",
      "description": "Building construction, project management, and construction technology.",
      "extends": "real_estate",
      "name": "construction",
      "attributes": {}
    },
    "real_estate/facilities_management": {
      "caption": "Facilities Management",
      "description": "Building operations, maintenance, and facility services.",
      "extends": "real_estate",
      "name": "facilities_management",
      "attributes": {}
    },
    "real_estate/property_management": {
      "caption": "Property Management",
      "description": "Management of residential and commercial properties including maintenance and tenant relations.",
      "extends": "real_estate",
      "name": "property_management",
      "attributes": {}
    },
    "real_estate/proptech": {
      "caption": "PropTech",
      "description": "Property technology innovations including smart buildings and real estate platforms.",
      "extends": "real_estate",
      "name": "proptech",
      "attributes": {}
    },
    "real_estate/real_estate": {
      "caption": "Real Estate",
      "description": "Property management, real estate transactions, construction, urban planning, and property technology.",
      "extends": "base_domain",
      "name": "real_estate",
      "category": "real_estate",
      "attributes": {}
    },
    "real_estate/real_estate_investment": {
      "caption": "Real Estate Investment",
      "description": "Property investment strategies, portfolio management, and real estate finance.",
      "extends": "real_estate",
      "name": "real_estate_investment",
      "attributes": {}
    },
    "real_estate/urban_planning": {
      "caption": "Urban Planning",
      "description": "City planning, zoning, and urban development strategies.",
      "extends": "real_estate",
      "name": "urban_planning",
      "attributes": {}
    },
    "research_and_development/grant_management": {
      "caption": "Grant Management",
      "description": "Research funding, grant applications, project budgeting, and compliance reporting",
      "extends": "research_and_development",
      "name": "grant_management",
      "attributes": {}
    },
    "research_and_development/innovation_management": {
      "caption": "Innovation Management",
      "description": "Innovation processes, idea management, technology transfer, and commercialization",
      "extends": "research_and_development",
      "name": "innovation_management",
      "attributes": {}
    },
    "research_and_development/laboratory_management": {
      "caption": "Laboratory Management",
      "description": "Lab operations, equipment management, safety protocols, and laboratory information systems",
      "extends": "research_and_development",
      "name": "laboratory_management",
      "attributes": {}
    },
    "research_and_development/product_development": {
      "caption": "Product Development",
      "description": "New product design, prototyping, testing, and product lifecycle management",
      "extends": "research_and_development",
      "name": "product_development",
      "attributes": {}
    },
    "research_and_development/research_and_development": {
      "caption": "Research and Development",
      "description": "Domain covering scientific research, innovation, R&D management, laboratory operations, and experimental design",
      "extends": "base_domain",
      "name": "research_and_development",
      "category": "research_and_development",
      "attributes": {}
    },
    "research_and_development/research_data_management": {
      "caption": "Research Data Management",
      "description": "Data storage, research databases, data sharing, and research informatics",
      "extends": "research_and_development",
      "name": "research_data_management",
      "attributes": {}
    },
    "research_and_development/scientific_research": {
      "caption": "Scientific Research",
      "description": "Research methodology, experimental design, data collection, and scientific investigation",
      "extends": "research_and_development",
      "name": "scientific_research",
      "attributes": {}
    },
    "retail_and_ecommerce/customer_experience": {
      "caption": "Customer Experience",
      "description": "Personalization, customer service, loyalty programs, and shopping experience optimization",
      "extends": "retail_and_ecommerce",
      "name": "customer_experience",
      "attributes": {}
    },
    "retail_and_ecommerce/inventory_management": {
      "caption": "Inventory Management",
      "description": "Stock control, warehouse management, inventory tracking, and supply planning",
      "extends": "retail_and_ecommerce",
      "name": "inventory_management",
      "attributes": {}
    },
    "retail_and_ecommerce/online_retail": {
      "caption": "Online Retail",
      "description": "E-commerce platforms, online storefronts, digital marketplaces, and web retail",
      "extends": "retail_and_ecommerce",
      "name": "online_retail",
      "attributes": {}
    },
    "retail_and_ecommerce/order_fulfillment": {
      "caption": "Order Fulfillment",
      "description": "Order processing, shipping, logistics, returns management, and last-mile delivery",
      "extends": "retail_and_ecommerce",
      "name": "order_fulfillment",
      "attributes": {}
    },
    "retail_and_ecommerce/point_of_sale": {
      "caption": "Point of Sale",
      "description": "POS systems, retail checkout, payment processing, and in-store transactions",
      "extends": "retail_and_ecommerce",
      "name": "point_of_sale",
      "attributes": {}
    },
    "retail_and_ecommerce/retail_analytics": {
      "caption": "Retail Analytics",
      "description": "Sales analytics, customer insights, merchandising analytics, and retail intelligence",
      "extends": "retail_and_ecommerce",
      "name": "retail_analytics",
      "attributes": {}
    },
    "retail_and_ecommerce/retail_and_ecommerce": {
      "caption": "Retail and E-Commerce",
      "description": "Domain covering online retail, inventory management, customer experience, fulfillment, and retail operations",
      "extends": "base_domain",
      "name": "retail_and_ecommerce",
      "category": "retail_and_ecommerce",
      "attributes": {}
    },
    "social_services/case_management": {
      "caption": "Case Management",
      "description": "Client case tracking, service coordination, needs assessment, and case documentation",
      "extends": "social_services",
      "name": "case_management",
      "attributes": {}
    },
    "social_services/child_and_family_services": {
      "caption": "Child and Family Services",
      "description": "Child welfare, family support, foster care, adoption services, and family counseling",
      "extends": "social_services",
      "name": "child_and_family_services",
      "attributes": {}
    },
    "social_services/community_outreach": {
      "caption": "Community Outreach",
      "description": "Community programs, outreach services, community engagement, and local support initiatives",
      "extends": "social_services",
      "name": "community_outreach",
      "attributes": {}
    },
    "social_services/disability_services": {
      "caption": "Disability Services",
      "description": "Disability support, accessibility services, assistive technology, and disability advocacy",
      "extends": "social_services",
      "name": "disability_services",
      "attributes": {}
    },
    "social_services/housing_assistance": {
      "caption": "Housing Assistance",
      "description": "Homeless services, housing support, emergency shelter, and housing programs",
      "extends": "social_services",
      "name": "housing_assistance",
      "attributes": {}
    },
    "social_services/mental_health_services": {
      "caption": "Mental Health Services",
      "description": "Mental health support, counseling, crisis intervention, and psychological services",
      "extends": "social_services",
      "name": "mental_health_services",
      "attributes": {}
    },
    "social_services/social_services": {
      "caption": "Social Services",
      "description": "Domain covering social work, community services, welfare programs, case management, and social assistance",
      "extends": "base_domain",
      "name": "social_services",
      "category": "social_services",
      "attributes": {}
    },
    "sports_and_fitness/athletic_training": {
      "caption": "Athletic Training",
      "description": "Performance training, coaching, workout programs, and athlete development",
      "extends": "sports_and_fitness",
      "name": "athletic_training",
      "attributes": {}
    },
    "sports_and_fitness/fitness_and_wellness": {
      "caption": "Fitness and Wellness",
      "description": "Fitness programs, wellness coaching, health tracking, and personal training",
      "extends": "sports_and_fitness",
      "name": "fitness_and_wellness",
      "attributes": {}
    },
    "sports_and_fitness/sports_analytics": {
      "caption": "Sports Analytics",
      "description": "Performance metrics, game analysis, player statistics, and sports data science",
      "extends": "sports_and_fitness",
      "name": "sports_analytics",
      "attributes": {}
    },
    "sports_and_fitness/sports_and_fitness": {
      "caption": "Sports and Fitness",
      "description": "Domain covering sports management, fitness programs, athletic training, sports analytics, and wellness",
      "extends": "base_domain",
      "name": "sports_and_fitness",
      "category": "sports_and_fitness",
      "attributes": {}
    },
    "sports_and_fitness/sports_management": {
      "caption": "Sports Management",
      "description": "Team management, sports facilities, event organization, and sports administration",
      "extends": "sports_and_fitness",
      "name": "sports_management",
      "attributes": {}
    },
    "sports_and_fitness/sports_medicine": {
      "caption": "Sports Medicine",
      "description": "Injury prevention, sports rehabilitation, athletic healthcare, and performance medicine",
      "extends": "sports_and_fitness",
      "name": "sports_medicine",
      "attributes": {}
    },
    "sports_and_fitness/sports_technology": {
      "caption": "Sports Technology",
      "description": "Wearable devices, performance tracking systems, sports apps, and fitness technology",
      "extends": "sports_and_fitness",
      "name": "sports_technology",
      "attributes": {}
    },
    "technology/automation/automation": {
      "caption": "Automation",
      "description": "Use of technology to perform processes or procedures with minimal human intervention.",
      "extends": "technology",
      "name": "process_automation",
      "attributes": {}
    },
    "technology/automation/rpa": {
      "caption": "Robotic Process Automation (RPA)",
      "description": "Technology that uses software robots to automate repetitive, rule-based tasks typically performed by humans.",
      "extends": "process_automation",
      "name": "rpa",
      "attributes": {}
    },
    "technology/automation/workflow_automation": {
      "caption": "Workflow Automation",
      "description": "Automation of business processes through the use of software to reduce manual work and improve efficiency.",
      "extends": "process_automation",
      "name": "workflow_automation",
      "attributes": {}
    },
    "technology/blockchain/blockchain": {
      "caption": "Blockchain",
      "description": "Distributed ledger technology that maintains a continuously growing list of records secured using cryptography.",
      "extends": "technology",
      "name": "blockchain",
      "attributes": {}
    },
    "technology/blockchain/cryptocurrency": {
      "caption": "Cryptocurrency",
      "description": "Digital or virtual currency secured by cryptography, typically operating on blockchain technology.",
      "extends": "blockchain",
      "name": "cryptocurrency",
      "attributes": {}
    },
    "technology/blockchain/defi": {
      "caption": "Decentralized Finance (DeFi)",
      "description": "Financial services built on blockchain networks that operate without traditional intermediaries.",
      "extends": "blockchain",
      "name": "defi",
      "attributes": {}
    },
    "technology/blockchain/smart_contracts": {
      "caption": "Smart Contracts",
      "description": "Self-executing contracts with terms directly written into code, running on blockchain networks.",
      "extends": "blockchain",
      "name": "smart_contracts",
      "attributes": {}
    },
    "technology/cloud_computing/aws": {
      "caption": "Amazon Web Services (AWS)",
      "description": "Comprehensive cloud computing platform offered by Amazon.",
      "extends": "cloud_computing",
      "name": "aws",
      "attributes": {}
    },
    "technology/cloud_computing/azure": {
      "caption": "Microsoft Azure",
      "description": "Cloud computing service created by Microsoft for building, testing, deploying, and managing applications.",
      "extends": "cloud_computing",
      "name": "azure",
      "attributes": {}
    },
    "technology/cloud_computing/cloud_computing": {
      "caption": "Cloud Computing",
      "description": "Delivery of computing services including servers, storage, databases, networking, software, and analytics over the internet.",
      "extends": "technology",
      "name": "cloud_computing",
      "attributes": {}
    },
    "technology/cloud_computing/gcp": {
      "caption": "Google Cloud Platform (GCP)",
      "description": "Suite of cloud computing services offered by Google.",
      "extends": "cloud_computing",
      "name": "gcp",
      "attributes": {}
    },
    "technology/communication_systems/broadcasting_systems": {
      "caption": "Broadcasting Systems",
      "description": "Systems for distributing audio and video content to large audiences via radio, television, or internet.",
      "extends": "communication_systems",
      "name": "broadcasting_systems",
      "attributes": {}
    },
    "technology/communication_systems/communication_systems": {
      "caption": "Communication Systems",
      "description": "Technologies for transmitting and receiving information over various media.",
      "extends": "technology",
      "name": "communication_systems",
      "attributes": {}
    },
    "technology/communication_systems/signal_processing": {
      "caption": "Signal Processing",
      "description": "Analysis, modification, and synthesis of signals such as sound, images, and sensor data.",
      "extends": "communication_systems",
      "name": "signal_processing",
      "attributes": {}
    },
    "technology/communication_systems/telecommunication": {
      "caption": "Telecommunication",
      "description": "Transmission of information over long distances using electronic and digital technologies.",
      "extends": "communication_systems",
      "name": "telecommunication",
      "attributes": {}
    },
    "technology/communication_systems/wireless_communication": {
      "caption": "Wireless Communication",
      "description": "Communication technologies that use electromagnetic waves to transmit data without physical connections.",
      "extends": "communication_systems",
      "name": "wireless_communication",
      "attributes": {}
    },
    "technology/data_science/big_data": {
      "caption": "Big Data",
      "description": "Large and complex datasets that require advanced tools and techniques for processing and analysis.",
      "extends": "data_science",
      "name": "big_data",
      "attributes": {}
    },
    "technology/data_science/data_engineering": {
      "caption": "Data Engineering",
      "description": "Design and construction of systems for collecting, storing, and processing data at scale.",
      "extends": "data_science",
      "name": "data_engineering",
      "attributes": {}
    },
    "technology/data_science/data_science": {
      "caption": "Data Science",
      "description": "Extracting insights and knowledge from structured and unstructured data using scientific methods, processes, and algorithms.",
      "extends": "technology",
      "name": "data_science",
      "attributes": {}
    },
    "technology/data_science/data_visualization": {
      "caption": "Data Visualization",
      "description": "Graphical representation of information and data using visual elements like charts, graphs, and maps.",
      "extends": "data_science",
      "name": "data_visualization",
      "attributes": {}
    },
    "technology/information_technology/database_administration": {
      "caption": "Database Administration",
      "description": "Management and maintenance of database systems and data storage.",
      "extends": "information_technology",
      "name": "database_administration",
      "attributes": {}
    },
    "technology/information_technology/help_desk_support": {
      "caption": "Help Desk Support",
      "description": "Technical support and assistance for end users and IT systems.",
      "extends": "information_technology",
      "name": "help_desk_support",
      "attributes": {}
    },
    "technology/information_technology/information_technology": {
      "caption": "Information Technology",
      "description": "All aspects of managing and supporting technology systems and infrastructure.",
      "extends": "technology",
      "name": "information_technology",
      "attributes": {}
    },
    "technology/information_technology/performance_analysis": {
      "caption": "Performance Analysis",
      "description": "Analysis and optimization of system performance to ensure efficient operation.",
      "extends": "information_technology",
      "name": "performance_analysis",
      "attributes": {}
    },
    "technology/information_technology/system_administration": {
      "caption": "System Administration",
      "description": "Management and maintenance of computer systems and servers.",
      "extends": "information_technology",
      "name": "system_administration",
      "attributes": {}
    },
    "technology/iot/industrial_iot": {
      "caption": "Industrial IoT",
      "description": "IoT applications in industrial settings for automation, monitoring, and optimization.",
      "extends": "internet_of_things",
      "name": "industrial_iot",
      "attributes": {}
    },
    "technology/iot/iot": {
      "caption": "Internet of Things (IoT)",
      "description": "Connecting everyday objects to the internet for data exchange and automation.",
      "extends": "technology",
      "name": "internet_of_things",
      "attributes": {}
    },
    "technology/iot/iot_devices": {
      "caption": "IoT Devices",
      "description": "Physical devices embedded with sensors, software, and connectivity to collect and exchange data.",
      "extends": "internet_of_things",
      "name": "iot_devices",
      "attributes": {}
    },
    "technology/iot/iot_networks": {
      "caption": "IoT Networks",
      "description": "Communication protocols and network infrastructure for connecting IoT devices.",
      "extends": "internet_of_things",
      "name": "iot_networks",
      "attributes": {}
    },
    "technology/iot/iot_security": {
      "caption": "IoT Security",
      "description": "Protection of IoT devices, networks, and data from cyber threats and vulnerabilities.",
      "extends": "internet_of_things",
      "name": "iot_security",
      "attributes": {}
    },
    "technology/iot/smart_homes": {
      "caption": "Smart Homes",
      "description": "Residential environments with IoT devices for automation, monitoring, and control.",
      "extends": "internet_of_things",
      "name": "smart_homes",
      "attributes": {}
    },
    "technology/networking/network_architecture": {
      "caption": "Network Architecture",
      "description": "Design and structure of computer networks including topology, protocols, and components.",
      "extends": "networking",
      "name": "network_architecture",
      "attributes": {}
    },
    "technology/networking/network_management": {
      "caption": "Network Management",
      "description": "Tasks like monitoring, configuring, and optimizing networks.",
      "extends": "networking",
      "name": "network_management",
      "attributes": {}
    },
    "technology/networking/network_operations": {
      "caption": "Network Operations",
      "description": "Ensures the smooth operation and performance of network infrastructure.",
      "extends": "networking",
      "name": "network_operations",
      "attributes": {}
    },
    "technology/networking/network_protocols": {
      "caption": "Network Protocols",
      "description": "Rules and standards that govern communication between devices in a network.",
      "extends": "networking",
      "name": "network_protocols",
      "attributes": {}
    },
    "technology/networking/network_security": {
      "caption": "Network Security",
      "description": "Protection of network infrastructure and data from unauthorized access and attacks.",
      "extends": "networking",
      "name": "network_security",
      "attributes": {}
    },
    "technology/networking/networking": {
      "caption": "Networking",
      "description": "Design, management, and security of computer networks.",
      "extends": "technology",
      "name": "networking",
      "attributes": {}
    },
    "technology/security/application_security": {
      "caption": "Application Security",
      "description": "Security measures and practices to protect applications from threats and vulnerabilities.",
      "extends": "security",
      "name": "application_security",
      "attributes": {}
    },
    "technology/security/cyber_network_security": {
      "caption": "Cyber Network Security",
      "description": "Cybersecurity protection of network infrastructure and data from unauthorized access, misuse, or attacks.",
      "extends": "security",
      "name": "cyber_network_security",
      "attributes": {}
    },
    "technology/security/cybersecurity": {
      "caption": "Cybersecurity",
      "description": "Protection of computer systems, networks, and data from digital attacks and unauthorized access.",
      "extends": "security",
      "name": "cybersecurity",
      "attributes": {}
    },
    "technology/security/data_security": {
      "caption": "Data Security",
      "description": "Protection of digital data from unauthorized access, corruption, or theft throughout its lifecycle.",
      "extends": "security",
      "name": "data_security",
      "attributes": {}
    },
    "technology/security/identity_management": {
      "caption": "Identity Management",
      "description": "Processes and technologies for managing digital identities and controlling access to resources.",
      "extends": "security",
      "name": "identity_management",
      "attributes": {}
    },
    "technology/security/incident_management": {
      "caption": "Incident Management",
      "description": "Processes and tools for detecting, responding to, and resolving security incidents and IT service disruptions.",
      "extends": "security",
      "name": "incident_management",
      "attributes": {}
    },
    "technology/security/security": {
      "caption": "Security",
      "description": "Protecting systems, data, and networks from cyber threats and vulnerabilities.",
      "extends": "technology",
      "name": "security",
      "attributes": {}
    },
    "technology/software_engineering/apis_integration": {
      "caption": "APIs and Integration",
      "description": "Application Programming Interfaces and integration technologies that enable different software systems to communicate and work together.",
      "extends": "software_engineering",
      "name": "apis_integration",
      "attributes": {}
    },
    "technology/software_engineering/devops": {
      "caption": "DevOps",
      "description": "Practices that combine software development and IT operations to shorten development cycles and improve deployment reliability.",
      "extends": "software_engineering",
      "name": "devops",
      "attributes": {}
    },
    "technology/software_engineering/mlops": {
      "caption": "MLOps",
      "description": "Set of practices that combines machine learning and DevOps to standardize and streamline the machine learning lifecycle.",
      "extends": "software_engineering",
      "name": "mlops",
      "attributes": {}
    },
    "technology/software_engineering/quality_assurance": {
      "caption": "Quality Assurance",
      "description": "Processes and practices to ensure software quality through testing, code review, and quality standards.",
      "extends": "software_engineering",
      "name": "quality_assurance",
      "attributes": {}
    },
    "technology/software_engineering/software_development": {
      "caption": "Software Development",
      "description": "Process of designing, creating, testing, and maintaining software applications and systems.",
      "extends": "software_engineering",
      "name": "software_development",
      "attributes": {}
    },
    "technology/software_engineering/software_engineering": {
      "caption": "Software Engineering",
      "description": "Designing, developing, and maintaining software applications and systems.",
      "extends": "technology",
      "name": "software_engineering",
      "attributes": {}
    },
    "technology/technology": {
      "caption": "Technology",
      "description": "Development, management, and use of systems, devices, and software to solve problems and enhance human capabilities.",
      "extends": "base_domain",
      "name": "technology",
      "category": "technology",
      "attributes": {}
    },
    "telecommunications/internet_services": {
      "caption": "Internet Services",
      "description": "ISP operations, broadband services, internet connectivity, and access technologies",
      "extends": "telecommunications",
      "name": "internet_services",
      "attributes": {}
    },
    "telecommunications/iot_connectivity": {
      "caption": "IoT Connectivity",
      "description": "IoT networks, M2M communications, NB-IoT, LoRaWAN, and connected device management",
      "extends": "telecommunications",
      "name": "iot_connectivity",
      "attributes": {}
    },
    "telecommunications/network_infrastructure": {
      "caption": "Network Infrastructure",
      "description": "Telecom network design, fiber optics, network equipment, and infrastructure management",
      "extends": "telecommunications",
      "name": "network_infrastructure",
      "attributes": {}
    },
    "telecommunications/telecom_operations": {
      "caption": "Telecom Operations",
      "description": "Service provisioning, billing systems, customer management, and operations support",
      "extends": "telecommunications",
      "name": "telecom_operations",
      "attributes": {}
    },
    "telecommunications/telecommunications": {
      "caption": "Telecommunications",
      "description": "Domain covering network infrastructure, wireless communications, telecom services, and connectivity solutions",
      "extends": "base_domain",
      "name": "telecommunications",
      "category": "telecommunications",
      "attributes": {}
    },
    "telecommunications/voip_and_unified_communications": {
      "caption": "VoIP and Unified Communications",
      "description": "Voice over IP, video conferencing, unified communications platforms, and collaboration tools",
      "extends": "telecommunications",
      "name": "voip_and_unified_communications",
      "attributes": {}
    },
    "telecommunications/wireless_communications": {
      "caption": "Wireless Communications",
      "description": "Mobile networks, 5G/6G technology, wireless protocols, and cellular services",
      "extends": "telecommunications",
      "name": "wireless_communications",
      "attributes": {}
    },
    "transportation/automotive": {
      "caption": "Automotive",
      "description": "The design, development, manufacturing, and marketing of motor vehicles. Subdomains: Vehicle Design, Automotive Engineering, Electric Vehicles, and Vehicle Manufacturing.",
      "extends": "transportation",
      "name": "automotive",
      "attributes": {}
    },
    "transportation/autonomous_vehicles": {
      "caption": "Autonomous Vehicles",
      "description": "Vehicles equipped with technology to navigate and operate without human control. Subdomains: Self-Driving Cars, Autonomous Trucks, Sensor Technology, and Vehicle AI.",
      "extends": "transportation",
      "name": "autonomous_vehicles",
      "attributes": {}
    },
    "transportation/freight": {
      "caption": "Freight",
      "description": "The transportation of goods in bulk. Subdomains: Freight Forwarding, Cargo Management, Logistics Operations, and Freight Brokerage.",
      "extends": "transportation",
      "name": "freight",
      "attributes": {}
    },
    "transportation/logistics": {
      "caption": "Logistics",
      "description": "The coordination of complex operations involving people, facilities, and supplies. Subdomains: Warehousing, Distribution Management, Transportation Planning, and Reverse Logistics.",
      "extends": "transportation",
      "name": "logistics",
      "attributes": {}
    },
    "transportation/public_transit": {
      "caption": "Public Transit",
      "description": "Shared transportation services available for the public, such as buses and trains. Subdomains: Urban Transit Planning, Rail Systems, Bus Networks, and Transit Operations.",
      "extends": "transportation",
      "name": "public_transit",
      "attributes": {}
    },
    "transportation/supply_chain": {
      "caption": "Supply Chain",
      "description": "The system of production, processing, and distribution of goods. Subdomains: Supplier Management, Production Scheduling, Inventory Control, and Global Supply Chain.",
      "extends": "transportation",
      "name": "supply_chain",
      "attributes": {}
    },
    "transportation/transportation": {
      "caption": "Transportation",
      "description": "Systems and processes involved in the movement of goods and people, as well as the physical infrastructure supporting them. Subdomains: Logistics, Automotive, Public Transit, Supply Chain, Freight, and Autonomous Vehicles.",
      "extends": "base_domain",
      "name": "transportation",
      "category": "transportation",
      "attributes": {}
    },
    "trust_and_safety/content_moderation": {
      "caption": "Content Moderation",
      "description": "Reviewing and managing user-generated content to ensure it complies with community guidelines and legal standards. Subdomains: Automated Moderation, Community Guidelines, Human Moderation, and Harmful Content Detection.",
      "extends": "trust_and_safety",
      "name": "content_moderation",
      "attributes": {}
    },
    "trust_and_safety/data_privacy": {
      "caption": "Data Privacy",
      "description": "Safeguarding personal information from unauthorized access and ensuring compliance with privacy laws and regulations. Subdomains: Privacy Regulations Compliance, Data Encryption, Data Anonymization, and User Consent Management.",
      "extends": "trust_and_safety",
      "name": "data_privacy",
      "attributes": {}
    },
    "trust_and_safety/fraud_prevention": {
      "caption": "Fraud Prevention",
      "description": "Identifying and stopping fraudulent activities to protect individuals and organizations from financial and reputational damage. Subdomains: Transaction Monitoring, Identity Verification, Fraud Analytics, and Fraud Awareness Training.",
      "extends": "trust_and_safety",
      "name": "fraud_prevention",
      "attributes": {}
    },
    "trust_and_safety/online_safety": {
      "caption": "Online Safety",
      "description": "Protecting internet users from various forms of harm to ensure a secure digital environment. Subdomains: Cybersecurity Awareness, Child Online Protection, Identity Protection, and Digital Wellbeing.",
      "extends": "trust_and_safety",
      "name": "online_safety",
      "attributes": {}
    },
    "trust_and_safety/risk_management": {
      "caption": "Risk Management",
      "description": "Identifying, assessing, and prioritizing risks to minimize their impact on an organization's objectives and operations. Subdomains: Risk Assessment, Mitigation Strategies, Crisis Management, and Compliance and Auditing.",
      "extends": "trust_and_safety",
      "name": "risk_management",
      "attributes": {}
    },
    "trust_and_safety/trust_and_safety": {
      "caption": "Trust and Safety",
      "description": "Maintaining a secure and reliable environment, primarily online, by managing risks, preventing harm, and ensuring safety and privacy. Subdomains: Online Safety, Content Moderation, Fraud Prevention, Data Privacy, and Risk Management.",
      "extends": "base_domain",
      "name": "trust_and_safety",
      "category": "trust_and_safety",
      "attributes": {}
    }
  }
}
```

`/Users/shawwalters/babylon/agent0-ts/src/taxonomies/all_skills.json`:

```json
{
  "metadata": {
    "version": "0.8.0",
    "description": "Comprehensive collection of all OASF skills",
    "identifier_format": "Slash-separated path matching file structure (e.g., 'natural_language_processing/summarization')",
    "total_skills": 136
  },
  "categories": {
    "caption": "Skills",
    "description": "A structured view of distinct abilities, defining the capabilities within the Open Agentic Schema Framework.",
    "name": "skill_categories",
    "attributes": {
      "natural_language_processing": {
        "caption": "Natural Language Processing",
        "description": "Natural Language Processing (NLP) tasks are the application of computational techniques to the analysis and synthesis of natural language and speech."
      },
      "images_computer_vision": {
        "caption": "Images / Computer Vision",
        "description": "Images / Computer Vision tasks are the application of computational techniques to the analysis and synthesis of images."
      },
      "audio": {
        "caption": "Audio",
        "description": "Audio tasks are the application of computational techniques to the analysis and synthesis of audio data."
      },
      "tabular_text": {
        "caption": "Tabular / Text",
        "description": "Tabular / Text tasks are the application of computational techniques to the analysis and synthesis of tabular data and text."
      },
      "analytical_skills": {
        "caption": "Analytical skills",
        "description": "Analytical skills encompass a range of capabilities that involve logical reasoning, problem-solving, and the ability to process and interpret complex data."
      },
      "retrieval_augmented_generation": {
        "caption": "Retrieval Augmented Generation",
        "description": "Retrieval Augmented Generation tasks are the application of computational techniques to the analysis and synthesis of data from multiple modalities."
      },
      "multi_modal": {
        "caption": "Multi-modal",
        "description": "Multi-modal tasks are the application of computational techniques to the analysis and synthesis of data from multiple modalities."
      },
      "security_privacy": {
        "caption": "Security & Privacy",
        "description": "Skills focused on identifying, assessing, and mitigating security vulnerabilities, threats, sensitive data exposure, and privacy risks."
      },
      "data_engineering": {
        "caption": "Data Engineering",
        "description": "Skills for preparing, transforming, validating, and structuring data assets including cleaning, schema inference, and feature engineering."
      },
      "agent_orchestration": {
        "caption": "Agent Orchestration",
        "description": "Skills enabling coordination across multiple agents: planning, task decomposition, delegation, and collaboration protocols."
      },
      "evaluation_monitoring": {
        "caption": "Evaluation & Monitoring",
        "description": "Skills for assessing performance, generating tests, executing benchmarks, detecting anomalies, and tracking output quality over time."
      },
      "devops_mlops": {
        "caption": "DevOps / MLOps",
        "description": "Skills for provisioning infrastructure, managing deployments, CI/CD workflows, model/version lifecycle, and operational observability."
      },
      "governance_compliance": {
        "caption": "Governance & Compliance",
        "description": "Skills addressing regulatory alignment, policy mapping, auditing, risk classification, and ensuring responsible operations."
      },
      "tool_interaction": {
        "caption": "Tool Interaction",
        "description": "Skills for understanding APIs, integrating tools, orchestrating workflows, and using external systems effectively."
      },
      "advanced_reasoning_planning": {
        "caption": "Advanced Reasoning & Planning",
        "description": "Skills for multi-step strategic reasoning, long-horizon planning, hypothesis formation, and structured thought processes."
      }
    }
  },
  "skills": {
    "advanced_reasoning_planning/advanced_reasoning_planning": {
      "caption": "Advanced Reasoning & Planning",
      "category": "advanced_reasoning_planning",
      "extends": "base_skill",
      "name": "advanced_reasoning_planning",
      "attributes": {}
    },
    "advanced_reasoning_planning/chain_of_thought_structuring": {
      "caption": "Chain-of-Thought Structuring",
      "description": "Organizing intermediate reasoning steps into clear, justifiable sequences.",
      "extends": "advanced_reasoning_planning",
      "name": "chain_of_thought_structuring",
      "attributes": {}
    },
    "advanced_reasoning_planning/hypothesis_generation": {
      "caption": "Hypothesis Generation",
      "description": "Proposing plausible explanations or solution pathways for incomplete or uncertain scenarios.",
      "extends": "advanced_reasoning_planning",
      "name": "hypothesis_generation",
      "attributes": {}
    },
    "advanced_reasoning_planning/long_horizon_reasoning": {
      "caption": "Long-Horizon Reasoning",
      "description": "Maintaining coherent reasoning chains over extended sequences of steps or time.",
      "extends": "advanced_reasoning_planning",
      "name": "long_horizon_reasoning",
      "attributes": {}
    },
    "advanced_reasoning_planning/strategic_planning": {
      "caption": "Strategic Planning",
      "description": "Formulating high-level multi-phase strategies aligned with long-term objectives.",
      "extends": "advanced_reasoning_planning",
      "name": "strategic_planning",
      "attributes": {}
    },
    "agent_orchestration/agent_coordination": {
      "caption": "Agent Coordination",
      "description": "Managing real-time collaboration and state synchronization among agents.",
      "extends": "agent_orchestration",
      "name": "agent_coordination",
      "attributes": {}
    },
    "agent_orchestration/agent_orchestration": {
      "caption": "Agent Orchestration",
      "category": "agent_orchestration",
      "extends": "base_skill",
      "name": "agent_orchestration",
      "attributes": {}
    },
    "agent_orchestration/multi_agent_planning": {
      "caption": "Multi-Agent Planning",
      "description": "Coordinating plans across multiple agents, resolving dependencies and optimizing sequencing.",
      "extends": "agent_orchestration",
      "name": "multi_agent_planning",
      "attributes": {}
    },
    "agent_orchestration/negotiation_resolution": {
      "caption": "Negotiation & Resolution",
      "description": "Facilitating negotiation, conflict handling, and consensus-building between agents.",
      "extends": "agent_orchestration",
      "name": "negotiation_resolution",
      "attributes": {}
    },
    "agent_orchestration/role_assignment": {
      "caption": "Role Assignment",
      "description": "Allocating responsibilities to agents based on capabilities and task requirements.",
      "extends": "agent_orchestration",
      "name": "role_assignment",
      "attributes": {}
    },
    "agent_orchestration/task_decomposition": {
      "caption": "Task Decomposition",
      "description": "Breaking complex objectives into structured, atomic subtasks.",
      "extends": "agent_orchestration",
      "name": "task_decomposition",
      "attributes": {}
    },
    "analytical_skills/analytical_skills": {
      "caption": "Analytical Skills",
      "category": "analytical_skills",
      "extends": "base_skill",
      "name": "analytical_skills",
      "attributes": {}
    },
    "analytical_skills/coding_skills/code_optimization": {
      "caption": "Code Refactoring and Optimization",
      "description": "Rewriting and optimizing existing code through refactoring techniques.",
      "extends": "coding_skills",
      "name": "code_optimization",
      "attributes": {}
    },
    "analytical_skills/coding_skills/code_templates": {
      "caption": "Code Template Filling",
      "description": "Automatically filling in code templates with appropriate content.",
      "extends": "coding_skills",
      "name": "code_templates",
      "attributes": {}
    },
    "analytical_skills/coding_skills/code_to_docstrings": {
      "caption": "Code to Docstrings",
      "description": "Generating natural language documentation for code segments.",
      "extends": "coding_skills",
      "name": "code_to_docstrings",
      "attributes": {}
    },
    "analytical_skills/coding_skills/coding_skills": {
      "caption": "Coding Skills",
      "description": "Capabilities for code generation, documentation, and optimization.",
      "extends": "analytical_skills",
      "name": "coding_skills",
      "attributes": {}
    },
    "analytical_skills/coding_skills/text_to_code": {
      "caption": "Text to Code",
      "description": "Translating natural language instructions into executable code.",
      "extends": "coding_skills",
      "name": "text_to_code",
      "attributes": {}
    },
    "analytical_skills/mathematical_reasoning/geometry": {
      "caption": "Geometry",
      "description": "Solving geometric problems and spatial reasoning tasks.",
      "extends": "mathematical_reasoning",
      "name": "geometry",
      "attributes": {}
    },
    "analytical_skills/mathematical_reasoning/math_word_problems": {
      "caption": "Math Word Problems",
      "description": "Solving mathematical exercises presented in natural language format.",
      "extends": "mathematical_reasoning",
      "name": "math_word_problems",
      "attributes": {}
    },
    "analytical_skills/mathematical_reasoning/mathematical_reasoning": {
      "caption": "Mathematical Reasoning",
      "description": "Capabilities for solving mathematical problems and proving theorems.",
      "extends": "analytical_skills",
      "name": "mathematical_reasoning",
      "attributes": {}
    },
    "analytical_skills/mathematical_reasoning/pure_math_operations": {
      "caption": "Pure Mathematical Operations",
      "description": "Executing pure mathematical operations, such as arithmetic calculations.",
      "extends": "mathematical_reasoning",
      "name": "pure_math_operations",
      "attributes": {}
    },
    "analytical_skills/mathematical_reasoning/theorem_proving": {
      "caption": "Automated Theorem Proving",
      "description": "Proving mathematical theorems using computational methods.",
      "extends": "mathematical_reasoning",
      "name": "theorem_proving",
      "attributes": {}
    },
    "audio/audio": {
      "caption": "Audio Processing",
      "category": "audio",
      "extends": "base_skill",
      "name": "audio",
      "attributes": {}
    },
    "audio/audio_classification": {
      "caption": "Audio Classification",
      "description": "Assigning labels or classes to audio content based on its characteristics.",
      "extends": "audio",
      "name": "audio_classification",
      "attributes": {}
    },
    "audio/audio_to_audio": {
      "caption": "Audio to Audio",
      "description": "Transforming audio through various manipulations including cutting, filtering, and mixing.",
      "extends": "audio",
      "name": "audio_to_audio",
      "attributes": {}
    },
    "data_engineering/data_cleaning": {
      "caption": "Data Cleaning",
      "description": "Detecting and correcting errors, inconsistencies, and missing values to improve dataset quality.",
      "extends": "data_engineering",
      "name": "data_cleaning",
      "attributes": {}
    },
    "data_engineering/data_engineering": {
      "caption": "Data Engineering",
      "category": "data_engineering",
      "extends": "base_skill",
      "name": "data_engineering",
      "attributes": {}
    },
    "data_engineering/data_quality_assessment": {
      "caption": "Data Quality Assessment",
      "description": "Evaluating datasets for completeness, validity, consistency, and timeliness.",
      "extends": "data_engineering",
      "name": "data_quality_assessment",
      "attributes": {}
    },
    "data_engineering/data_transformation_pipeline": {
      "caption": "Data Transformation Pipeline",
      "description": "Designing or explaining multi-step sequences that extract, transform, and load datasets.",
      "extends": "data_engineering",
      "name": "data_transformation_pipeline",
      "attributes": {}
    },
    "data_engineering/feature_engineering": {
      "caption": "Feature Engineering",
      "description": "Constructing informative transformed variables to improve downstream model performance.",
      "extends": "data_engineering",
      "name": "feature_engineering",
      "attributes": {}
    },
    "data_engineering/schema_inference": {
      "caption": "Schema Inference",
      "description": "Deriving structural metadata (fields, types, relationships) from raw or semi-structured data.",
      "extends": "data_engineering",
      "name": "schema_inference",
      "attributes": {}
    },
    "devops_mlops/ci_cd_configuration": {
      "caption": "CI/CD Configuration",
      "description": "Designing or modifying continuous integration and delivery workflows and pipelines.",
      "extends": "devops_mlops",
      "name": "ci_cd_configuration",
      "attributes": {}
    },
    "devops_mlops/deployment_orchestration": {
      "caption": "Deployment Orchestration",
      "description": "Coordinating multi-stage application or model deployments, rollbacks, and version transitions.",
      "extends": "devops_mlops",
      "name": "deployment_orchestration",
      "attributes": {}
    },
    "devops_mlops/devops_mlops": {
      "caption": "DevOps / MLOps",
      "category": "devops_mlops",
      "extends": "base_skill",
      "name": "devops_mlops",
      "attributes": {}
    },
    "devops_mlops/infrastructure_provisioning": {
      "caption": "Infrastructure Provisioning",
      "description": "Defining or explaining steps to allocate and configure compute, storage, and networking resources.",
      "extends": "devops_mlops",
      "name": "infrastructure_provisioning",
      "attributes": {}
    },
    "devops_mlops/model_versioning": {
      "caption": "Model Versioning",
      "description": "Tracking, promoting, and documenting different iterations of models and their artifacts.",
      "extends": "devops_mlops",
      "name": "model_versioning",
      "attributes": {}
    },
    "devops_mlops/monitoring_alerting": {
      "caption": "Monitoring & Alerting",
      "description": "Configuring and interpreting telemetry signals, thresholds, and alerts for operational health.",
      "extends": "devops_mlops",
      "name": "monitoring_alerting",
      "attributes": {}
    },
    "evaluation_monitoring/anomaly_detection": {
      "caption": "Anomaly Detection",
      "description": "Identifying unusual patterns, drifts, or deviations in data or model outputs.",
      "extends": "evaluation_monitoring",
      "name": "anomaly_detection",
      "attributes": {}
    },
    "evaluation_monitoring/benchmark_execution": {
      "caption": "Benchmark Execution",
      "description": "Running standardized benchmarks or evaluation suites and summarizing results.",
      "extends": "evaluation_monitoring",
      "name": "benchmark_execution",
      "attributes": {}
    },
    "evaluation_monitoring/evaluation_monitoring": {
      "caption": "Evaluation & Monitoring",
      "category": "evaluation_monitoring",
      "extends": "base_skill",
      "name": "evaluation_monitoring",
      "attributes": {}
    },
    "evaluation_monitoring/performance_monitoring": {
      "caption": "Performance Monitoring",
      "description": "Tracking latency, throughput, resource utilization, and service reliability over time.",
      "extends": "evaluation_monitoring",
      "name": "performance_monitoring",
      "attributes": {}
    },
    "evaluation_monitoring/quality_evaluation": {
      "caption": "Quality Evaluation",
      "description": "Assessing outputs for accuracy, relevance, coherence, safety, and style adherence.",
      "extends": "evaluation_monitoring",
      "name": "quality_evaluation",
      "attributes": {}
    },
    "evaluation_monitoring/test_case_generation": {
      "caption": "Test Case Generation",
      "description": "Creating targeted test inputs or scenarios to probe system behavior and edge cases.",
      "extends": "evaluation_monitoring",
      "name": "test_case_generation",
      "attributes": {}
    },
    "governance_compliance/audit_trail_summarization": {
      "caption": "Audit Trail Summarization",
      "description": "Condensing system event or transaction logs into human-readable compliance or oversight summaries.",
      "extends": "governance_compliance",
      "name": "audit_trail_summarization",
      "attributes": {}
    },
    "governance_compliance/compliance_assessment": {
      "caption": "Compliance Assessment",
      "description": "Evaluating processes or outputs against defined standards (e.g., GDPR, HIPAA) and identifying gaps.",
      "extends": "governance_compliance",
      "name": "compliance_assessment",
      "attributes": {}
    },
    "governance_compliance/governance_compliance": {
      "caption": "Governance & Compliance",
      "category": "governance_compliance",
      "extends": "base_skill",
      "name": "governance_compliance",
      "attributes": {}
    },
    "governance_compliance/policy_mapping": {
      "caption": "Policy Mapping",
      "description": "Translating organizational or regulatory policies into structured, enforceable rules or checklists.",
      "extends": "governance_compliance",
      "name": "policy_mapping",
      "attributes": {}
    },
    "governance_compliance/risk_classification": {
      "caption": "Risk Classification",
      "description": "Categorizing potential operational or data-related risks by impact and likelihood for prioritization.",
      "extends": "governance_compliance",
      "name": "risk_classification",
      "attributes": {}
    },
    "images_computer_vision/depth_estimation": {
      "caption": "Depth Estimation",
      "description": "Predicting the distance or depth of objects within a scene from a single image or multiple images.",
      "extends": "images_computer_vision",
      "name": "depth_estimation",
      "attributes": {}
    },
    "images_computer_vision/image_classification": {
      "caption": "Image Classification",
      "description": "Assigning labels or categories to images based on their visual content.",
      "extends": "images_computer_vision",
      "name": "image_classification",
      "attributes": {}
    },
    "images_computer_vision/image_feature_extraction": {
      "caption": "Image Module Extraction",
      "description": "Identifying and isolating key characteristics or patterns from an image to aid in tasks like classification or recognition.",
      "extends": "images_computer_vision",
      "name": "image_feature_extraction",
      "attributes": {}
    },
    "images_computer_vision/image_generation": {
      "caption": "Image Generation",
      "description": "Creating new images from learned patterns or data using machine learning models.",
      "extends": "images_computer_vision",
      "name": "image_generation",
      "attributes": {}
    },
    "images_computer_vision/image_segmentation": {
      "caption": "Image Segmentation",
      "description": "Assigning labels or categories to images based on their visual content.",
      "extends": "images_computer_vision",
      "name": "image_segmentation",
      "attributes": {}
    },
    "images_computer_vision/image_to_3d": {
      "caption": "Image-to-3D",
      "description": "The process of converting a 2D image into a 3D representation or model, often by inferring depth and spatial relationships.",
      "extends": "images_computer_vision",
      "name": "image_to_3d",
      "attributes": {}
    },
    "images_computer_vision/image_to_image": {
      "caption": "Image-to-Image",
      "description": "Transforming one image into another using a learned mapping, often for tasks like style transfer, colorization, or image enhancement.",
      "extends": "images_computer_vision",
      "name": "image_to_image",
      "attributes": {}
    },
    "images_computer_vision/images_computer_vision": {
      "caption": "Images / Computer Vision",
      "category": "images_computer_vision",
      "extends": "base_skill",
      "name": "images_computer_vision",
      "attributes": {}
    },
    "images_computer_vision/keypoint_detection": {
      "caption": "Keypoint Detection",
      "description": "Identifying and locating specific points of interest within an image or object.",
      "extends": "images_computer_vision",
      "name": "keypoint_detection",
      "attributes": {}
    },
    "images_computer_vision/mask_generation": {
      "caption": "Mask Generation",
      "description": "Producing segmented regions in an image to highlight specific areas or objects, typically represented as separate layers or overlays.",
      "extends": "images_computer_vision",
      "name": "mask_generation",
      "attributes": {}
    },
    "images_computer_vision/object_detection": {
      "caption": "Object Detection",
      "description": "Identifying and locating specific objects within an image or video, often by drawing bounding boxes around them.",
      "extends": "images_computer_vision",
      "name": "object_detection",
      "attributes": {}
    },
    "images_computer_vision/video_classification": {
      "caption": "Video Classification",
      "description": "Assigning labels or categories to entire videos or segments based on their visual and audio content.",
      "extends": "images_computer_vision",
      "name": "video_classification",
      "attributes": {}
    },
    "multi_modal/any_to_any": {
      "caption": "Any to Any Transformation",
      "description": "Converting between any supported modalities (text, image, audio, video, or 3D).",
      "extends": "multi_modal",
      "name": "any_to_any",
      "attributes": {}
    },
    "multi_modal/audio_processing/audio_processing": {
      "caption": "Audio Processing",
      "description": "Capabilities for processing audio, including speech synthesis and recognition.",
      "extends": "multi_modal",
      "name": "audio_processing",
      "attributes": {}
    },
    "multi_modal/audio_processing/speech_recognition": {
      "caption": "Automatic Speech Recognition",
      "description": "Converting spoken language into written text.",
      "extends": "audio_processing",
      "name": "speech_recognition",
      "attributes": {}
    },
    "multi_modal/audio_processing/text_to_speech": {
      "caption": "Text to Speech",
      "description": "Converting text into natural-sounding speech audio.",
      "extends": "audio_processing",
      "name": "text_to_speech",
      "attributes": {}
    },
    "multi_modal/image_processing/image_processing": {
      "caption": "Image Processing",
      "description": "Capabilities for processing and generating images from various inputs and generating textual descriptions of visual content.",
      "extends": "multi_modal",
      "name": "image_processing",
      "attributes": {}
    },
    "multi_modal/image_processing/image_to_text": {
      "caption": "Image to Text",
      "description": "Generating textual descriptions or captions for images.",
      "extends": "image_processing",
      "name": "image_to_text",
      "attributes": {}
    },
    "multi_modal/image_processing/text_to_3d": {
      "caption": "Text to 3D",
      "description": "Generating 3D objects or scenes based on textual descriptions.",
      "extends": "image_processing",
      "name": "text_to_3d",
      "attributes": {}
    },
    "multi_modal/image_processing/text_to_image": {
      "caption": "Text to Image",
      "description": "Generating images based on textual descriptions or instructions.",
      "extends": "image_processing",
      "name": "text_to_image",
      "attributes": {}
    },
    "multi_modal/image_processing/text_to_video": {
      "caption": "Text to Video",
      "description": "Generating video content based on textual descriptions or instructions.",
      "extends": "image_processing",
      "name": "text_to_video",
      "attributes": {}
    },
    "multi_modal/image_processing/visual_qa": {
      "caption": "Visual Question Answering",
      "description": "Answering questions about images using natural language.",
      "extends": "image_processing",
      "name": "visual_qa",
      "attributes": {}
    },
    "multi_modal/multi_modal": {
      "caption": "Multi Modal",
      "category": "multi_modal",
      "description": "Capabilities for transforming content between different modalities (text, image, audio, video, or 3D).",
      "extends": "base_skill",
      "name": "multi_modal",
      "attributes": {}
    },
    "natural_language_processing/analytical_reasoning/analytical_reasoning": {
      "caption": "Analytical and Logical Reasoning",
      "description": "Capabilities for performing logical analysis, inference, and problem-solving tasks.",
      "extends": "natural_language_processing",
      "name": "analytical_reasoning",
      "attributes": {}
    },
    "natural_language_processing/analytical_reasoning/fact_verification": {
      "caption": "Fact and Claim Verification",
      "description": "Verifying facts and claims given a reference text.",
      "extends": "analytical_reasoning",
      "name": "fact_verification",
      "attributes": {}
    },
    "natural_language_processing/analytical_reasoning/inference_deduction": {
      "caption": "Inference and Deduction",
      "description": "Making logical inferences based on provided information.",
      "extends": "analytical_reasoning",
      "name": "inference_deduction",
      "attributes": {}
    },
    "natural_language_processing/analytical_reasoning/problem_solving": {
      "caption": "Problem Solving",
      "description": "Assisting with solving problems by generating potential solutions or strategies.",
      "extends": "analytical_reasoning",
      "name": "problem_solving",
      "attributes": {}
    },
    "natural_language_processing/creative_content/creative_content": {
      "caption": "Creative Content Generation",
      "description": "Capabilities for generating various forms of creative content, including narratives, poetry, and other creative writing forms.",
      "extends": "natural_language_processing",
      "name": "creative_content",
      "attributes": {}
    },
    "natural_language_processing/creative_content/poetry_writing": {
      "caption": "Poetry and Creative Writing",
      "description": "Composing poems, prose, or other forms of creative literature.",
      "extends": "creative_content",
      "name": "poetry_writing",
      "attributes": {}
    },
    "natural_language_processing/creative_content/storytelling": {
      "caption": "Storytelling",
      "description": "Creating narratives, stories, or fictional content with creativity and coherence.",
      "extends": "creative_content",
      "name": "storytelling",
      "attributes": {}
    },
    "natural_language_processing/ethical_interaction/bias_mitigation": {
      "caption": "Bias Mitigation",
      "description": "Reducing or eliminating biased language and ensuring fair and unbiased output.",
      "extends": "ethical_interaction",
      "name": "bias_mitigation",
      "attributes": {}
    },
    "natural_language_processing/ethical_interaction/content_moderation": {
      "caption": "Content Moderation",
      "description": "Avoiding the generation of harmful, inappropriate, or sensitive content.",
      "extends": "ethical_interaction",
      "name": "content_moderation",
      "attributes": {}
    },
    "natural_language_processing/ethical_interaction/ethical_interaction": {
      "caption": "Ethical and Safe Interaction",
      "description": "Capabilities for ensuring ethical, unbiased, and safe content generation and interaction.",
      "extends": "natural_language_processing",
      "name": "ethical_interaction",
      "attributes": {}
    },
    "natural_language_processing/feature_extraction/feature_extraction": {
      "caption": "Module Extraction",
      "description": "Capabilities for extracting and representing textual features as vectors for downstream tasks.",
      "extends": "natural_language_processing",
      "name": "feature_extraction",
      "attributes": {}
    },
    "natural_language_processing/feature_extraction/model_feature_extraction": {
      "caption": "Model Module Extraction",
      "description": "Representing parts of text with vectors to be used as input to other tasks.",
      "extends": "feature_extraction",
      "name": "model_feature_extraction",
      "attributes": {}
    },
    "natural_language_processing/information_retrieval_synthesis/document_passage_retrieval": {
      "caption": "Document and Passage Retrieval",
      "description": "Capability to identify and retrieve relevant documents or text passages based on specific criteria or queries from a larger collection of texts.",
      "extends": "information_retrieval_synthesis",
      "name": "document_passage_retrieval",
      "attributes": {}
    },
    "natural_language_processing/information_retrieval_synthesis/fact_extraction": {
      "caption": "Fact Extraction",
      "description": "Capability to identify and extract factual information from text documents or knowledge bases, including entities, relationships, and key data points.",
      "extends": "information_retrieval_synthesis",
      "name": "fact_extraction",
      "attributes": {}
    },
    "natural_language_processing/information_retrieval_synthesis/information_retrieval_synthesis": {
      "caption": "Information Retrieval and Synthesis",
      "description": "Capabilities for retrieving relevant information from various sources and synthesizing it into coherent, contextually appropriate responses. This includes searching, extracting, combining, and presenting information in a meaningful way.",
      "extends": "natural_language_processing",
      "name": "information_retrieval_synthesis",
      "attributes": {}
    },
    "natural_language_processing/information_retrieval_synthesis/knowledge_synthesis": {
      "caption": "Knowledge Synthesis",
      "description": "Capability to aggregate and combine information from multiple sources, creating comprehensive and coherent responses while maintaining context and relevance.",
      "extends": "information_retrieval_synthesis",
      "name": "knowledge_synthesis",
      "attributes": {}
    },
    "natural_language_processing/information_retrieval_synthesis/question_answering": {
      "caption": "Question Answering",
      "description": "System capability to understand questions and provide accurate, relevant answers by analyzing available information sources.",
      "extends": "information_retrieval_synthesis",
      "name": "question_answering",
      "attributes": {}
    },
    "natural_language_processing/information_retrieval_synthesis/search": {
      "caption": "Search",
      "description": "Capability to perform efficient and accurate searches within large textual databases based on various criteria, including keywords, semantic meaning, or complex queries.",
      "extends": "information_retrieval_synthesis",
      "name": "information_retrieval_synthesis_search",
      "attributes": {}
    },
    "natural_language_processing/information_retrieval_synthesis/sentence_similarity": {
      "caption": "Sentence Similarity",
      "description": "Capability to analyze and determine the semantic similarity between sentences, supporting tasks like search, matching, and content comparison.",
      "extends": "information_retrieval_synthesis",
      "name": "sentence_similarity",
      "attributes": {}
    },
    "natural_language_processing/language_translation/language_translation": {
      "caption": "Language Translation and Multilingual Support",
      "description": "Capabilities for handling multiple languages, including translation and multilingual text processing.",
      "extends": "natural_language_processing",
      "name": "language_translation",
      "attributes": {}
    },
    "natural_language_processing/language_translation/multilingual_understanding": {
      "caption": "Multilingual Understanding",
      "description": "Recognizing and processing text in multiple languages.",
      "extends": "language_translation",
      "name": "multilingual_understanding",
      "attributes": {}
    },
    "natural_language_processing/language_translation/translation": {
      "caption": "Translation",
      "description": "Converting text from one language to another while maintaining meaning and context.",
      "extends": "language_translation",
      "name": "translation",
      "attributes": {}
    },
    "natural_language_processing/natural_language_generation/dialogue_generation": {
      "caption": "Dialogue Generation",
      "description": "Producing conversational responses that are contextually relevant and engaging within a dialogue context.",
      "extends": "natural_language_generation",
      "name": "dialogue_generation",
      "attributes": {}
    },
    "natural_language_processing/natural_language_generation/natural_language_generation": {
      "caption": "Natural Language Generation",
      "description": "Natural Language Generation (NLG) describes the ability to generate human-like text from structured data or other inputs.",
      "extends": "natural_language_processing",
      "name": "natural_language_generation",
      "attributes": {}
    },
    "natural_language_processing/natural_language_generation/paraphrasing": {
      "caption": "Text Paraphrasing",
      "description": "Rewriting text to express the same ideas using different words and structures while maintaining the original meaning.",
      "extends": "natural_language_generation",
      "name": "paraphrasing",
      "attributes": {}
    },
    "natural_language_processing/natural_language_generation/question_generation": {
      "caption": "Question Generation",
      "description": "Automatically generating relevant and meaningful questions from a given text or context.",
      "extends": "natural_language_generation",
      "name": "question_generation",
      "attributes": {}
    },
    "natural_language_processing/natural_language_generation/story_generation": {
      "caption": "Story Generation",
      "description": "Generating a piece of text given a description or a first sentence to complete.",
      "extends": "natural_language_generation",
      "name": "story_generation",
      "attributes": {}
    },
    "natural_language_processing/natural_language_generation/style_transfer": {
      "caption": "Text Style Transfer",
      "description": "Rewriting text to match the style of a given reference text while preserving the original content.",
      "extends": "natural_language_generation",
      "name": "text_style_transfer",
      "attributes": {}
    },
    "natural_language_processing/natural_language_generation/summarization": {
      "caption": "Text Summarization",
      "description": "Condensing longer texts into concise summaries while preserving essential information and maintaining coherence.",
      "extends": "natural_language_generation",
      "name": "summarization",
      "attributes": {}
    },
    "natural_language_processing/natural_language_generation/text_completion": {
      "caption": "Text Completion",
      "description": "Continuing a given text prompt in a coherent and contextually appropriate manner to generate fluent and contextually relevant content.",
      "extends": "natural_language_generation",
      "name": "text_completion",
      "attributes": {}
    },
    "natural_language_processing/natural_language_processing": {
      "caption": "Natural Language Processing",
      "category": "natural_language_processing",
      "extends": "base_skill",
      "name": "natural_language_processing",
      "attributes": {}
    },
    "natural_language_processing/natural_language_understanding/contextual_comprehension": {
      "caption": "Contextual Comprehension",
      "description": "Understanding the context and nuances of text input to provide relevant responses.",
      "extends": "natural_language_understanding",
      "name": "contextual_comprehension",
      "attributes": {}
    },
    "natural_language_processing/natural_language_understanding/entity_recognition": {
      "caption": "Entity Recognition",
      "description": "Identifying and categorizing key entities within the text, such as names, dates, or locations.",
      "extends": "natural_language_understanding",
      "name": "entity_recognition",
      "attributes": {}
    },
    "natural_language_processing/natural_language_understanding/natural_language_understanding": {
      "caption": "Natural Language Understanding",
      "description": "Natural Language Understanding (NLU) focuses on the ability to interpret and comprehend human language, including understanding context, semantics, and identifying key entities within text.",
      "extends": "natural_language_processing",
      "name": "natural_language_understanding",
      "attributes": {}
    },
    "natural_language_processing/natural_language_understanding/semantic_understanding": {
      "caption": "Semantic Understanding",
      "description": "Grasping the meaning and intent behind words and phrases.",
      "extends": "natural_language_understanding",
      "name": "semantic_understanding",
      "attributes": {}
    },
    "natural_language_processing/personalization/personalization": {
      "caption": "Personalisation and Adaptation",
      "description": "Capabilities for adapting and personalizing content based on user context and preferences.",
      "extends": "natural_language_processing",
      "name": "personalization",
      "attributes": {}
    },
    "natural_language_processing/personalization/style_adjustment": {
      "caption": "Tone and Style Adjustment",
      "description": "Modifying the tone or style of generated text to suit specific audiences or purposes.",
      "extends": "personalization",
      "name": "style_adjustment",
      "attributes": {}
    },
    "natural_language_processing/personalization/user_adaptation": {
      "caption": "User Adaptation",
      "description": "Tailoring responses based on user preferences, history, or context.",
      "extends": "personalization",
      "name": "user_adaptation",
      "attributes": {}
    },
    "natural_language_processing/text_classification/natural_language_inference": {
      "caption": "Natural Language Inference",
      "description": "Classifying the relation between two texts, like a contradiction, entailment, and others.",
      "extends": "text_classification",
      "name": "natural_language_inference",
      "attributes": {}
    },
    "natural_language_processing/text_classification/sentiment_analysis": {
      "caption": "Sentiment Analysis",
      "description": "Classify the sentiment of a text, that is, a positive movie review.",
      "extends": "text_classification",
      "name": "sentiment_analysis",
      "attributes": {}
    },
    "natural_language_processing/text_classification/text_classification": {
      "caption": "Text Classification",
      "description": "Capabilities for classifying and categorizing text into predefined categories or labels.",
      "extends": "natural_language_processing",
      "name": "text_classification",
      "attributes": {}
    },
    "natural_language_processing/text_classification/topic_labeling": {
      "caption": "Topic Labelling and Tagging",
      "description": "Classifying a text as belong to one of several topics, which can be used to tag a text.",
      "extends": "text_classification",
      "name": "topic_labeling",
      "attributes": {}
    },
    "natural_language_processing/token_classification/named_entity_recognition": {
      "caption": "Named Entity Recognition",
      "description": "Task to recognize names as entity, for example, people, locations, buildings, and so on.",
      "extends": "token_classification",
      "name": "named_entity_recognition",
      "attributes": {}
    },
    "natural_language_processing/token_classification/pos_tagging": {
      "caption": "Part-of-Speech Tagging",
      "description": "Tagging each part of a sentence as nouns, adjectives, verbs, and so on.",
      "extends": "token_classification",
      "name": "pos_tagging",
      "attributes": {}
    },
    "natural_language_processing/token_classification/token_classification": {
      "caption": "Token Classification",
      "description": "Capabilities for classifying individual tokens or words within text.",
      "extends": "natural_language_processing",
      "name": "token_classification",
      "attributes": {}
    },
    "retrieval_augmented_generation/document_or_database_question_answering": {
      "caption": "Document or Database Question Answering",
      "description": "Document or database question answering is the process of retrieving and using information from a document or database to answer a specific question.",
      "extends": "retrieval_augmented_generation",
      "name": "document_or_database_question_answering",
      "attributes": {}
    },
    "retrieval_augmented_generation/generation_of_any": {
      "caption": "Generation of Any",
      "description": "Generation of any is augmenting the creation of text, images, audio, or other media by incorporating retrieved information to improve or guide the generation process.",
      "extends": "retrieval_augmented_generation",
      "name": "generation_of_any",
      "attributes": {}
    },
    "retrieval_augmented_generation/retrieval_augmented_generation": {
      "caption": "Retrieval Augmented Generation",
      "category": "retrieval_augmented_generation",
      "extends": "base_skill",
      "name": "retrieval_augmented_generation",
      "attributes": {}
    },
    "retrieval_augmented_generation/retrieval_of_information/document_retrieval": {
      "caption": "Document Retrieval",
      "description": "Document retrieval is the process of retrieving relevant documents from a collection based on a specific query, typically through indexing and search techniques.",
      "extends": "retrieval_of_information",
      "name": "document_retrieval",
      "attributes": {}
    },
    "retrieval_augmented_generation/retrieval_of_information/indexing": {
      "caption": "Indexing",
      "description": "Depth estimations the task of predicting the distance or depth of objects within a scene from a single image or multiple images.",
      "extends": "retrieval_of_information",
      "name": "indexing",
      "attributes": {}
    },
    "retrieval_augmented_generation/retrieval_of_information/retrieval_of_information": {
      "caption": "Retrieval of Information",
      "description": "Retrieval of information is the process of fetching relevant data or documents from a large dataset or database based on a specific query or input.",
      "extends": "retrieval_augmented_generation",
      "name": "retrieval_of_information",
      "attributes": {}
    },
    "retrieval_augmented_generation/retrieval_of_information/search": {
      "caption": "Search",
      "description": "Search is the process of exploring a dataset or index to find relevant information or results based on a given query.",
      "extends": "retrieval_of_information",
      "name": "retrieval_of_information_search",
      "attributes": {}
    },
    "security_privacy/privacy_risk_assessment": {
      "caption": "Privacy Risk Assessment",
      "description": "Evaluating data handling or user flows to surface potential privacy risks and recommend mitigations.",
      "extends": "security_privacy",
      "name": "privacy_risk_assessment",
      "attributes": {}
    },
    "security_privacy/secret_leak_detection": {
      "caption": "Secret Leak Detection",
      "description": "Scanning artifacts (code, logs, documents) to identify exposed credentials, tokens, or other sensitive secrets.",
      "extends": "security_privacy",
      "name": "secret_leak_detection",
      "attributes": {}
    },
    "security_privacy/security_privacy": {
      "caption": "Security & Privacy",
      "category": "security_privacy",
      "extends": "base_skill",
      "name": "security_privacy",
      "attributes": {}
    },
    "security_privacy/threat_detection": {
      "caption": "Threat Detection",
      "description": "Identifying indicators of malicious activity, suspicious patterns, or emerging threats across logs and data sources.",
      "extends": "security_privacy",
      "name": "threat_detection",
      "attributes": {}
    },
    "security_privacy/vulnerability_analysis": {
      "caption": "Vulnerability Analysis",
      "description": "Reviewing code, configurations, or dependency manifests to surface potential security weaknesses and misconfigurations.",
      "extends": "security_privacy",
      "name": "vulnerability_analysis",
      "attributes": {}
    },
    "tabular_text/tabular_classification": {
      "caption": "Tabular Classification",
      "description": "Classifying data based on attributes using classical machine learning approaches.",
      "extends": "tabular_text",
      "name": "tabular_classification",
      "attributes": {}
    },
    "tabular_text/tabular_regression": {
      "caption": "Tabular Regression",
      "description": "Predicting numerical values based on tabular attributes and features.",
      "extends": "tabular_text",
      "name": "tabular_regression",
      "attributes": {}
    },
    "tabular_text/tabular_text": {
      "caption": "Tabular / Text",
      "category": "tabular_text",
      "extends": "base_skill",
      "name": "tabular_text",
      "attributes": {}
    },
    "tool_interaction/api_schema_understanding": {
      "caption": "API Schema Understanding",
      "description": "Interpreting and explaining API specifications, endpoints, parameters, and expected payloads.",
      "extends": "tool_interaction",
      "name": "api_schema_understanding",
      "attributes": {}
    },
    "tool_interaction/script_integration": {
      "caption": "Script Integration",
      "description": "Linking custom scripts or functions with external tools to extend capabilities.",
      "extends": "tool_interaction",
      "name": "script_integration",
      "attributes": {}
    },
    "tool_interaction/tool_interaction": {
      "caption": "Tool Interaction",
      "category": "tool_interaction",
      "extends": "base_skill",
      "name": "tool_interaction",
      "attributes": {}
    },
    "tool_interaction/tool_use_planning": {
      "caption": "Tool Use Planning",
      "description": "Selecting and ordering tool invocations to accomplish a specified goal efficiently.",
      "extends": "tool_interaction",
      "name": "tool_use_planning",
      "attributes": {}
    },
    "tool_interaction/workflow_automation": {
      "caption": "Workflow Automation",
      "description": "Designing or describing automated sequences integrating multiple tools or services.",
      "extends": "tool_interaction",
      "name": "workflow_automation",
      "attributes": {}
    }
  }
}
```