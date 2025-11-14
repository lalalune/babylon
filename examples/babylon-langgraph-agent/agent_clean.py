"""
Babylon Autonomous Agent - CLEANED VERSION
Fixed: Removed defensive programming, added validation, proper error handling
"""

import os
import json
import time
import asyncio
import argparse
from datetime import datetime
from typing import Any, Dict, Optional
from dotenv import load_dotenv

# LangChain & LangGraph
from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

# HTTP & Web3
import httpx
from eth_account import Account
from eth_account.messages import encode_defunct

load_dotenv()

# ==================== Custom Exceptions ====================

class A2AError(Exception):
    """A2A protocol error"""
    def __init__(self, code: int, message: str, data: Any = None):
        self.code = code
        self.message = message
        self.data = data
        super().__init__(f"A2A Error [{code}]: {message}")

class ValidationError(Exception):
    """Input validation error"""
    pass

# ==================== HTTP A2A Client ====================

class BabylonA2AClient:
    """HTTP client for Babylon A2A protocol - NO defensive programming"""
    
    def __init__(self, http_url: str, address: str, token_id: int, chain_id: int = 11155111):
        self.http_url = http_url
        self.address = address
        self.token_id = token_id
        self.chain_id = chain_id
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))
        self.message_id = 1
        self.agent_id = f"{chain_id}:{token_id}"
        
    async def call(self, method: str, params: Optional[Dict] = None) -> Dict:
        """Make JSON-RPC call - raises exceptions on error"""
        request_id = self.message_id
        self.message_id += 1
        
        message = {
            'jsonrpc': '2.0',
            'method': method,
            'params': params or {},
            'id': request_id
        }
        
        headers = {
            'Content-Type': 'application/json',
            'x-agent-id': self.agent_id,
            'x-agent-address': self.address,
            'x-agent-token-id': str(self.token_id)
        }
        
        # Let HTTP errors propagate - no try-catch
        response = await self.client.post(self.http_url, json=message, headers=headers)
        response.raise_for_status()  # Raises HTTPStatusError on 4xx/5xx
        
        result = response.json()
        
        # Raise A2AError if RPC error
        if 'error' in result:
            error = result['error']
            raise A2AError(
                code=error.get('code', -1),
                message=error.get('message', 'Unknown error'),
                data=error.get('data')
            )
            
        return result['result']
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

# ==================== Validation ====================

def validate_outcome(outcome: str) -> str:
    """Validate and normalize outcome"""
    outcome = outcome.upper()
    if outcome not in ['YES', 'NO']:
        raise ValidationError(f"outcome must be YES or NO, got: {outcome}")
    return outcome

def validate_amount(amount: float) -> float:
    """Validate trade amount"""
    if amount <= 0:
        raise ValidationError(f"amount must be > 0, got: {amount}")
    if amount > 1000000:
        raise ValidationError(f"amount too large: {amount}")
    return amount

def validate_market_id(market_id: str) -> str:
    """Validate market ID format"""
    if not market_id or not isinstance(market_id, str):
        raise ValidationError(f"invalid market_id: {market_id}")
    return market_id

def validate_content(content: str, max_length: int = 280) -> str:
    """Validate and truncate content"""
    if not content or not isinstance(content, str):
        raise ValidationError("content must be non-empty string")
    return content[:max_length]

# ==================== Tools - NO TRY-CATCH ====================
# Global client - needed for tools to access it
# (LangGraph tools don't support dependency injection)
_client: Optional[BabylonA2AClient] = None

def set_client(client: BabylonA2AClient):
    """Set global client for tools"""
    global _client
    _client = client

@tool
async def get_markets() -> str:
    """Get available prediction markets. Raises exceptions on error."""
    result = await _client.call('a2a.getMarketData', {})
    return json.dumps(result)

@tool
async def get_portfolio() -> str:
    """Get portfolio including balance and positions. Raises exceptions on error."""
    balance = await _client.call('a2a.getBalance', {})
    positions = await _client.call('a2a.getPositions', {'userId': _client.agent_id})
    
    return json.dumps({
        'balance': balance.get('balance', 0),
        'positions': positions
    })

