'use client';

/**
 * Debug Page - Game Control Dashboard
 * 
 * Simple UI for controlling game state on Vercel
 * TODO: Remove this before production or add proper auth
 */

import { useEffect, useState } from 'react';
import { PageContainer } from '@/components/shared/PageContainer';

interface GameState {
  id: string;
  isRunning: boolean;
  currentDay: number;
  currentDate: string;
  lastTickAt?: string;
  pausedAt?: string;
  activeQuestions: number;
}

interface DbCheck {
  databaseConnection: string;
  databaseUrl: {
    exists: boolean;
    isPlaceholder?: boolean;
  };
}

export default function DebugPage() {
  const [game, setGame] = useState<GameState | null>(null);
  const [dbCheck, setDbCheck] = useState<DbCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadGameState = async () => {
    try {
      // Check database first
      const envResponse = await fetch('/debug/env');
      const envData = await envResponse.json();
      if (envData.checks) {
        setDbCheck(envData.checks);
      }

      // If database is not configured, show error and stop
      if (envData.checks?.databaseUrl?.isPlaceholder) {
        setMessage({ 
          type: 'error', 
          text: '⚠️ Database not configured. See instructions below.' 
        });
        setLoading(false);
        return;
      }

      // Load game state
      const response = await fetch('/api/game/control');
      const data = await response.json();
      if (data.success && data.game) {
        setGame(data.game);
      }
    } catch (error) {
      console.error('Failed to load game state:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGameState();
    const interval = setInterval(loadGameState, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/debug/start');
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setGame(data.game);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to start game' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setActionLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/debug/pause');
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setGame(data.game);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to pause game' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setActionLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500 dark:text-gray-400">Loading game state...</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">🛠️ Debug Control Panel</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Control game state on Vercel (TODO: Add auth before production)
          </p>
        </div>

        {message && (
          <div
            className={`p-4 rounded-lg border ${
              message.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200'
                : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Database Status */}
        {dbCheck && (
          <div className={`border rounded-lg p-4 ${
            dbCheck.databaseConnection.includes('✅')
              ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
              : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {dbCheck.databaseConnection.includes('✅') ? '✅' : '❌'}
              </span>
              <div>
                <p className="font-semibold">
                  Database Status: {dbCheck.databaseConnection}
                </p>
                {!dbCheck.databaseUrl.exists && (
                  <p className="text-sm mt-1">
                    DATABASE_URL environment variable is not set
                  </p>
                )}
                {dbCheck.databaseUrl.isPlaceholder && (
                  <div className="mt-2 text-sm space-y-1">
                    <p className="font-semibold">📋 How to fix:</p>
                    <ol className="list-decimal ml-5 space-y-1">
                      <li>Go to Vercel Dashboard → Your Project → Settings → Environment Variables</li>
                      <li>Add <code className="px-1 bg-white dark:bg-gray-900 rounded">DATABASE_URL</code></li>
                      <li>Value: <code className="px-1 bg-white dark:bg-gray-900 rounded">postgresql://USER:PASSWORD@HOST:PORT/DATABASE</code></li>
                      <li>Select all environments (Production, Preview, Development)</li>
                      <li>Redeploy your application</li>
                    </ol>
                    <p className="mt-2">
                      💡 Need a database? Try <a href="https://vercel.com/postgres" target="_blank" rel="noopener noreferrer" className="underline">Vercel Postgres</a> or <a href="https://railway.app" target="_blank" rel="noopener noreferrer" className="underline">Railway</a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!game ? (
          <div className="border rounded-lg bg-white dark:bg-gray-900">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold mb-2">No Game Found</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No continuous game exists in the database. Start one to begin.
              </p>
            </div>
            <div className="p-6">
              <button
                onClick={handleStart}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create & Start Game
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="border rounded-lg bg-white dark:bg-gray-900">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Game Status</h2>
                  <span className={`px-2 py-1 rounded text-sm ${
                    game.isRunning 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}>
                    {game.isRunning ? '✅ Running' : '⏸️  Paused'}
                  </span>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Current Day</p>
                    <p className="text-2xl font-bold">{game.currentDay}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Active Questions</p>
                    <p className="text-2xl font-bold">{game.activeQuestions}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Current Date</p>
                  <p className="text-sm font-mono">
                    {new Date(game.currentDate).toLocaleString()}
                  </p>
                </div>

                {game.lastTickAt && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Last Tick</p>
                    <p className="text-sm font-mono">
                      {new Date(game.lastTickAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {Math.floor((Date.now() - new Date(game.lastTickAt).getTime()) / 1000)}s ago
                    </p>
                  </div>
                )}

                {game.pausedAt && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Paused At</p>
                    <p className="text-sm font-mono">
                      {new Date(game.pausedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                <div className="pt-4 flex gap-2">
                  <button
                    onClick={handleStart}
                    disabled={actionLoading || game.isRunning}
                    className={`flex-1 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                      game.isRunning
                        ? 'border border-gray-300 bg-white text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {game.isRunning ? '✅ Game Running' : '▶️  Start Game'}
                  </button>
                  <button
                    onClick={handlePause}
                    disabled={actionLoading || !game.isRunning}
                    className={`flex-1 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                      !game.isRunning
                        ? 'border border-gray-300 bg-white text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {!game.isRunning ? '⏸️  Game Paused' : '⏸️  Pause Game'}
                  </button>
                </div>
              </div>
            </div>

            <div className="border rounded-lg bg-white dark:bg-gray-900">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold">Direct Links</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  For quick access (bookmark these or use in scripts)
                </p>
              </div>
              <div className="p-6 space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                    {window.location.origin}/debug/start
                  </code>
                  <button
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                    onClick={() => window.open('/debug/start', '_blank')}
                  >
                    Open
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                    {window.location.origin}/debug/pause
                  </code>
                  <button
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                    onClick={() => window.open('/debug/pause', '_blank')}
                  >
                    Open
                  </button>
                </div>
              </div>
            </div>

            <div className="border border-amber-500/50 rounded-lg bg-amber-50 dark:bg-amber-950">
              <div className="p-6 border-b border-amber-500/50">
                <h2 className="text-xl font-semibold text-amber-800 dark:text-amber-200">
                  ⚠️ Debug Mode
                </h2>
              </div>
              <div className="p-6 text-sm text-amber-700 dark:text-amber-300">
                <p>
                  This page has no authentication and should be removed before production.
                  Anyone with the URL can control the game state.
                </p>
                <p className="mt-2">
                  <strong>TODO:</strong> Add proper authentication or remove this endpoint.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}

