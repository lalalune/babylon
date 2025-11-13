#!/bin/bash

# Upgrade Diamond Script
# Adds new facets to existing Diamond deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Diamond Upgrade Script ===${NC}\n"

# Load .env file if it exists
if [ -f .env ]; then
    echo -e "${YELLOW}Loading environment from .env file...${NC}"
    export $(grep -v '^#' .env | grep -E "DEPLOYER_PRIVATE_KEY|DIAMOND_ADDRESS|NEXT_PUBLIC_DIAMOND_ADDRESS|BASE.*RPC|ETHEREUM.*RPC" | xargs)
fi

# Check for required environment variables
if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
    echo -e "${RED}Error: DEPLOYER_PRIVATE_KEY not set${NC}"
    echo "Please set your deployer private key:"
    echo "  export DEPLOYER_PRIVATE_KEY=0x..."
    exit 1
fi

# Use NEXT_PUBLIC_DIAMOND_ADDRESS if DIAMOND_ADDRESS is not set
if [ -z "$DIAMOND_ADDRESS" ] && [ -n "$NEXT_PUBLIC_DIAMOND_ADDRESS" ]; then
    export DIAMOND_ADDRESS=$NEXT_PUBLIC_DIAMOND_ADDRESS
fi

if [ -z "$DIAMOND_ADDRESS" ]; then
    echo -e "${RED}Error: DIAMOND_ADDRESS not set${NC}"
    echo "Please set your Diamond proxy address in .env:"
    echo "  DIAMOND_ADDRESS=0x..."
    echo "  or NEXT_PUBLIC_DIAMOND_ADDRESS=0x..."
    exit 1
fi

# Get network (default to sepolia)
NETWORK=${1:-sepolia}

echo -e "${YELLOW}Network:${NC} $NETWORK"
echo -e "${YELLOW}Diamond Address:${NC} $DIAMOND_ADDRESS"
echo ""

# Determine RPC URL
case $NETWORK in
    sepolia)
        RPC_URL=${AGENT0_RPC_URL:-${SEPOLIA_RPC_URL:-"https://eth-sepolia.g.alchemy.com/v2/your-key"}}
        CHAIN_ID=11155111
        ;;
    mainnet)
        RPC_URL=${ETHEREUM_MAINNET_RPC_URL:-"https://eth-mainnet.g.alchemy.com/v2/your-key"}
        CHAIN_ID=1
        ;;
    base-sepolia)
        RPC_URL=${BASE_SEPOLIA_RPC_URL:-"https://sepolia.base.org"}
        CHAIN_ID=84532
        ;;
    base)
        RPC_URL=${BASE_RPC_URL:-"https://mainnet.base.org"}
        CHAIN_ID=8453
        ;;
    *)
        echo -e "${RED}Unknown network: $NETWORK${NC}"
        echo "Supported networks: sepolia, mainnet, base-sepolia, base"
        exit 1
        ;;
esac

echo -e "${YELLOW}RPC URL:${NC} $RPC_URL"
echo -e "${YELLOW}Chain ID:${NC} $CHAIN_ID"
echo ""

# Confirm before proceeding
echo -e "${YELLOW}This will:${NC}"
echo "  1. Deploy 3 new facets (LiquidityPool, PerpetualMarket, ReferralSystem)"
echo "  2. Add them to the existing Diamond via diamondCut"
echo "  3. Verify the upgrade was successful"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Upgrade cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}Starting upgrade...${NC}\n"

# Run the upgrade script
forge script scripts/UpgradeDiamond.s.sol:UpgradeDiamond \
    --rpc-url $RPC_URL \
    --broadcast \
    --verify \
    -vvv

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=== Upgrade Successful! ===${NC}"
    echo ""
    echo "Your Diamond now includes:"
    echo "  ✅ Liquidity pools (constant product AMM)"
    echo "  ✅ Perpetual futures (with funding rates)"
    echo "  ✅ Referral system (multi-tier commissions)"
    echo ""
    echo "Next steps:"
    echo "  1. Test the new functions on $NETWORK"
    echo "  2. Update your frontend to use the new features"
    echo "  3. Monitor gas costs and adjust parameters if needed"
else
    echo ""
    echo -e "${RED}Upgrade failed!${NC}"
    echo "Check the error messages above for details."
    exit 1
fi
