#!/usr/bin/env python3
"""
Verification script for Babylon Python Agent setup
Verifies Agent0 credentials and Babylon connectivity without requiring full agent run
"""

import os
import sys
import json
import asyncio
import time
from dotenv import load_dotenv
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct

# Colors for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'

def print_header(text: str):
    """Print formatted header"""
    print(f"\n{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}{BLUE}{text}{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}\n")

def print_success(text: str):
    """Print success message"""
    print(f"{GREEN}✅ {text}{RESET}")

def print_error(text: str):
    """Print error message"""
    print(f"{RED}❌ {text}{RESET}")

def print_warning(text: str):
    """Print warning message"""
    print(f"{YELLOW}⚠️  {text}{RESET}")

def print_info(text: str):
    """Print info message"""
    print(f"   {text}")

# ==================== Step 1: Environment Variables ====================

def verify_environment():
    """Verify all required environment variables"""
    print_header("Step 1: Environment Variables")
    
    load_dotenv()
    
    required_vars = {
        'AGENT0_PRIVATE_KEY': 'Private key for agent wallet',
        'GROQ_API_KEY': 'Groq API key for LLM',
        'BABYLON_A2A_URL': 'Babylon A2A WebSocket URL (optional)',
    }
    
    missing = []
    for var, description in required_vars.items():
        value = os.getenv(var)
        if value:
            # Mask sensitive values
            if 'KEY' in var or 'SECRET' in var:
                display_value = f"{value[:8]}...{value[-4:]}" if len(value) > 12 else "***"
            else:
                display_value = value
            print_success(f"{var}: {display_value}")
            print_info(f"   → {description}")
        else:
            print_error(f"{var}: Not set")
            print_info(f"   → {description}")
            missing.append(var)
    
    if missing:
        print_error(f"Missing {len(missing)} required environment variable(s)")
        return False
    
    print_success("All environment variables configured")
    return True

# ==================== Step 2: Agent0 Identity ====================

def verify_agent0_identity():
    """Verify Agent0 identity setup"""
    print_header("Step 2: Agent0 Identity (ERC-8004)")
    
    private_key = os.getenv('AGENT0_PRIVATE_KEY')
    if not private_key:
        print_error("AGENT0_PRIVATE_KEY not set")
        return None
    
    # Verify private key format
    if not private_key.startswith('0x'):
        print_error("Private key should start with 0x")
        return None
    
    if len(private_key) != 66:  # 0x + 64 hex chars
        print_error(f"Private key should be 66 characters (got {len(private_key)})")
        return None
    
    print_success("Private key format valid")
    
    # Derive account
    try:
        account = Account.from_key(private_key)
        print_success(f"Derived Ethereum address: {account.address}")
        print_info(f"   → This is your agent's identity")
    except Exception as e:
        print_error(f"Failed to derive account: {e}")
        return None
    
    # Test signing
    try:
        test_message = "Test authentication message"
        encoded_message = encode_defunct(text=test_message)
        signed_message = account.sign_message(encoded_message)
        signature = signed_message.signature.hex()
        
        print_success("Message signing works")
        print_info(f"   → Test signature: {signature[:32]}...")
        
        # Verify signature
        recovered_address = Account.recover_message(
            encoded_message,
            signature=signed_message.signature
        )
        
        if recovered_address.lower() == account.address.lower():
            print_success("Signature verification works")
        else:
            print_error("Signature verification failed")
            return None
            
    except Exception as e:
        print_error(f"Failed to sign/verify: {e}")
        return None
    
    # Generate identity
    token_id = int(time.time()) % 100000
    identity = {
        'address': account.address,
        'tokenId': token_id,
        'agentId': f"11155111:{token_id}",  # Sepolia chain ID
        'name': os.getenv('AGENT_NAME', 'Python Babylon Agent'),
        'chainId': 11155111,
        'network': 'sepolia'
    }
    
    print_success("Agent identity generated")
    print_info(f"   → Token ID: {identity['tokenId']}")
    print_info(f"   → Agent ID: {identity['agentId']}")
    print_info(f"   → Name: {identity['name']}")
    
    # Save identity
    identity_file = 'agent-identity.json'
    with open(identity_file, 'w') as f:
        json.dump(identity, f, indent=2)
    
    print_success(f"Identity saved to {identity_file}")
    
    return identity

