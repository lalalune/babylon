#!/usr/bin/env bun

/**
 * Quick helper script to simulate `registerAgent` on the IdentityRegistry contract.
 *
 * Usage:
 *   bun scripts/debug-register-agent.ts --address 0x... --username foo
 *
 * Optional flags:
 *   --display-name "My Agent"
 *   --endpoint https://example.com/agent/<address>
 *
 * The script calls viem's `simulateContract` so we can see the exact revert reason
 * that Privy's paymaster would encounter.
 */
import { createPublicClient, http, parseAbi } from 'viem';
import type { Address } from 'viem';
import { baseSepolia } from 'viem/chains';

import { IDENTITY_REGISTRY_ABI } from '@/lib/web3/abis';

const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_BASE_SEPOLIA;

type CliArgs = {
  address: string;
  username: string;
  displayName?: string;
  endpoint?: string;
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '');
      const value = args[i + 1];
      parsed[key] = value;
      i++;
    }
  }

  if (!parsed.address) {
    throw new Error('Missing --address (wallet address to simulate from)');
  }
  if (!parsed.username) {
    throw new Error('Missing --username (handle to register)');
  }

  return {
    address: parsed.address,
    username: parsed.username,
    displayName: parsed['display-name'] ?? parsed.displayName,
    endpoint: parsed.endpoint,
  };
}

async function main() {
  if (!REGISTRY_ADDRESS) {
    throw new Error(
      'NEXT_PUBLIC_IDENTITY_REGISTRY_BASE_SEPOLIA env is not set'
    );
  }

  const args = parseArgs();
  const lowerAddress = args.address as Address;

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(
      process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
    ),
  });
  const identityRegistryAbi = parseAbi(IDENTITY_REGISTRY_ABI);

  const endpoint =
    args.endpoint ?? `https://babylon.game/agent/${lowerAddress.toLowerCase()}`;

  const metadata = JSON.stringify({
    name: args.displayName ?? args.username,
    bio: '',
    type: 'user',
    registered: new Date().toISOString(),
  });
  const capabilitiesHash =
    '0x0000000000000000000000000000000000000000000000000000000000000001' as const;

  console.log('Simulating registerAgent with args:');
  console.log({
    from: lowerAddress,
    username: args.username,
    endpoint,
    metadata,
  });

  try {
    const simulation = await client.simulateContract({
      address: REGISTRY_ADDRESS as Address,
      abi: identityRegistryAbi,
      account: lowerAddress,
      functionName: 'registerAgent',
      args: [args.username, endpoint, capabilitiesHash, metadata],
    });

    console.log('Simulation succeeded. Request data:');
    console.log(simulation.request);
  } catch (error) {
    console.error('Simulation failed.');
    console.error(error);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
