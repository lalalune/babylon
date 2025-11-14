#!/usr/bin/env python3
"""
Run Database Migrations

Applies migrations to add window tracking support.

Usage:
    python scripts/run_migrations.py
"""

import asyncio
import os
import sys
from dotenv import load_dotenv
import asyncpg

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


async def run_migration(db_url: str, migration_file: str):
    """Run a single migration file"""
    
    print(f"Running migration: {migration_file}")
    
    # Read migration SQL
    with open(migration_file, 'r') as f:
        sql = f.read()
    
    # Connect and execute
    conn = await asyncpg.connect(db_url)
    
    try:
        await conn.execute(sql)
        print(f"✅ Migration complete: {migration_file}")
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        await conn.close()


async def main():
    load_dotenv()
    
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ DATABASE_URL not set")
        return
    
    print("=" * 80)
    print("DATABASE MIGRATIONS")
    print("=" * 80)
    print()
    
    # Get migrations directory
    migrations_dir = os.path.join(
        os.path.dirname(__file__),
        '..',
        'migrations'
    )
    
    # Find all migration files
    migration_files = sorted([
        os.path.join(migrations_dir, f)
        for f in os.listdir(migrations_dir)
        if f.endswith('.sql')
    ])
    
    if not migration_files:
        print("No migration files found")
        return
    
    print(f"Found {len(migration_files)} migration(s):\n")
    
    for migration_file in migration_files:
        print(f"  - {os.path.basename(migration_file)}")
    
    print()
    
    # Run each migration
    for migration_file in migration_files:
        await run_migration(db_url, migration_file)
        print()
    
    print("=" * 80)
    print("ALL MIGRATIONS COMPLETE")
    print("=" * 80)
    print()
    print("Next steps:")
    print("  1. Update TypeScript to set window_id in trajectories")
    print("  2. Spawn test agents: npx ts-node scripts/spawn-test-agents.ts")
    print("  3. Check data: python scripts/check_windows.py")
    print("  4. Train: python scripts/train_mmo.py")


if __name__ == "__main__":
    asyncio.run(main())