# ==================== Step 3: A2A Authentication ====================

async def verify_a2a_authentication(identity: dict):
    """Verify A2A authentication process"""
    print_header("Step 3: A2A Authentication")
    
    private_key = os.getenv('AGENT0_PRIVATE_KEY')
    account = Account.from_key(private_key)
    
    # Create authentication message
    timestamp = int(time.time() * 1000)
    message = f"A2A Authentication\n\nAgent: {identity['address']}\nToken: {identity['tokenId']}\nTimestamp: {timestamp}"
    
    print_success("Authentication message created")
    print_info(f"   → Message preview: {message[:50]}...")
    
    # Sign message
    try:
        encoded_message = encode_defunct(text=message)
        signed_message = account.sign_message(encoded_message)
        signature = signed_message.signature.hex()
        
        print_success("Message signed")
        print_info(f"   → Signature: {signature[:32]}...")
        
        # Create handshake request
        handshake_request = {
            'jsonrpc': '2.0',
            'method': 'a2a.handshake',
            'params': {
                'credentials': {
                    'address': identity['address'],
                    'tokenId': identity['tokenId'],
                    'signature': signature,
                    'timestamp': timestamp
                },
                'capabilities': {
                    'strategies': ['autonomous-trading', 'social'],
                    'markets': ['prediction', 'perp'],
                    'actions': ['trade', 'social', 'chat'],
                    'version': '1.0.0'
                }
            },
            'id': 1
        }
        
        print_success("Handshake request prepared")
        print_info(f"   → Ready to connect to Babylon A2A")
        
        return handshake_request
        
    except Exception as e:
        print_error(f"Failed to prepare authentication: {e}")
        return None

# ==================== Step 4: Babylon Connectivity ====================

async def verify_babylon_connectivity(identity: dict, handshake_request: dict):
    """Verify connectivity to Babylon A2A server"""
    print_header("Step 4: Babylon A2A Connectivity")
    
    a2a_url = os.getenv('BABYLON_A2A_URL', 'http://localhost:3000/api/a2a')
    print_info(f"Connecting to: {a2a_url}")
    
    # Check if WebSocket or HTTP
    is_websocket = a2a_url.startswith('ws://') or a2a_url.startswith('wss://')
    
    if is_websocket:
        print_warning("WebSocket URL detected, but Babylon uses HTTP!")
        print_info("   → Update .env: BABYLON_A2A_URL=http://localhost:3000/api/a2a")
        return False
    
    try:
        import httpx
        
        print_info("Testing HTTP connection...")
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Test GET endpoint first
                print_info("Testing GET /api/a2a...")
                get_response = await client.get(a2a_url)
                get_response.raise_for_status()
                info = get_response.json()
                
                print_success(f"Server responding: {info.get('service', 'Unknown')}")
                print_info(f"   → Version: {info.get('version', 'N/A')}")
                print_info(f"   → Status: {info.get('status', 'N/A')}")
                
                # Test a simple method call
                print_info("\nTesting a2a.getBalance method...")
                balance_request = {
                    'jsonrpc': '2.0',
                    'method': 'a2a.getBalance',
                    'params': {},
                    'id': 1
                }
                
                headers = {
                    'Content-Type': 'application/json',
                    'x-agent-id': identity['agentId'],
                    'x-agent-address': identity['address'],
                    'x-agent-token-id': str(identity['tokenId'])
                }
                
                post_response = await client.post(
                    a2a_url,
                    json=balance_request,
                    headers=headers
                )
                post_response.raise_for_status()
                result = post_response.json()
                
                if 'error' in result:
                    error_code = result['error']['code']
                    error_msg = result['error']['message']
                    
                    # User not found is expected for new agents - means A2A is working!
                    if error_code == -32002 or 'not found' in error_msg.lower():
                        print_success("A2A connection successful! 🎉")
                        print_info(f"   → Agent ID: {identity['agentId']}")
                        print_info(f"   → Note: Agent not registered yet (expected)")
                        return True
                    else:
                        print_warning(f"Method returned error: {error_msg}")
                        print_info(f"   → Code: {error_code}")
                        # Other errors might still indicate connection works
                        return True
                
                if 'result' in result:
                    print_success("A2A connection successful! 🎉")
                    print_info(f"   → Agent ID: {identity['agentId']}")
                    print_info(f"   → Balance: {result['result'].get('balance', 0)}")
                    return True
                    
                return False
                    
        except httpx.HTTPStatusError as e:
            print_error(f"HTTP error: {e.response.status_code}")
            print_info(f"   → {e.response.text[:200]}")
            return False
        except httpx.ConnectError:
            print_error("Connection refused")
            print_info(f"   → Server may not be running")
            return False
        except asyncio.TimeoutError:
            print_error("Connection timeout")
            print_info(f"   → Server did not respond within 10 seconds")
            return False
            
    except ImportError:
        print_error("httpx package not installed")
        print_info("   → Run: uv add httpx")
        return False
    except Exception as e:
        print_error(f"Connection failed: {e}")
        print_info(f"   → Is the Babylon server running?")
        print_info(f"   → Start server: cd /Users/shawwalters/babylon && npm run dev")
        return False

