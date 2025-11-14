/**
 * Training Dashboard Admin Panel
 * 
 * Complete monitoring and control for RL training system
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, PlayCircle, Database, Cpu, TrendingUp, AlertCircle } from 'lucide-react';

interface TrainingJob {
  id: string;
  modelVersion: string;
  status: string;
  createdAt: string | Date;
}

interface TrainingModel {
  id: string;
  version: string;
  status: string;
}

interface TrainingStatus {
  status: string;
  automation: {
    dataCollection: {
      last24h: number;
      last7d: number;
      ratePerHour: number;
    };
    training: {
      currentJob: string | null;
      lastCompleted: Date | null;
      nextScheduled: Date | null;
    };
    models: {
      latest: string | null;
      deployed: number;
      training: number;
    };
    health: {
      database: boolean;
      storage: boolean;
      wandb: boolean;
    };
  };
  readiness: {
    ready: boolean;
    reason: string;
    stats: {
      totalTrajectories: number;
      unscoredTrajectories: number;
    scenarioGroups: number;
    dataQuality: number;
  };
};
recentJobs: TrainingJob[];
models: TrainingModel[];
trajectoryStats: {
  last1h?: number;
  last24h?: number;
  last7d?: number;
};
}

export default function TrainingDashboard() {
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  async function loadStatus() {
    const res = await fetch('/api/admin/training/status').catch((error: Error) => {
      console.error('Failed to load status:', error);
      setLoading(false);
      throw error;
    });
    
    const data = await res.json();
    setStatus(data);
    setLoading(false);
  }

  async function triggerTraining() {
    setTraining(true);
    
    const res = await fetch('/api/admin/training/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: false })
    }).catch((error: Error) => {
      alert(`Error: ${error.message}`);
      setTraining(false);
      throw error;
    });
    
    const result = await res.json();
    
    if (result.success) {
      alert(`Training started! Job ID: ${result.jobId}`);
      await loadStatus();
    } else {
      alert(`Failed to start training: ${result.error}`);
    }
    
    setTraining(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-8">
        <div className="text-red-500">Failed to load training status</div>
      </div>
    );
  }

  const { automation, readiness } = status;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RL Training Dashboard</h1>
          <p className="text-muted-foreground">Monitor and control automated training pipeline</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={triggerTraining}
            disabled={training || !!automation.training.currentJob}
            size="lg"
          >
            {training ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Train Now
              </>
            )}
          </Button>
          <Button variant="outline" size="lg" onClick={() => window.open(`https://wandb.ai/${automation.training.currentJob || 'latest'}`, '_blank')}>
            View W&B
          </Button>
        </div>
      </div>

      {/* Data Collection Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trajectories (24h)</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{automation.dataCollection.last24h}</div>
            <p className="text-xs text-muted-foreground">
              {automation.dataCollection.ratePerHour.toFixed(1)}/hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready for Training</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{readiness.stats.totalTrajectories}</div>
            <p className="text-xs text-muted-foreground">
              {readiness.stats.scenarioGroups} scenario groups
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Model</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{automation.models.latest || 'None'}</div>
            <p className="text-xs text-muted-foreground">
              {automation.models.deployed} deployed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(readiness.stats.dataQuality * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {readiness.ready ? '✅ Ready' : '⏳ Collecting'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Training Readiness */}
      <Card>
        <CardHeader>
          <CardTitle>Training Readiness</CardTitle>
          <CardDescription>
            {readiness.ready ? '✅ Ready to train!' : `⏳ ${readiness.reason}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Trajectories:</span>
              <Badge variant={readiness.stats.totalTrajectories >= 100 ? 'default' : 'secondary'}>
                {readiness.stats.totalTrajectories} / 100
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Scenario Groups:</span>
              <Badge variant={readiness.stats.scenarioGroups >= 10 ? 'default' : 'secondary'}>
                {readiness.stats.scenarioGroups} / 10
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Data Quality:</span>
              <Badge variant={readiness.stats.dataQuality >= 0.95 ? 'default' : 'secondary'}>
                {(readiness.stats.dataQuality * 100).toFixed(1)}% / 95%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Training Status */}
      {automation.training.currentJob && (
        <Card>
          <CardHeader>
            <CardTitle>Training In Progress</CardTitle>
            <CardDescription>Job ID: {automation.training.currentJob}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: '50%' }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                ETA: ~30 minutes
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Training Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {status.recentJobs.map((job: TrainingJob) => (
              <div key={job.id} className="flex justify-between items-center p-2 border rounded">
                <div>
                  <div className="font-medium">{job.modelVersion}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString()}
                  </div>
                </div>
                <Badge variant={
                  job.status === 'completed' ? 'default' :
                  job.status === 'training' ? 'secondary' :
                  job.status === 'failed' ? 'destructive' :
                  'outline'
                }>
                  {job.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Database:</span>
              <Badge variant={automation.health.database ? 'default' : 'destructive'}>
                {automation.health.database ? '✅ Healthy' : '❌ Error'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Storage:</span>
              <Badge variant={automation.health.storage ? 'default' : 'destructive'}>
                {automation.health.storage ? '✅ Healthy' : '❌ Error'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>W&B:</span>
              <Badge variant={automation.health.wandb ? 'default' : 'secondary'}>
                {automation.health.wandb ? '✅ Connected' : '⚠️ Not configured'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

