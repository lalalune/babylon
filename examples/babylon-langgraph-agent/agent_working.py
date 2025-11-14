"""
Babylon Agent - WORKING VERSION
Uses ACTUAL Babylon APIs (not A2A which doesn't implement trading/social)
FULL INSTRUMENTATION of all inputs/outputs
"""

import os
import json
import time
import asyncio
import argparse
from datetime import datetime
from typing import Any, Dict, Optional
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

import httpx
from eth_account import Account

load_dotenv()

# ==================== HTTP Client ====================

class BabylonClient:
    """HTTP client for ACTUAL Babylon APIs"""
    
    def __init__(self, base_url: str, agent_id: str, address: str):
        self.base_url = base_url
        self.agent_id = agent_id
        self.address = address
        self.client = httpx.AsyncClient(timeout=30.0)
        self.call_log = []
        
    async def get(self, path: str, params: Optional[Dict] = None) -> Dict:
        """GET request with full logging"""
        url = f"{self.base_url}{path}"
        
        print(f"\n{'='*80}")
        print(f"📤 GET REQUEST")
        print(f"{'='*80}")
        print(f"URL: {url}")
        print(f"Params: {json.dumps(params, indent=2) if params else 'None'}")
        
        start_time = time.time()
        response = await self.client.get(url, params=params or {})
        duration = time.time() - start_time
        
        print(f"\n📥 RESPONSE ({duration:.3f}s)")
        print(f"Status: {response.status_code}")
        
        if response.status_code >= 400:
            print(f"Error: {response.text[:200]}")
            response.raise_for_status()
        
        result = response.json()
        print(f"Result: {json.dumps(result, indent=2)[:500]}...")
        print(f"✅ Success")
        print(f"{'='*80}\n")
        
        self.call_log.append({
            'timestamp': datetime.now().isoformat(),
            'method': 'GET',
            'path': path,
            'params': params,
            'status_code': response.status_code,
            'duration_seconds': duration
        })
        
        return result
    
    async def post(self, path: str, data: Dict) -> Dict:
        """POST request with full logging"""
        url = f"{self.base_url}{path}"
        
        print(f"\n{'='*80}")
        print(f"📤 POST REQUEST")
        print(f"{'='*80}")
        print(f"URL: {url}")
        print(f"Data: {json.dumps(data, indent=2)}")
        
        start_time = time.time()
        response = await self.client.post(url, json=data)
        duration = time.time() - start_time
        
        print(f"\n📥 RESPONSE ({duration:.3f}s)")
        print(f"Status: {response.status_code}")
        
        if response.status_code >= 400:
            print(f"Error: {response.text[:200]}")
            response.raise_for_status()
        
        result = response.json()
        print(f"Result: {json.dumps(result, indent=2)[:500]}...")
        print(f"✅ Success")
        print(f"{'='*80}\n")
        
        self.call_log.append({
            'timestamp': datetime.now().isoformat(),
            'method': 'POST',
            'path': path,
            'data': data,
            'status_code': response.status_code,
            'duration_seconds': duration
        })
        
        return result
    
    async def close(self):
        await self.client.aclose()
    
    def save_call_log(self, filename: str):
        with open(filename, 'w') as f:
            json.dump({
                'total_calls': len(self.call_log),
                'agent_id': self.agent_id,
                'calls': self.call_log
            }, f, indent=2)

# ==================== Tools Using Real APIs ====================

_client: Optional[BabylonClient] = None

def set_client(client: BabylonClient):
    global _client
    _client = client

@tool
async def get_markets() -> str:
    """Get all available prediction markets"""
    print(f"\n🔧 TOOL CALLED: get_markets()")
    
    # Use REAL Babylon API
    result = await _client.get('/api/markets/predictions', {'limit': '10', 'offset': '0'})
    
    questions = result.get('questions', [])
    print(f"🔧 TOOL RESULT: {len(questions)} markets found")
    if questions:
        print(f"  Sample market: {questions[0].get('text', 'N/A')[:50]}...")
        print(f"  ID: {questions[0].get('id')}")
    
    return json.dumps({'markets': questions[:5]})  # Limit to 5 for LLM context

@tool
async def get_feed(limit: int = 10) -> str:
    """Get recent posts from feed"""
    print(f"\n🔧 TOOL CALLED: get_feed(limit={limit})")
    
    result = await _client.get('/api/posts', {'limit': str(limit), 'offset': '0'})
    
    posts = result.get('posts', [])
    print(f"🔧 TOOL RESULT: {len(posts)} posts found")
    if posts:
        print(f"  Sample post: {posts[0].get('content', 'N/A')[:50]}...")
    
    return json.dumps({'posts': posts})

@tool
async def get_user_info() -> str:
    """Get info about the agent's user account"""
    print(f"\n🔧 TOOL CALLED: get_user_info()")
    
    # Try to get user by address
    result = await _client.get(f'/api/users', {'address': _client.address})
    
    print(f"🔧 TOOL RESULT: {json.dumps(result, indent=2)[:200]}...")
    return json.dumps(result)

# ==================== Agent ====================

