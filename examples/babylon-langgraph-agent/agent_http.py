"""
Babylon Autonomous Agent - Python + LangGraph + HTTP A2A

Uses HTTP POST for A2A protocol (Babylon's implementation)
"""

import os
import json
import time
import asyncio
import httpx
import sys
import argparse
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from dotenv import load_dotenv

# LangChain & LangGraph
from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from pydantic import BaseModel

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

# ==================== HTTP A2A Client ====================

class BabylonA2AClient:
    """HTTP client for Babylon A2A protocol"""
    
    def __init__(self, http_url: str, address: str, token_id: int, private_key: str):
        self.http_url = http_url
        self.address = address
        self.token_id = token_id
        self.private_key = private_key
        self.client = httpx.AsyncClient(timeout=30.0)
        self.message_id = 1
        self.agent_id = f"11155111:{token_id}"
        
    async def call(self, method: str, params: Dict = None) -> Dict:
        """Make JSON-RPC call over HTTP"""
        request_id = self.message_id
        self.message_id += 1
        
        message = {
            'jsonrpc': '2.0',
            'method': method,
            'params': params or {},
            'id': request_id
        }
        
        # Add agent headers
        headers = {
            'Content-Type': 'application/json',
            'x-agent-id': self.agent_id,
            'x-agent-address': self.address,
            'x-agent-token-id': str(self.token_id)
        }
        
        response = await self.client.post(
            self.http_url,
            json=message,
            headers=headers
        )
        
        response.raise_for_status()
        result = response.json()
        
        if 'error' in result:
            raise Exception(f"A2A Error: {result['error']['message']}")
            
        return result['result']
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

# Global A2A client
a2a_client: BabylonA2AClient | None = None

# ==================== LangGraph Tools ====================

@tool
async def get_markets() -> str:
    """Get available prediction markets."""
    try:
        result = await a2a_client.call('a2a.getMarketData', {})
        return json.dumps(result)
    except Exception as e:
        return json.dumps({'error': str(e)})

@tool
async def get_portfolio() -> str:
    """Get current portfolio including balance and positions."""
    try:
        balance = await a2a_client.call('a2a.getBalance', {})
        positions = await a2a_client.call('a2a.getPositions', {'userId': a2a_client.agent_id})
        
        return json.dumps({
            'balance': balance.get('balance', 0),
            'positions': positions
        })
    except Exception as e:
        return json.dumps({'error': str(e)})

@tool
async def buy_shares(market_id: str, outcome: str, amount: float) -> str:
    """Buy YES or NO shares in a prediction market."""
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
async def create_post(content: str) -> str:
    """Create a post in the Babylon feed."""
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
async def get_feed(limit: int = 20) -> str:
    """Get recent posts from the Babylon feed."""
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
- Post insights to the feed
- Analyze markets and sentiment

Strategy: {strategy}

Guidelines:
- Only trade when you have strong conviction
- Keep posts under 280 characters
- Be thoughtful and add value

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
            create_post,
            get_feed
        ]
        
        self.graph = create_react_agent(
            self.model,
            tools=self.tools,
            checkpointer=memory_saver
        )
    
    def get_system_prompt(self) -> str:
        """Get system prompt with current memory"""
        return self.SYSTEM_INSTRUCTION.format(
            strategy=self.strategy,
            memory=get_memory_summary()
        )
    
    async def decide(self, session_id: str) -> Dict:
        """Make autonomous decision"""
        # Include system prompt in the user query
        prompt = f"{self.get_system_prompt()}\n\nAnalyze the current state and decide what action to take."
        
        config = {"configurable": {"thread_id": session_id}}
        result = await self.graph.ainvoke({"messages": [("user", prompt)]}, config)
        
        last_message = result["messages"][-1]
        
        return {
            'decision': last_message.content if hasattr(last_message, 'content') else str(last_message),
            'state': result
        }

# ==================== Logging ====================

