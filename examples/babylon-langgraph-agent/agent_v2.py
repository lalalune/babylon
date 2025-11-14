"""
Babylon Autonomous Agent - Python + LangGraph + Official A2A SDK

Updated to use the official a2a-sdk Python package for better protocol compliance.
"""

import os
import json
import time
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Literal
from dotenv import load_dotenv

# LangChain & LangGraph
from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from pydantic import BaseModel

# Official A2A SDK
from a2a_sdk import A2AClient, A2ACredentials
from a2a_sdk.exceptions import A2AException

# Web3 for signing
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct

load_dotenv()

# ==================== Memory ====================

memory_saver = MemorySaver()
action_memory: List[Dict] = []

def add_to_memory(action: str, result: Any):
    """Add action to agent memory"""
    action_memory.append({
        'action': action,
        'result': result,
        'timestamp': datetime.now().isoformat()
    })
    # Keep last 20
    if len(action_memory) > 20:
        action_memory.pop(0)

def get_memory_summary() -> str:
    """Get formatted memory for LLM context"""
    if not action_memory:
        return "No recent actions."
    
    recent = action_memory[-5:]
    return "\n".join([
        f"[{a['timestamp']}] {a['action']}: {str(a['result'])[:80]}"
        for a in recent
    ])

# ==================== A2A Client (Official SDK) ====================

class BabylonA2AClient:
    """WebSocket client using official a2a-sdk"""
    
    def __init__(self, ws_url: str, address: str, token_id: int, private_key: str):
        self.ws_url = ws_url
        self.address = address
        self.token_id = token_id
        self.private_key = private_key
        self.client: A2AClient | None = None
        self.agent_id: str | None = None
        
    async def connect(self):
        """Connect and authenticate with Babylon A2A using official SDK"""
        # Create credentials
        timestamp = int(time.time() * 1000)
        message = f"A2A Authentication\n\nAgent: {self.address}\nToken: {self.token_id}\nTimestamp: {timestamp}"
        
        # Sign message with Web3
        w3 = Web3()
        encoded_message = encode_defunct(text=message)
        account = Account.from_key(self.private_key)
        signed_message = account.sign_message(encoded_message)
        signature = signed_message.signature.hex()
        
        # Create A2A credentials
        credentials = A2ACredentials(
            address=self.address,
            token_id=self.token_id,
            signature=signature,
            timestamp=timestamp
        )
        
        # Connect using official SDK
        self.client = A2AClient(
            endpoint=self.ws_url,
            credentials=credentials,
            capabilities={
                'strategies': ['autonomous-trading', 'social'],
                'markets': ['prediction', 'perp'],
                'actions': ['trade', 'social', 'chat'],
                'version': '1.0.0'
            }
        )
        
        await self.client.connect()
        
        # Get agent ID from handshake response
        handshake_response = await self.client.handshake()
        self.agent_id = handshake_response.get('agentId')
        
        print(f"✅ Connected with agent ID: {self.agent_id}")
        
    async def call(self, method: str, params: Dict = None) -> Dict:
        """Make JSON-RPC call using official SDK"""
        if not self.client:
            raise A2AException("Not connected")
        
        return await self.client.request(method, params or {})
    
    async def close(self):
        """Close connection"""
        if self.client:
            await self.client.close()

# Global A2A client
a2a_client: BabylonA2AClient | None = None

# ==================== LangGraph Tools ====================

@tool
async def get_markets() -> str:
    """Get available prediction markets and perpetual futures markets.
    
    Returns:
        JSON string with prediction markets and perp markets
    """
    try:
        predictions = await a2a_client.call('a2a.getPredictions', {'status': 'active'})
        perps = await a2a_client.call('a2a.getPerpetuals', {})
        
        return json.dumps({
            'predictions': predictions.get('predictions', [])[:5],
            'perps': perps.get('perpetuals', [])[:5]
        })
    except Exception as e:
        return json.dumps({'error': str(e)})

@tool
async def get_portfolio() -> str:
    """Get current portfolio including balance, positions, and P&L.
    
    Returns:
        JSON string with portfolio details
    """
    try:
        balance = await a2a_client.call('a2a.getBalance')
        positions = await a2a_client.call('a2a.getPositions', {'userId': a2a_client.agent_id})
        
        return json.dumps({
            'balance': balance.get('balance', 0),
            'positions': positions.get('perpPositions', []),
            'pnl': positions.get('totalPnL', 0)
        })
    except Exception as e:
        return json.dumps({'error': str(e)})

@tool
async def buy_shares(market_id: str, outcome: str, amount: float) -> str:
    """Buy YES or NO shares in a prediction market.
    
    Args:
        market_id: The ID of the prediction market
        outcome: Either "YES" or "NO"
        amount: Amount in USD to invest
        
    Returns:
        JSON string with trade result
    """
    try:
        result = await a2a_client.call('a2a.buyShares', {
            'marketId': market_id,
            'outcome': outcome.upper(),
            'amount': amount
        })
        
        add_to_memory(f"BUY_{outcome.upper()}", result)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({'error': str(e)})