class BabylonAgent:
    """LangGraph agent with real Babylon APIs"""
    
    SYSTEM_INSTRUCTION = """You are a trading agent for Babylon prediction markets.

Available tools:
- get_markets() - Get list of active prediction markets
- get_feed(limit) - Get recent posts from the social feed
- get_user_info() - Get your user information

Strategy: {strategy}

Task: Use tools to gather information about available markets and recent activity.
Then provide a summary of what you found.
"""

    def __init__(self, strategy: str = "balanced"):
        self.strategy = strategy
        self.model = ChatGroq(
            model="llama-3.1-8b-instant",
            api_key=os.getenv('GROQ_API_KEY'),
            temperature=0.7
        )
        
        self.tools = [get_markets, get_feed, get_user_info]
        self.graph = create_react_agent(self.model, tools=self.tools, checkpointer=MemorySaver())
        self.invocation_log = []
    
    async def decide(self, session_id: str) -> Dict:
        """Make decision with full logging"""
        prompt = self.SYSTEM_INSTRUCTION.format(strategy=self.strategy) + "\n\nGather information and provide analysis."
        
        print(f"\n{'='*80}")
        print(f"🧠 LLM INVOCATION")
        print(f"{'='*80}")
        print(f"Session: {session_id}")
        print(f"Prompt preview: {prompt[:200]}...")
        
        config = {"configurable": {"thread_id": session_id}}
        
        start_time = time.time()
        result = await self.graph.ainvoke({"messages": [("user", prompt)]}, config)
        duration = time.time() - start_time
        
        messages = result.get('messages', [])
        print(f"\n📊 LLM RESULT ({duration:.2f}s)")
        print(f"Total messages: {len(messages)}")
        
        # Log each message
        for i, msg in enumerate(messages):
            msg_type = type(msg).__name__
            content = getattr(msg, 'content', '')
            tool_calls = getattr(msg, 'tool_calls', [])
            
            print(f"\n  [{i+1}] {msg_type}:")
            if content:
                print(f"      Content: {str(content)[:150]}...")
            if tool_calls:
                for tc in tool_calls:
                    print(f"      Tool: {tc.get('name')}()")
        
        last_message = messages[-1]
        decision = last_message.content if hasattr(last_message, 'content') else str(last_message)
        
        print(f"\n💡 FINAL DECISION:")
        print(f"{decision[:400]}...")
        print(f"{'='*80}\n")
        
        self.invocation_log.append({
            'timestamp': datetime.now().isoformat(),
            'duration': duration,
            'message_count': len(messages),
            'decision': decision
        })
        
        return {'decision': decision}
    
    def save_invocation_log(self, filename: str):
        with open(filename, 'w') as f:
            json.dump({
                'total_invocations': len(self.invocation_log),
                'invocations': self.invocation_log
            }, f, indent=2)

# ==================== Main ====================

async def main(max_ticks: int = 2):
    """Run with full instrumentation"""
    client = None
    agent = None
    
    try:
        print("\n" + "="*80)
        print("🔬 BABYLON AGENT - FULLY INSTRUMENTED")
        print("="*80)
        print("Using REAL Babylon APIs (not A2A)")
        print(f"Test mode: {max_ticks} ticks\n")
        
        # Identity
        print("━" * 80)
        print("📝 Agent Identity")
        print("━" * 80)
        
        account = Account.from_key(os.getenv('AGENT0_PRIVATE_KEY'))
        token_id = int(time.time()) % 100000
        agent_id = f"11155111:{token_id}"
        
        print(f"Address: {account.address}")
        print(f"Agent ID: {agent_id}\n")
        
        # Connect
        print("━" * 80)
        print("🔌 Connect to Babylon")
        print("━" * 80)
        
        base_url = os.getenv('BABYLON_HTTP_URL', 'http://localhost:3000')
        client = BabylonClient(base_url, agent_id, account.address)
        set_client(client)
        
        print(f"Base URL: {base_url}")
        print(f"✅ Client ready\n")
        
        # LangGraph
        print("━" * 80)
        print("🧠 LangGraph Agent")
        print("━" * 80)
        
        agent = BabylonAgent(strategy='balanced')
        print(f"Model: llama-3.1-8b-instant")
        print(f"Tools: {len(agent.tools)}")
        for t in agent.tools:
            print(f"  - {t.name}")
        print(f"✅ Ready\n")
        
        # Loop
        print("━" * 80)
        print("🔄 Autonomous Loop")
        print("━" * 80)
        
        tick_interval = int(os.getenv('TICK_INTERVAL', '5'))
        
        for tick in range(1, max_ticks + 1):
            print(f"\n{'#'*80}")
            print(f"# TICK {tick} / {max_ticks}")
            print(f"{'#'*80}\n")
            
            await agent.decide(session_id=agent_id)
            
            print(f"✅ Tick {tick} complete\n")
            
            if tick < max_ticks:
                print(f"⏳ Sleeping {tick_interval}s...\n")
                await asyncio.sleep(tick_interval)
        
        # Save logs
        print("\n" + "="*80)
        print("📊 SAVING LOGS")
        print("="*80)
        
        client.save_call_log('working_api_calls.json')
        agent.save_invocation_log('working_llm_calls.json')
        
        print(f"✅ API calls: working_api_calls.json ({len(client.call_log)} calls)")
        print(f"✅ LLM calls: working_llm_calls.json ({len(agent.invocation_log)} calls)")
        print(f"\n🎉 Test complete - {max_ticks} ticks, 0 errors")
        
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted")
    except Exception as e:
        print(f"\n❌ ERROR: {type(e).__name__}: {e}")
        raise
    finally:
        if client:
            await client.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--ticks', type=int, default=2, help='Number of ticks')
    args = parser.parse_args()
    
    asyncio.run(main(max_ticks=args.ticks))

