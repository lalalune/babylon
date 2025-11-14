/**
 * Admin Performance Dashboard
 * 
 * Displays network statistics, database performance, and allows running load tests
 */

'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

// Simple replacement components
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`border rounded-lg p-4 ${className}`}>{children}</div>
);
const CardHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <div className={`mb-4 ${className}`}>{children}</div>;
const CardTitle = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <h3 className={`text-lg font-semibold ${className}`}>{children}</h3>;
const CardDescription = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;
const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>;
const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: string }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
    variant === 'destructive' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
  }`}>{children}</span>
);
const Button = ({ children, onClick, disabled, className = '' }: { children: React.ReactNode; onClick?: () => void | Promise<void>; disabled?: boolean; className?: string; variant?: string; size?: string }) => (
  <button onClick={onClick} disabled={disabled} className={`px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 ${className}`}>{children}</button>
);

interface NetworkStats {
  timestamp: string;
  database: {
    queries: {
      total: number;
      slow: number;
      slowRate: number;
      avgDuration: number;
      p95Duration: number;
      p99Duration: number;
    };
    topSlowQueries: Array<{
      query: string;
      count: number;
      avgDuration: number;
      maxDuration: number;
    }>;
    recentQueries: Array<{
      query: string;
      duration: number;
      timestamp: string;
      model?: string;
      operation?: string;
    }>;
  };
  server: {
    uptime: {
      seconds: number;
      formatted: string;
    };
    memory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
    env: string;
    pid: number;
  };
  health: {
    database: 'healthy' | 'warning' | 'critical';
    memory: 'healthy' | 'warning' | 'critical';
    overall: 'healthy' | 'warning' | 'critical';
  };
}

interface LoadTestStatus {
  status: 'idle' | 'running';
  scenario?: string;
  startTime?: string;
  runningTimeMs?: number;
  runningTimeSeconds?: number;
  lastResult?: {
    endTime: string;
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
  };
}

const SCENARIOS = [
  { value: 'LIGHT', label: 'Light (100 users, 1 min)', description: 'Basic load testing' },
  { value: 'NORMAL', label: 'Normal (500 users, 2 min)', description: 'Typical production load' },
  { value: 'HEAVY', label: 'Heavy (1000 users, 5 min)', description: 'High load scenario' },
  { value: 'STRESS', label: 'Stress (2000+ users, 5 min)', description: 'Extreme load test' },
];

export default function AdminPerformancePage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loadTestStatus, setLoadTestStatus] = useState<LoadTestStatus | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string>('NORMAL');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch network stats
  const fetchStats = async () => {
    const response = await fetch('/api/admin/network-stats').catch((err: Error) => {
      logger.error('Failed to fetch network stats', err, 'AdminPerformancePage');
      setError(err.message);
      throw err;
    });
    
    if (!response.ok) {
      const error = new Error('Failed to fetch stats');
      setError(error.message);
      throw error;
    }
    
    const data = await response.json();
    setStats(data);
    setError(null);
  };

  // Fetch load test status
  const fetchLoadTestStatus = async () => {
    const response = await fetch('/api/admin/load-test/status').catch((err: Error) => {
      logger.error('Failed to fetch load test status', err, 'AdminPerformancePage');
      throw err;
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch load test status');
    }
    
    const data = await response.json();
    setLoadTestStatus(data);
  };

  // Start load test
  const startLoadTest = async () => {
    setIsLoading(true);
    setError(null);

    const response = await fetch('/api/admin/load-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: selectedScenario }),
    }).catch((err: Error) => {
      setError(err.message);
      setIsLoading(false);
      throw err;
    });

    if (!response.ok) {
      const data = await response.json();
      const error = new Error(data.error || 'Failed to start load test');
      setError(error.message);
      setIsLoading(false);
      throw error;
    }

    await fetchLoadTestStatus().catch((err: Error) => {
      setError(err.message);
    });
    
    setIsLoading(false);
  };

  // Auto-refresh stats
  useEffect(() => {
    fetchStats();
    fetchLoadTestStatus();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchStats();
        fetchLoadTestStatus();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
    
    return undefined;
  }, [autoRefresh]);

  const getHealthBadgeVariant = (health: 'healthy' | 'warning' | 'critical'): 'default' | 'secondary' | 'destructive' => {
    switch (health) {
      case 'healthy': return 'default';
      case 'warning': return 'secondary';
      case 'critical': return 'destructive';
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Performance Dashboard</h1>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (5s)
          </label>
          <Button onClick={fetchStats} variant="outline" size="sm">
            Refresh Now
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* System Health Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={getHealthBadgeVariant(stats.health.overall)}>
                  {stats.health.overall.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Database</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={getHealthBadgeVariant(stats.health.database)}>
                  {stats.health.database.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {stats.database.queries.slowRate.toFixed(1)}% slow
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Memory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={getHealthBadgeVariant(stats.health.memory)}>
                  {stats.health.memory.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {stats.server.memory.heapUsed.toFixed(0)}MB / {stats.server.memory.heapTotal.toFixed(0)}MB
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Database Performance */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Database Performance</CardTitle>
            <CardDescription>Query metrics from the last 60 seconds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <div className="text-2xl font-bold">{stats.database.queries.total.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total Queries</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.database.queries.slow}</div>
                <div className="text-xs text-muted-foreground">Slow Queries</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.database.queries.avgDuration.toFixed(1)}ms</div>
                <div className="text-xs text-muted-foreground">Avg Duration</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.database.queries.p95Duration.toFixed(1)}ms</div>
                <div className="text-xs text-muted-foreground">95th Percentile</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.database.queries.p99Duration.toFixed(1)}ms</div>
                <div className="text-xs text-muted-foreground">99th Percentile</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.database.queries.slowRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Slow Rate</div>
              </div>
            </div>

            {/* Top Slow Queries */}
            {stats.database.topSlowQueries.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Top Slow Queries</h3>
                <div className="space-y-2">
                  {stats.database.topSlowQueries.map((query, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm border-b pb-2">
                      <div className="flex-1">
                        <div className="font-mono">{query.query}</div>
                        <div className="text-xs text-muted-foreground">Count: {query.count}</div>
                      </div>
                      <div className="text-right">
                        <div>Avg: {query.avgDuration.toFixed(1)}ms</div>
                        <div className="text-xs text-muted-foreground">Max: {query.maxDuration.toFixed(1)}ms</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Load Testing */}
      <Card>
        <CardHeader>
          <CardTitle>Load Testing</CardTitle>
          <CardDescription>Simulate concurrent users and test system performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadTestStatus?.status === 'running' ? (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded">
              <div className="font-semibold">Load test running...</div>
              <div className="text-sm">
                Scenario: {loadTestStatus.scenario} | Running for: {loadTestStatus.runningTimeSeconds}s
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Select Scenario</label>
                <select
                  value={selectedScenario}
                  onChange={(e) => setSelectedScenario(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  disabled={isLoading}
                >
                  {SCENARIOS.map(scenario => (
                    <option key={scenario.value} value={scenario.value}>
                      {scenario.label} - {scenario.description}
                    </option>
                  ))}
                </select>
              </div>

              <Button onClick={startLoadTest} disabled={isLoading}>
                {isLoading ? 'Starting...' : 'Start Load Test'}
              </Button>
            </>
          )}

          {loadTestStatus?.lastResult && (
            <div>
              <h3 className="font-semibold mb-2">Last Test Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-lg font-bold">{loadTestStatus.lastResult.totalRequests.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Requests</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{(loadTestStatus.lastResult.successRate * 100).toFixed(2)}%</div>
                  <div className="text-xs text-muted-foreground">Success Rate</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{loadTestStatus.lastResult.avgResponseTime.toFixed(1)}ms</div>
                  <div className="text-xs text-muted-foreground">Avg Response Time</div>
                </div>
                <div>
                  <div className="text-lg font-bold">
                    {new Date(loadTestStatus.lastResult.endTime).toLocaleTimeString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Completed At</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Server Info */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Server Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-semibold">Uptime</div>
                <div>{stats.server.uptime.formatted}</div>
              </div>
              <div>
                <div className="font-semibold">Environment</div>
                <div>{stats.server.env}</div>
              </div>
              <div>
                <div className="font-semibold">Process ID</div>
                <div>{stats.server.pid}</div>
              </div>
              <div>
                <div className="font-semibold">Last Updated</div>
                <div>{new Date(stats.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