@tool
async def sell_shares(market_id: str, shares: float) -> str:
    """Sell shares from a prediction market position.
    
    Args:
        market_id: The ID of the market
        shares: Number of shares to sell
        
    Returns:
        JSON string with sale result
    """
    try:
        result = await a2a_client.call('a2a.sellShares', {
            'marketId': market_id,
            'shares': shares
        })
        
        add_to_memory("SELL_SHARES", result)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({'error': str(e)})

@tool
async def open_position(ticker: str, side: str, size: float, leverage: int = 2) -> str:
    """Open a perpetual futures position.
    
    Args:
        ticker: The ticker symbol (e.g., "BTC")
        side: Either "long" or "short"
        size: Position size in USD
        leverage: Leverage multiplier (default: 2)
        
    Returns:
        JSON string with position details
    """
    try:
        result = await a2a_client.call('a2a.openPosition', {
            'ticker': ticker,
            'side': side.lower(),
            'size': size,
            'leverage': leverage
        })
        
        add_to_memory(f"OPEN_{side.upper()}", result)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({'error': str(e)})

@tool
async def close_position(position_id: str) -> str:
    """Close an open perpetual futures position.
    
    Args:
        position_id: The ID of the position to close
        
    Returns:
        JSON string with closure result
    """
    try:
        result = await a2a_client.call('a2a.closePosition', {
            'positionId': position_id
        })
        
        add_to_memory("CLOSE_POSITION", result)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({'error': str(e)})

@tool
async def create_post(content: str) -> str:
    """Create a post in the Babylon feed.
    
    Args:
        content: The text content of the post (max 280 chars)
        
    Returns:
        JSON string with post ID
    """
    try:
        result = await a2a_client.call('a2a.createPost', {
            'content': content[:280],
            'type': 'post'
        })
        
        add_to_memory("CREATE_POST", result)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({'error': str(e)})

@tool
async def create_comment(post_id: str, content: str) -> str:
    """Comment on a post.
    
    Args:
        post_id: The ID of the post to comment on
        content: The comment text (max 200 chars)
        
    Returns:
        JSON string with comment ID
    """
    try:
        result = await a2a_client.call('a2a.createComment', {
            'postId': post_id,
            'content': content[:200]
        })
        
        add_to_memory("CREATE_COMMENT", result)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({'error': str(e)})

@tool
async def get_feed(limit: int = 20) -> str:
    """Get recent posts from the Babylon feed.
    
    Args:
        limit: Number of posts to retrieve (default: 20)
        
    Returns:
        JSON string with feed posts
    """
    try:
        result = await a2a_client.call('a2a.getFeed', {
            'limit': limit,
            'offset': 0
        })
        
        return json.dumps(result.get('posts', []))
    except Exception as e:
        return json.dumps({'error': str(e)})

# ==================== Babylon Agent ====================

class BabylonAgent:
    """Autonomous Babylon trading agent with LangGraph"""
    
    SYSTEM_INSTRUCTION = """You are an autonomous trading agent for Babylon prediction markets.

Your capabilities:
- Trade prediction markets (buy YES/NO shares)
- Trade perpetual futures (long/short positions)
- Post insights to the feed
- Comment on other posts
- Analyze markets and sentiment

Strategy: {strategy}

Decision Process:
1. Check your portfolio (balance, positions, P&L)
2. Review available markets
3. Analyze recent feed activity
4. Consider your recent actions (memory)
5. Decide what action to take
6. Use tools to execute

Guidelines:
- Only trade when you have strong conviction
- Keep posts under 280 characters
- Comments should add value
- Don't spam - be thoughtful
- Manage risk appropriately
- Learn from previous actions

Recent Memory:
{memory}

Your task: Analyze the current state and decide what action to take.
Use the available tools to gather information and execute actions.
"""

    def __init__(self, strategy: str = "balanced"):
        self.strategy = strategy
        self.model = ChatGroq(
            model="llama-3.1-8b-instant",
            api_key=os.getenv('GROQ_API_KEY'),
            temperature=0.7
        )
        
        self.tools = [
            get_markets,
            get_portfolio,
            buy_shares,
            sell_shares,
            open_position,
            close_position,
            create_post,
            create_comment,
            get_feed
        ]
        
        self.graph = create_react_agent(
            self.model,
            tools=self.tools,
            checkpointer=memory_saver,
            state_modifier=self.get_system_prompt()
        )
    
    def get_system_prompt(self) -> str:
        """Get system prompt with current memory"""
        return self.SYSTEM_INSTRUCTION.format(
            strategy=self.strategy,
            memory=get_memory_summary()
        )
    
    async def decide(self, session_id: str) -> Dict:
        """Make autonomous decision"""
        query = "Analyze the current state and decide what action to take. Use tools to gather information first."
        
        config = {"configurable": {"thread_id": session_id}}
        result = await self.graph.ainvoke({"messages": [("user", query)]}, config)
        
        # Extract last message
        last_message = result["messages"][-1]
        
        return {
            'decision': last_message.content if hasattr(last_message, 'content') else str(last_message),
            'state': result
        }