@tool
async def buy_shares(market_id: str, outcome: str, amount: float) -> str:
    """
    Buy YES or NO shares in a prediction market.
    
    Args:
        market_id: Market ID
        outcome: 'YES' or 'NO'
        amount: Amount to invest (must be > 0)
    
    Raises:
        ValidationError: Invalid input
        A2AError: API error
        httpx.HTTPStatusError: Network error
    """
    # Validate inputs - raises ValidationError on invalid
    market_id = validate_market_id(market_id)
    outcome = validate_outcome(outcome)
    amount = validate_amount(amount)
    
    # No try-catch - let errors propagate
    result = await _client.call('a2a.buyShares', {
        'marketId': market_id,
        'outcome': outcome,
        'amount': amount
    })
    
    return json.dumps(result)

@tool
async def create_post(content: str) -> str:
    """
    Create a post in Babylon feed.
    
    Args:
        content: Post content (max 280 chars)
    
    Raises:
        ValidationError: Invalid content
        A2AError: API error
    """
    content = validate_content(content, max_length=280)
    
    result = await _client.call('a2a.createPost', {
        'content': content,
        'type': 'post'
    })
    
    return json.dumps(result)

@tool
async def get_feed(limit: int = 20) -> str:
    """Get recent posts from Babylon feed."""
    if limit <= 0 or limit > 100:
        raise ValidationError(f"limit must be 1-100, got: {limit}")
    
    result = await _client.call('a2a.getFeed', {
        'limit': limit,
        'offset': 0
    })
    
    return json.dumps(result.get('posts', []))

# ==================== Agent ====================

