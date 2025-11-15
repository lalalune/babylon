#!/usr/bin/env bun
/**
 * Utility to kill processes on a specific port
 * 
 * This function finds all processes using the specified port and kills them,
 * including their child processes (process tree).
 */

/**
 * Find all child processes of a given PID recursively
 */
async function findChildProcesses(parentPid: number): Promise<number[]> {
  const children: number[] = []
  
  try {
    // Use ps to find all processes with this parent PID
    const psProcess = Bun.spawn(['ps', '-o', 'pid', '--ppid', parentPid.toString(), '--no-headers'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    
    const output = await new Response(psProcess.stdout).text()
    const pids = output.trim().split('\n').filter(Boolean).map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p))
    
    // Recursively find children of children
    for (const pid of pids) {
      children.push(pid)
      const grandchildren = await findChildProcesses(pid)
      children.push(...grandchildren)
    }
  } catch {
    // ps might not be available or no children found
  }
  
  return children
}

/**
 * Kill a process and all its children (process tree)
 */
async function killProcessTree(pid: number): Promise<void> {
  try {
    // Find all child processes recursively
    const children = await findChildProcesses(pid)
    
    // Kill all children first (bottom-up)
    for (const childPid of children.reverse()) {
      try {
        process.kill(childPid, 'SIGTERM')
      } catch {
        // Process might already be dead
      }
    }
    
    // Wait a bit for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Force kill children if still running
    for (const childPid of children) {
      try {
        process.kill(childPid, 'SIGKILL')
      } catch {
        // Process might already be dead
      }
    }
    
    // Finally kill the parent process
    try {
      process.kill(pid, 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 1000))
      process.kill(pid, 'SIGKILL')
    } catch {
      // Process might already be dead
    }
  } catch (error) {
    // Fallback: try direct kill
    try {
      process.kill(pid, 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 1000))
      process.kill(pid, 'SIGKILL')
    } catch {
      // Process might already be dead
    }
  }
}

/**
 * Kill all processes using the specified port
 * @param port - The port number to kill processes on
 * @param excludePid - Optional PID to exclude from killing (e.g., current process)
 * @returns The number of processes killed
 */
export async function killPort(port: number, excludePid?: number): Promise<number> {
  let killedCount = 0
  
  try {
    // Find all processes using this port
    const lsofProcess = Bun.spawn(['lsof', '-ti', `:${port}`], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    
    const output = await new Response(lsofProcess.stdout).text()
    const pids = output.trim().split('\n').filter(Boolean).map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p))
    
    if (pids.length === 0) {
      return 0
    }
    
    // Kill each process and its children
    for (const pid of pids) {
      // Skip if this is the excluded PID
      if (excludePid !== undefined && pid === excludePid) {
        continue
      }
      
      // Skip if this is the current process
      if (pid === process.pid) {
        continue
      }
      
      try {
        await killProcessTree(pid)
        killedCount++
      } catch (error) {
        // Process might already be dead or we don't have permission
        // Continue with other processes
      }
    }
    
    // Wait a bit for processes to fully terminate
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Double-check and force kill any remaining processes
    const checkProcess = Bun.spawn(['lsof', '-ti', `:${port}`], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    
    const remainingOutput = await new Response(checkProcess.stdout).text()
    const remainingPids = remainingOutput.trim().split('\n').filter(Boolean).map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p))
    
    for (const pid of remainingPids) {
      if (excludePid !== undefined && pid === excludePid) {
        continue
      }
      if (pid === process.pid) {
        continue
      }
      
      try {
        // Force kill any remaining processes
        process.kill(pid, 'SIGKILL')
        killedCount++
      } catch {
        // Process might already be dead
      }
    }
    
    return killedCount
  } catch (error) {
    // lsof might not be available or no processes found
    // This is fine, just return 0
    return 0
  }
}

// If run directly, kill port 3000
if (import.meta.main) {
  const port = parseInt(process.argv[2] || '3000', 10)
  console.log(`🔍 Checking for processes on port ${port}...`)
  
  const killed = await killPort(port)
  
  if (killed > 0) {
    console.log(`✅ Killed ${killed} process(es) on port ${port}`)
  } else {
    console.log(`✅ No processes found on port ${port}`)
  }
}