# ==================== Main Loop ====================

async def main():
    """Main autonomous loop"""
    global a2a_client
    
    print("🤖 Starting Babylon Autonomous Agent (Python + LangGraph + A2A SDK)...")
    print("")
    
    # Phase 1: Agent Identity
    print("📝 Phase 1: Agent Identity Setup")
    try:
        # For this example, use a simple identity (in production, use Agent0 SDK)
        identity_file = 'agent-identity.json'
        if os.path.exists(identity_file):
            print("📂 Loading existing identity...")
            with open(identity_file, 'r') as f:
                identity = json.load(f)
        else:
            print("🆕 Creating new agent identity...")
            
            # Get address from private key
            account = Account.from_key(os.getenv('AGENT0_PRIVATE_KEY'))
            
            # Generate token ID (in production, get from Agent0 registration)
            token_id = int(time.time()) % 100000
            
            identity = {
                'tokenId': token_id,
                'address': account.address,
                'agentId': f"11155111:{token_id}",  # Sepolia chain ID
                'name': os.getenv('AGENT_NAME', 'Python Babylon Agent')
            }
            
            # Save identity
            with open(identity_file, 'w') as f:
                json.dump(identity, f, indent=2)
            
            print(f"💾 Identity saved to {identity_file}")
        
        print(f"✅ Agent Identity Ready")
        print(f"   Token ID: {identity['tokenId']}")
        print(f"   Address: {identity['address']}")
        print(f"   Agent ID: {identity['agentId']}")
        print(f"   Name: {identity.get('name', 'Agent')}")
        print("")
        print("💡 Note: For production, integrate with Agent0 SDK for ERC-8004 registration")
        print("")
        
    except Exception as e:
        print(f"❌ Identity setup failed: {e}")
        return
    
    # Phase 2: Connect to Babylon A2A
    print("🔌 Phase 2: Babylon A2A Connection (Official SDK)")
    try:
        a2a_url = os.getenv('BABYLON_A2A_URL', 'ws://localhost:3000/a2a')
        a2a_client = BabylonA2AClient(
            ws_url=a2a_url,
            address=identity['address'],
            token_id=identity['tokenId'],
            private_key=os.getenv('AGENT0_PRIVATE_KEY')
        )
        
        await a2a_client.connect()
        print(f"✅ Connected to Babylon A2A: {a2a_url}")
        print(f"   Agent ID: {a2a_client.agent_id}")
        print("")
        
    except Exception as e:
        print(f"❌ A2A connection failed: {e}")
        print(f"   Make sure Babylon server is running at {a2a_url}")
        return
    
    # Phase 3: Initialize LangGraph Agent
    print("🧠 Phase 3: LangGraph Agent Initialization")
    try:
        strategy = os.getenv('AGENT_STRATEGY', 'balanced')
        babylon_agent = BabylonAgent(strategy=strategy)
        
        print(f"✅ LangGraph Agent Ready")
        print(f"   Model: llama-3.1-8b-instant (Groq)")
        print(f"   Tools: {len(babylon_agent.tools)} Babylon actions")
        print(f"   Strategy: {strategy}")
        print(f"   Memory: Enabled")
        print("")
        
    except Exception as e:
        print(f"❌ LangGraph init failed: {e}")
        return
    
    # Phase 4: Autonomous Loop
    print("🔄 Phase 4: Autonomous Loop Started")
    print(f"   Tick Interval: {os.getenv('TICK_INTERVAL', '30')}s")
    print("")
    
    tick_count = 0
    tick_interval = int(os.getenv('TICK_INTERVAL', '30'))
    
    try:
        while True:
            tick_count += 1
            print("━" * 50)
            print(f"🔄 TICK #{tick_count}")
            print("━" * 50)
            
            try:
                # Run LangGraph decision cycle
                result = await babylon_agent.decide(session_id=identity['agentId'])
                
                print(f"✅ Tick #{tick_count} complete")
                print(f"   Decision: {result['decision'][:100]}...")
                print("")
                
            except Exception as e:
                print(f"❌ Tick #{tick_count} error: {e}")
                print("")
            
            print(f"⏳ Sleeping {tick_interval}s until next tick...")
            print("")
            await asyncio.sleep(tick_interval)
            
    except KeyboardInterrupt:
        print("")
        print("🛑 Shutting down gracefully...")
        await a2a_client.close()
        print("✅ Disconnected")
        print("👋 Goodbye!")

# ==================== Entry Point ====================

if __name__ == "__main__":
    asyncio.run(main())

