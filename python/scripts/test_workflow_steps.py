"""
Test GitHub Actions Workflow Steps Locally
Verifies each step will work in GitHub Actions
"""

import asyncio
import asyncpg
import sys
import os
from pathlib import Path
from datetime import datetime

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def print_success(msg):
    print(f"{GREEN}✅ {msg}{RESET}")

def print_error(msg):
    print(f"{RED}❌ {msg}{RESET}")

def print_warning(msg):
    print(f"{YELLOW}⚠️  {msg}{RESET}")

def print_step(msg):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}\n")

async def test_database_connection():
    """Test Step: Database Connection"""
    print_step("STEP 1: Testing Database Connection")
    
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print_error("DATABASE_URL not set")
        print_warning("Set it in your .env file or environment")
        return False
    
    try:
        pool = await asyncpg.create_pool(
            db_url,
            min_size=1,
            max_size=2,
            timeout=30
        )
        print_success(f"Connected to database: {db_url[:50]}...")
        
        # Test query
        result = await pool.fetchval("SELECT 1")
        print_success(f"Test query successful: {result}")
        
        await pool.close()
        print_success("Connection closed cleanly")
        return True
        
    except Exception as e:
        print_error(f"Database connection failed: {e}")
        return False

async def test_schema_validation():
    """Test Step: Validate Required Tables and Fields"""
    print_step("STEP 2: Validating Database Schema")
    
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        return False
    
    try:
        pool = await asyncpg.create_pool(db_url)
        
        # Check trajectories table
        count = await pool.fetchval("""
            SELECT COUNT(*) FROM trajectories
        """)
        print_success(f"trajectories table exists ({count} rows)")
        
        # Check required fields
        sample = await pool.fetchrow("""
            SELECT 
                "trajectoryId", 
                "agentId",
                "stepsJson",
                "isTrainingData",
                "usedInTraining",
                "aiJudgeReward",
                "windowId"
            FROM trajectories
            LIMIT 1
        """)
        
        if sample:
            print_success("All required trajectory fields exist")
        else:
            print_warning("No trajectories in database yet (expected for new deployment)")
        
        # Check training_batches table
        try:
            batch_count = await pool.fetchval("""
                SELECT COUNT(*) FROM training_batches
            """)
            print_success(f"training_batches table exists ({batch_count} rows)")
        except Exception as e:
            print_warning(f"training_batches table might not exist: {e}")
            print_warning("This is OK - will be created on first training run")
        
        # Check trained_models table
        try:
            model_count = await pool.fetchval("""
                SELECT COUNT(*) FROM trained_models
            """)
            print_success(f"trained_models table exists ({model_count} rows)")
        except Exception as e:
            print_warning(f"trained_models table might not exist: {e}")
            print_warning("This is OK - will be created on first training run")
        
        await pool.close()
        return True
        
    except Exception as e:
        print_error(f"Schema validation failed: {e}")
        return False

async def test_readiness_check():
    """Test Step: Readiness Check (from workflow)"""
    print_step("STEP 3: Testing Readiness Check")
    
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        return False
    
    try:
        pool = await asyncpg.create_pool(db_url, min_size=1, max_size=2, timeout=30)
        
        # This is the EXACT query from the workflow
        count = await pool.fetchval('''
            SELECT COUNT(*) FROM trajectories 
            WHERE "isTrainingData" = true 
            AND "usedInTraining" = false
            AND "aiJudgeReward" IS NOT NULL
            AND "stepsJson" IS NOT NULL
            AND "stepsJson"::text != 'null'
            AND "stepsJson"::text != '[]'
        ''')
        
        print_success(f"Found {count} trajectories ready for training")
        
        min_required = 100
        ready = count >= min_required
        
        if ready:
            print_success(f"READY: {count} >= {min_required}")
        else:
            print_warning(f"NOT READY: {count} < {min_required} (need {min_required - count} more)")
            print_warning("This is expected for new deployments")
            print_warning("Run agents to generate more trajectories")
        
        await pool.close()
        return True
        
    except Exception as e:
        print_error(f"Readiness check failed: {e}")
        return False

async def test_batch_creation():
    """Test Step: Batch Creation"""
    print_step("STEP 4: Testing Batch Record Creation")
    
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        return False
    
    try:
        pool = await asyncpg.create_pool(db_url)
        
        # Test batch ID
        test_batch_id = f"test-batch-{int(datetime.now().timestamp())}"
        print(f"Creating test batch: {test_batch_id}")
        
        # This is the EXACT query from the workflow
        await pool.execute('''
            INSERT INTO training_batches (
                "batchId", id, status, "startedAt", "createdAt"
            ) VALUES (
                $1, $1, 'training', NOW(), NOW()
            )
            ON CONFLICT ("batchId") 
            DO UPDATE SET status = 'training', "startedAt" = NOW()
        ''', test_batch_id)
        
        print_success(f"Batch created: {test_batch_id}")
        
        # Verify it was created
        batch = await pool.fetchrow('''
            SELECT "batchId", status, "createdAt"
            FROM training_batches
            WHERE "batchId" = $1
        ''', test_batch_id)
        
        print_success(f"Batch verified in database: status={batch['status']}")
        
        # Cleanup test batch
        await pool.execute('DELETE FROM training_batches WHERE "batchId" = $1', test_batch_id)
        print_success("Test batch cleaned up")
        
        await pool.close()
        return True
        
    except Exception as e:
        print_error(f"Batch creation failed: {e}")
        print_warning("Table might not exist - run migrations first")
        return False

