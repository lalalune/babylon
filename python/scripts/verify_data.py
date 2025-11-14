#!/usr/bin/env python3
"""
Data Verification Script

Strong types, clear errors, no hiding issues

Usage:
    python scripts/verify_data.py
"""

import asyncio
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from dotenv import load_dotenv
import logging

from data_bridge.reader import PostgresTrajectoryReader

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


async def main():
    load_dotenv()
    
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL environment variable required")
    
    print("=" * 80)
    print("DATA VERIFICATION")
    print("=" * 80)
    print()
    
    async with PostgresTrajectoryReader(db_url) as db:
        # Check various agent thresholds
        print("Checking window availability...")
        print()
        
        for min_agents in [2, 3, 5, 8]:
            windows = await db.get_window_ids(min_agents=min_agents, lookback_hours=168)
            print(f"  Windows with {min_agents}+ agents: {len(windows)}")
        
        print()
        
        # Get windows with 5+ agents
        windows_5plus = await db.get_window_ids(min_agents=5, lookback_hours=168)
        
        if not windows_5plus:
            print("❌ NO TRAINING DATA AVAILABLE")
            print()
            print("Action required:")
            print("  1. Run: npx ts-node scripts/spawn-test-agents.ts")
            print("  2. Run this script 3-4 times to generate multiple windows")
            print("  3. Then run this verification again")
            print()
            sys.exit(1)
        
        print(f"✅ Found {len(windows_5plus)} windows with 5+ agents")
        print()
        
        # Show sample windows
        print("Sample windows (first 5):")
        print()
        
        for window_id in windows_5plus[:5]:
            stats = await db.get_window_stats(window_id)
            if stats:
                print(f"  {window_id}")
                print(f"    Agents: {stats.agent_count}")
                print(f"    Trajectories: {stats.trajectory_count}")
                print(f"    Actions: {stats.total_actions}")
                print(f"    Avg P&L: ${stats.avg_pnl:.2f}")
                print(f"    Range: ${stats.min_pnl:.2f} to ${stats.max_pnl:.2f}")
                print()
        
        # Training readiness
        print("=" * 80)
        if len(windows_5plus) >= 3:
            print("✅ READY FOR TRAINING")
            print()
            print("Run training:")
            print("  python scripts/train.py --min-agents 5 --iterations 10")
        else:
            print("⚠️  LIMITED DATA")
            print()
            print(f"Found {len(windows_5plus)} windows (recommend 10+ for robust training)")
            print("Generate more data:")
            print("  npx ts-node scripts/spawn-test-agents.ts")
        print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())



