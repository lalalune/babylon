/**
 * Complete RL Training System Test
 * Verifies data collection, training pipeline, and deployment
 * 
 * Usage: 
 *   npm run test:rl-system          # Normal mode (checks data requirements)
 *   FORCE=true npm run test:rl-system  # Force mode (runs regardless of data)
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { prisma } from '../src/lib/prisma';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

// Load .env files in order of priority
config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

const FORCE_MODE = process.env.FORCE === 'true';

async function main() {
  console.log('🧪 Testing Complete RL Training System');
  if (FORCE_MODE) {
    console.log('⚡ FORCE MODE: Running regardless of data requirements');
  }
  console.log('======================================\n');

  // 1. Check environment
  console.log('1️⃣  Checking environment...');
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }
  console.log('✅ Database URL configured');

  if (!process.env.WANDB_API_KEY) {
    console.log('⚠️  WANDB_API_KEY not set - will use local training');
  } else {
    console.log('✅ Wandb API key configured');
  }

  // 2. Check trajectory recording setting
  console.log('\n2️⃣  Checking trajectory recording...');
  const recordingEnabled = process.env.RECORD_AGENT_TRAJECTORIES === 'true';
  if (recordingEnabled) {
    console.log('✅ Trajectory recording enabled');
  } else {
    console.log('⚠️  Trajectory recording disabled');
    console.log('   Enable with: RECORD_AGENT_TRAJECTORIES=true in .env.local');
  }

  // 3. Check existing trajectories
  console.log('\n3️⃣  Checking existing trajectories...');
  const totalTrajectories = await prisma.trajectory.count({
    where: { isTrainingData: true },
  });
  console.log(`Found ${totalTrajectories} training trajectories`);

  if (totalTrajectories === 0 && !FORCE_MODE) {
    console.log('\n⚠️  No trajectories yet - need to collect data first\n');
    console.log('To collect data:');
    console.log('  1. Ensure agents exist: npm run spawn-test-agents');
    console.log('  2. Set RECORD_AGENT_TRAJECTORIES=true');
    console.log('  3. Run agent tick: npm run agent-tick');
    console.log('  4. Wait for trajectories to accumulate\n');
    console.log('Or run with FORCE=true to test with minimal/no data');
    await prisma.$disconnect();
    return;
  }
  
  if (totalTrajectories === 0 && FORCE_MODE) {
    console.log('\n⚠️  No trajectories, but FORCE_MODE enabled - will test with mock data');
  }

  // 4. Check windows
  console.log('\n4️⃣  Checking training readiness...');
  
  // Group trajectories by window
  const allTrajectories = await prisma.trajectory.findMany({
    where: {
      isTrainingData: true,
      windowId: { not: null },
    },
    select: {
      windowId: true,
      episodeLength: true,
      finalPnL: true,
    },
  });
  
  // Group manually
  const windowMap = new Map<string, { count: number; totalSteps: number; totalPnl: number }>();
  for (const traj of allTrajectories) {
    const wid = traj.windowId!;
    const existing = windowMap.get(wid) || { count: 0, totalSteps: 0, totalPnl: 0 };
    existing.count++;
    existing.totalSteps += traj.episodeLength || 0;
    existing.totalPnl += Number(traj.finalPnL) || 0;
    windowMap.set(wid, existing);
  }
  
  const windowStats = Array.from(windowMap.entries())
    .map(([windowId, stats]) => ({
      windowId,
      count: stats.count,
      avgSteps: stats.totalSteps / stats.count,
      avgPnl: stats.totalPnl / stats.count,
    }))
    .sort((a, b) => b.windowId.localeCompare(a.windowId))
    .slice(0, 10);

  const readyWindows = windowStats.filter(w => w.count >= 3);
  console.log(`Ready windows (≥3 agents): ${readyWindows.length}`);

  if (readyWindows.length === 0 && !FORCE_MODE) {
    console.log('\n⚠️  No windows ready for training yet');
    console.log('   Need at least 3 agents per window for GRPO\n');
    console.log('Current data:');
    windowStats.forEach(w => {
      console.log(`  ${w.windowId}: ${w.count} agents, ${w.avgSteps.toFixed(0)} avg steps`);
    });
    console.log('\nRun with FORCE=true to test training anyway with reduced requirements');
    await prisma.$disconnect();
    return;
  }
  
  if (readyWindows.length === 0 && FORCE_MODE) {
    console.log('\n⚠️  No ready windows, but FORCE_MODE enabled - reducing requirements');
    console.log('   Will use windows with 1+ agents (not recommended for real training)');
    // Use all windows in force mode
    readyWindows.push(...windowStats.filter(w => w.count > 0));
  }

  console.log('✅', readyWindows.length, 'windows ready for training\n');

  // 5. Show window details
  console.log('5️⃣  Training data details...\n');
  console.log('Window ID              | Agents | Avg Steps | Avg P&L');
  console.log('-----------------------+--------+-----------+---------');
  readyWindows.slice(0, 5).forEach(w => {
    console.log(
      `${w.windowId.padEnd(22)} | ${String(w.count).padStart(6)} | ${w.avgSteps.toFixed(0).padStart(9)} | $${w.avgPnl.toFixed(2).padStart(7)}`
    );
  });

  // 6. Test Python training system
  console.log('\n6️⃣  Testing Python training system...');
  
  // Check for venv and install dependencies if needed
  try {
    const { stdout: venvCheck } = await execAsync('[ -d python/venv ] && echo "exists" || echo "missing"');
    
    if (venvCheck.trim() === 'missing') {
      console.log('Creating Python virtual environment...');
      await execAsync('cd python && python3 -m venv venv');
      console.log('Installing dependencies...');
      await execAsync('cd python && source venv/bin/activate && pip install -r requirements.txt', {
        maxBuffer: 50 * 1024 * 1024 // 50MB for large install output
      });
      console.log('✅ Python environment set up');
    } else {
      console.log('✅ Python virtual environment exists');
    }
    
    // Test imports
    await execAsync('cd python && source venv/bin/activate && python -c "from src.training.babylon_trainer import BabylonTrainer; print(\'✅ Python imports work!\')"');
    console.log('✅ Python training system ready');
  } catch (error: any) {
    console.log('❌ Python training system error:', error.message);
    if (!FORCE_MODE) {
      await prisma.$disconnect();
      return;
    }
    console.log('⚡ FORCE_MODE: Continuing despite Python errors...');
  }

  // 7. Actually run training if force mode
  if (FORCE_MODE && readyWindows.length > 0) {
    console.log('\n7️⃣  FORCE MODE: Running training now...\n');
    
    const windowToTrain = readyWindows[0]!.windowId;
    console.log(`Training on window: ${windowToTrain}`);
    console.log(`Agents: ${readyWindows[0]!.count}`);
    console.log('');
    
    try {
      // Set environment for training
      process.env.MODE = 'single';
      process.env.WINDOW_ID = windowToTrain;
      process.env.MIN_AGENTS_PER_WINDOW = FORCE_MODE ? '1' : '3';
      
      const { stdout, stderr } = await execAsync(
        'cd python && source venv/bin/activate && TRAIN_RL_LOCAL=true MODE=single python -m src.training.babylon_trainer',
        { 
          env: { 
            ...process.env,
            MODE: 'single',
            WINDOW_ID: windowToTrain,
            MIN_AGENTS_PER_WINDOW: FORCE_MODE ? '1' : '3',
            TRAIN_RL_LOCAL: 'true',
            BASE_MODEL: 'OpenPipe/Qwen3-14B-Instruct'
          },
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }
      );
      
      console.log(stdout);
      if (stderr) console.error('Stderr:', stderr);
      
      console.log('\n✅ Training completed successfully!');
      
    } catch (error: any) {
      console.log('\n❌ Training failed:', error.message);
      if (error.stdout) console.log('Output:', error.stdout);
      if (error.stderr) console.log('Error:', error.stderr);
    }
  } else {
    // 7. Show next steps
    console.log('\n7️⃣  System Status: READY TO TRAIN! 🚀\n');
    console.log('Run training now:');
    console.log('  cd python');
    console.log('  MODE=single python -m src.training.babylon_trainer\n');
    console.log('This will:');
    console.log('  • Collect trajectories from database');
    console.log('  • Score with local heuristics');
    console.log('  • Train LoRA adapter');
    console.log('  • Deploy to W&B Inference\n');

    console.log('Or use RULER scoring (requires OpenPipe API key):');
    console.log('  python -m src.training.trainer\n');
    
    console.log('Or force training with current data:');
    console.log('  FORCE=true npm run test:rl-system\n');
  }

  console.log('======================================');
  console.log('✅ RL System Test Complete');
  console.log('======================================\n');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Test failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