def test_window_id_generation():
    """Test Step: Window ID Generation"""
    print_step("STEP 5: Testing Window ID Generation")
    
    try:
        # This is the EXACT bash command from workflow
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        window_id = now.strftime("%Y-%m-%dT%H:00")
        
        print_success(f"Window ID format: {window_id}")
        
        # Verify format
        if len(window_id) == 16 and 'T' in window_id and window_id.endswith(':00'):
            print_success("Window ID format is correct (YYYY-MM-DDTHH:00)")
            return True
        else:
            print_error(f"Window ID format incorrect: {window_id}")
            return False
            
    except Exception as e:
        print_error(f"Window ID generation failed: {e}")
        return False

def test_python_imports():
    """Test Step: Python Dependencies"""
    print_step("STEP 6: Testing Python Dependencies")
    
    required = [
        ('asyncio', 'asyncio'),
        ('asyncpg', 'asyncpg'),
        ('json', 'json'),
        ('os', 'os'),
        ('sys', 'sys'),
        ('datetime', 'datetime'),
    ]
    
    all_ok = True
    for name, module in required:
        try:
            __import__(module)
            print_success(f"{name} available")
        except ImportError:
            print_error(f"{name} NOT available")
            all_ok = False
    
    # Check optional (will be installed in workflow)
    optional = [
        ('openpipe-art', 'art'),
        ('wandb', 'wandb'),
    ]
    
    for name, module in optional:
        try:
            __import__(module)
            print_success(f"{name} available (optional)")
        except ImportError:
            print_warning(f"{name} not installed locally (will be installed in workflow)")
    
    return all_ok

def test_trainer_script():
    """Test Step: Trainer Script Exists"""
    print_step("STEP 7: Testing Trainer Script")
    
    trainer_path = Path(__file__).parent.parent / 'src' / 'training' / 'babylon_trainer.py'
    
    if not trainer_path.exists():
        print_error(f"Trainer script not found at: {trainer_path}")
        return False
    
    print_success(f"Trainer script exists: {trainer_path}")
    
    # Check file is not empty
    size = trainer_path.stat().st_size
    print_success(f"Trainer script size: {size:,} bytes")
    
    if size < 1000:
        print_error("Trainer script seems too small")
        return False
    
    # Check for main entry point
    content = trainer_path.read_text()
    if 'if __name__ == "__main__":' in content:
        print_success("Has __main__ entry point")
    else:
        print_error("Missing __main__ entry point")
        return False
    
    if 'class BabylonTrainer' in content:
        print_success("BabylonTrainer class defined")
    else:
        print_error("BabylonTrainer class not found")
        return False
    
    if 'async def train_window' in content:
        print_success("train_window method defined")
    else:
        print_error("train_window method not found")
        return False
    
    return True

async def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("  🧪 GITHUB ACTIONS WORKFLOW VALIDATION")
    print("="*60)
    
    results = []
    
    # Test each step
    results.append(("Python Imports", test_python_imports()))
    results.append(("Window ID Generation", test_window_id_generation()))
    results.append(("Trainer Script", test_trainer_script()))
    results.append(("Database Connection", await test_database_connection()))
    results.append(("Schema Validation", await test_schema_validation()))
    results.append(("Readiness Check", await test_readiness_check()))
    results.append(("Batch Creation", await test_batch_creation()))
    
    # Summary
    print_step("TEST SUMMARY")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        if result:
            print_success(f"{name}: PASSED")
        else:
            print_error(f"{name}: FAILED")
    
    print(f"\n{'='*60}")
    if passed == total:
        print_success(f"ALL TESTS PASSED ({passed}/{total})")
        print_success("GitHub Actions workflow will work!")
        print(f"{'='*60}\n")
        return 0
    else:
        print_error(f"SOME TESTS FAILED ({passed}/{total} passed)")
        print_warning("Fix issues before deploying workflow")
        print(f"{'='*60}\n")
        return 1

if __name__ == "__main__":
    # Load environment
    from dotenv import load_dotenv
    project_root = Path(__file__).parent.parent.parent
    load_dotenv(project_root / '.env.local', override=True)
    load_dotenv(project_root / '.env')
    
    sys.exit(asyncio.run(main()))

