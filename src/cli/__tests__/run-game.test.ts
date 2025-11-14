/**
 * CLI Run-Game Tests
 * Tests command-line game simulation interface
 */

import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'bun';
import { existsSync, unlinkSync } from 'fs';

const CLI_PATH = 'src/cli/run-game.ts';

describe('CLI Game Runner', () => {
  describe('Basic Execution', () => {
    test('runs complete game simulation', () => {
      const result = spawnSync(['bun', 'run', CLI_PATH, '--fast']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toContain('Game complete');
    });

    test('exits with code 0 on success', () => {
      const result = spawnSync(['bun', 'run', CLI_PATH, '--fast']);

      expect(result.exitCode).toBe(0);
    });

    test('completes quickly in fast mode', () => {
      const start = Date.now();
      spawnSync(['bun', 'run', CLI_PATH, '--fast']);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(3000); // Under 3 seconds
    });
  });

  describe('Outcome Flag', () => {
    test('respects --outcome=YES flag', () => {
      const result = spawnSync([
        'bun', 'run', CLI_PATH,
        '--outcome=YES',
        '--fast',
        '--json'
      ]);

      const output = JSON.parse(result.stdout.toString());
      expect(output.outcome).toBe(true);
    });

    test('respects --outcome=NO flag', () => {
      const result = spawnSync([
        'bun', 'run', CLI_PATH,
        '--outcome=NO',
        '--fast',
        '--json'
      ]);

      const output = JSON.parse(result.stdout.toString());
      expect(output.outcome).toBe(false);
    });

    test('defaults to random outcome without flag', () => {
      const result = spawnSync([
        'bun', 'run', CLI_PATH,
        '--fast',
        '--json'
      ]);

      const output = JSON.parse(result.stdout.toString());
      expect(typeof output.outcome).toBe('boolean');
    });
  });

  describe('Save Functionality', () => {
    const testFile = 'test-game-cli.json';

    test('creates save file with --save flag', async () => {
      // Clean up if exists
      if (existsSync(testFile)) unlinkSync(testFile);

      const result = spawnSync([
        'bun', 'run', CLI_PATH,
        `--save=${testFile}`,
        '--fast'
      ]);

      expect(result.exitCode).toBe(0);
      expect(existsSync(testFile)).toBe(true);

      // Clean up
      unlinkSync(testFile);
    });

    test('saved file contains valid game data', async () => {
      if (existsSync(testFile)) unlinkSync(testFile);

      spawnSync([
        'bun', 'run', CLI_PATH,
        `--save=${testFile}`,
        '--fast'
      ]);

      const file = Bun.file(testFile);
      const data = await file.json();

      expect(data.id).toBeDefined();
      expect(data.question).toBeDefined();
      expect(data.events).toBeDefined();
      expect(Array.isArray(data.events)).toBe(true);
      expect(data.outcome).toBeDefined();
      expect(data.agents).toBeDefined();
      expect(data.market).toBeDefined();

      // Clean up
      unlinkSync(testFile);
    });
  });

  describe('Batch Mode', () => {
    test('runs multiple games with --count flag', () => {
      const result = spawnSync([
        'bun', 'run', CLI_PATH,
        '--count=5',
        '--fast'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toContain('5 games completed');
    });

    test('batch mode completes quickly', () => {
      const start = Date.now();
      
      spawnSync([
        'bun', 'run', CLI_PATH,
        '--count=10',
        '--fast'
      ]);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10000); // 10 games in under 10s
    });

    test('batch mode provides statistics', () => {
      const result = spawnSync([
        'bun', 'run', CLI_PATH,
        '--count=10',
        '--fast'
      ]);

      const output = result.stdout.toString();
      expect(output).toContain('Avg time');
      expect(output).toContain('YES outcomes');
      expect(output).toContain('NO outcomes');
    });
  });

  describe('JSON Output', () => {
    test('produces parseable JSON with --json flag', () => {
      const result = spawnSync([
        'bun', 'run', CLI_PATH,
        '--fast',
        '--json'
      ]);

      expect(() => JSON.parse(result.stdout.toString())).not.toThrow();
    });

    test('JSON output contains all required fields', () => {
      const result = spawnSync([
        'bun', 'run', CLI_PATH,
        '--fast',
        '--json'
      ]);

      const data = JSON.parse(result.stdout.toString());
      
      expect(data.id).toBeDefined();
      expect(data.question).toBeDefined();
      expect(data.outcome).toBeDefined();
      expect(data.events).toBeDefined();
      expect(data.agents).toBeDefined();
      expect(data.winners).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('handles invalid flags gracefully', () => {
      const result = spawnSync([
        'bun', 'run', CLI_PATH,
        '--invalid-flag',
        '--fast'
      ]);

      // Should still run (ignore unknown flags)
      expect(result.exitCode).toBe(0);
    });
  });
});