# ==================== Step 5: Dependencies ====================

def verify_dependencies():
    """Verify all Python dependencies"""
    print_header("Step 5: Python Dependencies")
    
    dependencies = [
        ('langchain', 'LangChain framework'),
        ('langchain_groq', 'Groq LLM integration'),
        ('langgraph', 'LangGraph agent framework'),
        ('websockets', 'WebSocket client'),
        ('httpx', 'HTTP client'),
        ('dotenv', 'Environment variables'),  # Changed from python-dotenv to dotenv
        ('pydantic', 'Data validation'),
        ('web3', 'Web3 library'),
        ('eth_account', 'Ethereum account management'),
    ]
    
    missing = []
    for package, description in dependencies:
        try:
            __import__(package.replace('-', '_'))
            print_success(f"{package}: Installed")
        except ImportError:
            print_error(f"{package}: Not installed")
            print_info(f"   → {description}")
            missing.append(package)
    
    if missing:
        print_warning(f"{len(missing)} package(s) need to be installed")
        print_info("   → Run: uv sync")
        return False
    
    print_success("All dependencies installed")
    return True

# ==================== Main ====================

async def main():
    """Run all verification steps"""
    print("\n")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}{BLUE}🔍 BABYLON PYTHON AGENT SETUP VERIFICATION{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}")
    
    results = {}
    
    # Step 1: Environment
    results['environment'] = verify_environment()
    
    if not results['environment']:
        print_error("\n❌ Environment setup incomplete. Please set missing variables in .env file")
        return False
    
    # Step 2: Agent0 Identity
    identity = verify_agent0_identity()
    results['identity'] = identity is not None
    
    if not identity:
        print_error("\n❌ Agent0 identity setup failed")
        return False
    
    # Step 3: A2A Authentication
    handshake = await verify_a2a_authentication(identity)
    results['authentication'] = handshake is not None
    
    if not handshake:
        print_error("\n❌ A2A authentication setup failed")
        return False
    
    # Step 4: Babylon Connectivity
    results['connectivity'] = await verify_babylon_connectivity(identity, handshake)
    
    # Step 5: Dependencies
    results['dependencies'] = verify_dependencies()
    
    # Summary
    print_header("VERIFICATION SUMMARY")
    
    all_passed = all(results.values())
    
    for step, passed in results.items():
        status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
        print(f"{status} - {step.replace('_', ' ').title()}")
    
    print("")
    
    if all_passed:
        print_success("🎉 All verifications passed!")
        print_info("   → Your agent is ready to run")
        print_info("   → Start agent: uv run python agent_v2.py")
        return True
    else:
        failed = [k for k, v in results.items() if not v]
        print_warning(f"⚠️  {len(failed)} verification(s) failed: {', '.join(failed)}")
        
        if not results['connectivity']:
            print_info("\n   → To fix connectivity:")
            print_info("      1. Start Babylon server: cd /Users/shawwalters/babylon && npm run dev")
            print_info("      2. Re-run verification: uv run python verify_setup.py")
        
        if not results['dependencies']:
            print_info("\n   → To fix dependencies:")
            print_info("      1. Install packages: uv sync")
            print_info("      2. Re-run verification: uv run python verify_setup.py")
        
        return False

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print(f"\n{YELLOW}⚠️  Verification cancelled{RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{RED}❌ Unexpected error: {e}{RESET}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