class AgentLogger:
    """Comprehensive logger for agent activity"""
    
    def __init__(self, log_file: Optional[str] = None):
        self.log_file = log_file
        self.logs = []
        
    def log(self, level: str, message: str, data: Dict = None):
        """Log a message with optional data"""
        timestamp = datetime.now().isoformat()
        log_entry = {
            'timestamp': timestamp,
            'level': level,
            'message': message,
            'data': data
        }
        self.logs.append(log_entry)
        
        # Print to console
        prefix = {
            'INFO': '📝',
            'SUCCESS': '✅',
            'ERROR': '❌',
            'WARNING': '⚠️',
            'DEBUG': '🔍'
        }.get(level, '•')
        
        print(f"{prefix} [{timestamp}] {message}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)[:200]}...")
        
        # Write to file if specified
        if self.log_file:
            with open(self.log_file, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
    
    def info(self, message: str, data: Dict = None):
        self.log('INFO', message, data)
    
    def success(self, message: str, data: Dict = None):
        self.log('SUCCESS', message, data)
    
    def error(self, message: str, data: Dict = None):
        self.log('ERROR', message, data)
    
    def warning(self, message: str, data: Dict = None):
        self.log('WARNING', message, data)
    
    def debug(self, message: str, data: Dict = None):
        self.log('DEBUG', message, data)
    
    def save_summary(self, filename: str):
        """Save log summary to file"""
        with open(filename, 'w') as f:
            json.dump({
                'total_logs': len(self.logs),
                'by_level': {
                    level: len([l for l in self.logs if l['level'] == level])
                    for level in ['INFO', 'SUCCESS', 'ERROR', 'WARNING', 'DEBUG']
                },
                'logs': self.logs
            }, f, indent=2)

# Global logger
logger: AgentLogger = None

# ==================== Main Loop ====================

async def main(max_ticks: Optional[int] = None, log_file: Optional[str] = None):
    """Main autonomous loop
    
    Args:
        max_ticks: Maximum number of ticks to run (None = infinite)
        log_file: Path to log file (None = no file logging)
    """
    global a2a_client, logger
    
    # Initialize logger
    logger = AgentLogger(log_file=log_file)
    
    logger.info("🤖 Starting Babylon Autonomous Agent (Python + LangGraph + HTTP A2A)")
    if max_ticks:
        logger.info(f"🧪 TEST MODE: Running for {max_ticks} ticks")
    if log_file:
        logger.info(f"📋 Logging to file: {log_file}")
    print("")
    
    # Phase 1: Agent Identity
    print("━" * 60)
    print("📝 Phase 1: Agent Identity Setup")
    print("━" * 60)
    try:
        logger.info("Loading private key from environment")
        account = Account.from_key(os.getenv('AGENT0_PRIVATE_KEY'))
        token_id = int(time.time()) % 100000
        
        identity = {
            'tokenId': token_id,
            'address': account.address,
            'agentId': f"11155111:{token_id}",
            'name': os.getenv('AGENT_NAME', 'Python Babylon Agent')
        }
        
        logger.success("Agent Identity Ready", identity)
        print(f"   Token ID: {identity['tokenId']}")
        print(f"   Address: {identity['address']}")
        print(f"   Agent ID: {identity['agentId']}")
        print("")
        
    except Exception as e:
        logger.error(f"Identity setup failed: {e}")
        return
    
    # Phase 2: Connect to Babylon A2A (HTTP)
    print("━" * 60)
    print("🔌 Phase 2: Babylon A2A Connection (HTTP)")
    print("━" * 60)
    try:
        a2a_url = os.getenv('BABYLON_A2A_URL', 'http://localhost:3000/api/a2a')
        logger.info(f"Connecting to A2A endpoint: {a2a_url}")
        
        a2a_client = BabylonA2AClient(
            http_url=a2a_url,
            address=identity['address'],
            token_id=identity['tokenId'],
            private_key=os.getenv('AGENT0_PRIVATE_KEY')
        )
        
        logger.success("Connected to Babylon A2A", {
            'url': a2a_url,
            'agent_id': a2a_client.agent_id
        })
        print(f"   Agent ID: {a2a_client.agent_id}")
        print(f"   Ready to interact with Babylon!")
        print("")
        
    except Exception as e:
        logger.error(f"A2A connection failed: {e}")
        return
    
    # Phase 3: Initialize LangGraph Agent
    print("━" * 60)
    print("🧠 Phase 3: LangGraph Agent Initialization")
    print("━" * 60)
    try:
        strategy = os.getenv('AGENT_STRATEGY', 'balanced')
        logger.info(f"Initializing LangGraph agent with strategy: {strategy}")
        
        babylon_agent = BabylonAgent(strategy=strategy)
        
        logger.success("LangGraph Agent Ready", {
            'strategy': strategy,
            'model': 'llama-3.1-8b-instant',
            'tools': len(babylon_agent.tools)
        })
        print(f"   Model: llama-3.1-8b-instant (Groq)")
        print(f"   Tools: {len(babylon_agent.tools)} Babylon actions")
        print("")
        
    except Exception as e:
        logger.error(f"LangGraph init failed: {e}")
        return
    
    # Phase 4: Autonomous Loop
    print("━" * 60)
    print("🔄 Phase 4: Autonomous Loop Started")
    print("━" * 60)
    tick_interval = int(os.getenv('TICK_INTERVAL', '30'))
    tick_count = 0
    
    if max_ticks:
        logger.info(f"Will run for {max_ticks} ticks, then exit")
    else:
        logger.info("Will run indefinitely (Ctrl+C to stop)")
    
    tick_start_time = time.time()
    
    try:
        while True:
            tick_count += 1
            
            # Check if we've reached max ticks
            if max_ticks and tick_count > max_ticks:
                logger.success(f"✅ Completed {max_ticks} ticks, exiting test mode")
                break
            
            print("\n" + "━" * 60)
            print(f"🔄 TICK #{tick_count}" + (f" / {max_ticks}" if max_ticks else ""))
            print("━" * 60)
            
            tick_start = time.time()
            logger.info(f"Starting tick #{tick_count}")
            
            try:
                # Log memory state
                logger.debug(f"Memory: {len(action_memory)} actions stored")
                
                # Make decision
                logger.info("Calling LangGraph agent for decision...")
                result = await babylon_agent.decide(session_id=identity['agentId'])
                
                tick_duration = time.time() - tick_start
                
                logger.success(f"Tick #{tick_count} complete", {
                    'duration_seconds': round(tick_duration, 2),
                    'decision_preview': result['decision'][:100],
                    'memory_size': len(action_memory)
                })
                
                print(f"   Duration: {tick_duration:.2f}s")
                print(f"   Decision: {result['decision'][:100]}...")
                print("")
                
            except Exception as e:
                logger.error(f"Tick #{tick_count} error", {'error': str(e), 'type': type(e).__name__})
                print("")
            
            # Sleep between ticks (skip on last tick)
            if not max_ticks or tick_count < max_ticks:
                logger.info(f"Sleeping {tick_interval}s until next tick...")
                print(f"⏳ Sleeping {tick_interval}s...")
                print("")
                await asyncio.sleep(tick_interval)
        
        # Test mode complete
        if max_ticks:
            total_duration = time.time() - tick_start_time
            print("\n" + "=" * 60)
            print("🎉 TEST COMPLETE")
            print("=" * 60)
            logger.success("Test run complete", {
                'total_ticks': tick_count,
                'total_duration_seconds': round(total_duration, 2),
                'avg_tick_duration': round(total_duration / tick_count, 2),
                'total_actions_in_memory': len(action_memory)
            })
            
            # Save logs if log file specified
            if log_file:
                summary_file = log_file.replace('.jsonl', '_summary.json')
                logger.save_summary(summary_file)
                logger.info(f"Logs saved to: {log_file}")
                logger.info(f"Summary saved to: {summary_file}")
            
    except KeyboardInterrupt:
        logger.warning("\n🛑 Interrupted by user")
        await a2a_client.close()
        logger.info("Disconnected from Babylon")
        print("👋 Goodbye!")
    finally:
        await a2a_client.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Babylon Autonomous Agent - Python + LangGraph + HTTP A2A',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run indefinitely
  python agent_http.py
  
  # Test mode: Run for 10 ticks
  python agent_http.py --test
  
  # Run for 5 ticks with logging
  python agent_http.py --ticks 5 --log test.jsonl
  
  # Run with custom tick interval
  TICK_INTERVAL=10 python agent_http.py --ticks 10
        """
    )
    
    parser.add_argument(
        '--test',
        action='store_true',
        help='Test mode: Run for 10 ticks and exit'
    )
    
    parser.add_argument(
        '--ticks',
        type=int,
        metavar='N',
        help='Run for N ticks and exit (default: infinite)'
    )
    
    parser.add_argument(
        '--log',
        type=str,
        metavar='FILE',
        help='Save logs to file (JSONL format)'
    )
    
    args = parser.parse_args()
    
    # Determine max ticks
    max_ticks = None
    if args.test:
        max_ticks = 10
    elif args.ticks:
        max_ticks = args.ticks
    
    # Run agent
    asyncio.run(main(max_ticks=max_ticks, log_file=args.log))