class BabylonAgent:
    """Autonomous Babylon trading agent"""
    
    SYSTEM_INSTRUCTION = """You are an autonomous trading agent for Babylon prediction markets.

Your capabilities:
- Trade prediction markets (buy YES/NO shares)
- Post insights to the feed
- Analyze markets

Strategy: {strategy}

Guidelines:
- Only trade with strong conviction
- Keep posts under 280 characters
- Be thoughtful

Your task: Analyze state and decide actions using the available tools.
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
            create_post,
            get_feed
        ]
        
        self.graph = create_react_agent(
            self.model,
            tools=self.tools,
            checkpointer=MemorySaver()
        )
    
    def get_system_prompt(self) -> str:
        """Get system prompt"""
        return self.SYSTEM_INSTRUCTION.format(strategy=self.strategy)
    
    async def decide(self, session_id: str) -> Dict:
        """Make autonomous decision"""
        prompt = f"{self.get_system_prompt()}\n\nAnalyze and decide what action to take."
        
        config = {"configurable": {"thread_id": session_id}}
        result = await self.graph.ainvoke({"messages": [("user", prompt)]}, config)
        
        last_message = result["messages"][-1]
        
        return {
            'decision': last_message.content if hasattr(last_message, 'content') else str(last_message),
            'state': result
        }

# ==================== Logging ====================

class AgentLogger:
    """Simple logger"""
    
    def __init__(self, log_file: Optional[str] = None):
        self.log_file = log_file
        self.logs = []
        
    def log(self, level: str, message: str, data: Any = None):
        """Log message"""
        timestamp = datetime.now().isoformat()
        log_entry = {
            'timestamp': timestamp,
            'level': level,
            'message': message,
            'data': data
        }
        self.logs.append(log_entry)
        
        prefix = {'INFO': '📝', 'SUCCESS': '✅', 'ERROR': '❌', 'WARNING': '⚠️'}.get(level, '•')
        print(f"{prefix} [{timestamp}] {message}")
        
        if self.log_file:
            with open(self.log_file, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
    
    def info(self, msg: str, data: Any = None): self.log('INFO', msg, data)
    def success(self, msg: str, data: Any = None): self.log('SUCCESS', msg, data)
    def error(self, msg: str, data: Any = None): self.log('ERROR', msg, data)
    def warning(self, msg: str, data: Any = None): self.log('WARNING', msg, data)
    
    def save_summary(self, filename: str):
        """Save summary"""
        with open(filename, 'w') as f:
            json.dump({
                'total_logs': len(self.logs),
                'by_level': {
                    level: len([l for l in self.logs if l['level'] == level])
                    for level in ['INFO', 'SUCCESS', 'ERROR', 'WARNING']
                },
                'logs': self.logs
            }, f, indent=2)

# ==================== Main ====================

async def main(max_ticks: Optional[int] = None, log_file: Optional[str] = None):
    """Main loop"""
    logger = AgentLogger(log_file=log_file)
    client: Optional[BabylonA2AClient] = None
    
    try:
        logger.info("Starting Babylon Agent (CLEANED VERSION - No defensive programming)")
        if max_ticks:
            logger.info(f"TEST MODE: {max_ticks} ticks")
        
        # Phase 1: Identity
        print("━" * 60)
        print("📝 Phase 1: Agent Identity")
        print("━" * 60)
        
        account = Account.from_key(os.getenv('AGENT0_PRIVATE_KEY'))
        token_id = int(time.time()) % 100000
        
        identity = {
            'tokenId': token_id,
            'address': account.address,
            'agentId': f"11155111:{token_id}",
            'name': os.getenv('AGENT_NAME', 'Python Agent')
        }
        
        logger.success("Identity Ready", identity)
        print("")
        
        # Phase 2: Connect
        print("━" * 60)
        print("🔌 Phase 2: Connect to Babylon")
        print("━" * 60)
        
        a2a_url = os.getenv('BABYLON_A2A_URL', 'http://localhost:3000/api/a2a')
        client = BabylonA2AClient(
            http_url=a2a_url,
            address=identity['address'],
            token_id=identity['tokenId']
        )
        
        set_client(client)  # Set global for tools
        
        logger.success("Connected", {'url': a2a_url, 'agent_id': client.agent_id})
        print("")
        
        # Phase 3: LangGraph
        print("━" * 60)
        print("🧠 Phase 3: LangGraph Agent")
        print("━" * 60)
        
        strategy = os.getenv('AGENT_STRATEGY', 'balanced')
        agent = BabylonAgent(strategy=strategy)
        
        logger.success("Agent Ready", {'strategy': strategy, 'tools': len(agent.tools)})
        print("")
        
        # Phase 4: Loop
        print("━" * 60)
        print("🔄 Phase 4: Autonomous Loop")
        print("━" * 60)
        
        tick_interval = int(os.getenv('TICK_INTERVAL', '30'))
        tick_count = 0
        tick_start_time = time.time()
        
        while True:
            tick_count += 1
            
            if max_ticks and tick_count > max_ticks:
                logger.success(f"Completed {max_ticks} ticks")
                break
            
            print(f"\n━━━ TICK #{tick_count}" + (f" / {max_ticks}" if max_ticks else "") + " ━━━")
            
            tick_start = time.time()
            logger.info(f"Starting tick #{tick_count}")
            
            try:
                result = await agent.decide(session_id=identity['agentId'])
                tick_duration = time.time() - tick_start
                
                logger.success(f"Tick #{tick_count} complete", {
                    'duration_seconds': round(tick_duration, 2),
                    'decision_preview': result['decision'][:100]
                })
                
            except Exception as e:
                # Log error but let it propagate
                logger.error(f"Tick #{tick_count} error: {type(e).__name__}: {e}")
                raise  # Re-raise to see stack trace
            
            # Sleep
            if not max_ticks or tick_count < max_ticks:
                logger.info(f"Sleeping {tick_interval}s...")
                await asyncio.sleep(tick_interval)
        
        # Summary
        if max_ticks:
            total_duration = time.time() - tick_start_time
            print("\n" + "=" * 60)
            print("🎉 TEST COMPLETE")
            print("=" * 60)
            logger.success("Test complete", {
                'total_ticks': tick_count,
                'total_duration_seconds': round(total_duration, 2)
            })
            
            if log_file:
                summary_file = log_file.replace('.jsonl', '_summary.json')
                logger.save_summary(summary_file)
                logger.info(f"Logs: {log_file}, Summary: {summary_file}")
    
    except KeyboardInterrupt:
        logger.warning("Interrupted by user")
    
    finally:
        if client:
            await client.close()
            logger.info("Client closed")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Babylon Agent - CLEANED')
    parser.add_argument('--test', action='store_true', help='Run for 10 ticks')
    parser.add_argument('--ticks', type=int, help='Run for N ticks')
    parser.add_argument('--log', type=str, help='Log file (JSONL)')
    
    args = parser.parse_args()
    
    max_ticks = 10 if args.test else args.ticks
    
    asyncio.run(main(max_ticks=max_ticks, log_file=args.log))

