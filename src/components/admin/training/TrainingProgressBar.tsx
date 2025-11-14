/**
 * Training Progress Component
 * 
 * Shows current training job progress with real-time updates.
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface TrainingJob {
  batchId: string;
  status: string;
  progress: number;
  currentEpoch?: number;
  totalEpochs?: number;
  loss?: number;
  eta?: number;
}

export function TrainingProgressBar() {
  const [job, setJob] = useState<TrainingJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
    const interval = setInterval(loadProgress, 5000); // Update every 5s
    return () => clearInterval(interval);
  }, []);

  async function loadProgress() {
    try {
      const res = await fetch('/api/admin/training/status');
      const data = await res.json();
      
      if (data.automation?.training?.currentJob) {
        setJob({
          batchId: data.automation.training.currentJob,
          status: 'training',
          progress: 0.5, // Would come from TrainingMonitor
          eta: 1800000 // 30 min estimate
        });
      } else {
        setJob(null);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to load training progress:', error);
      setLoading(false);
    }
  }

  if (loading) return null;
  if (!job) return null;

  const progressPercent = (job.progress || 0) * 100;
  const etaMinutes = job.eta ? Math.ceil(job.eta / 60000) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Training in Progress
        </CardTitle>
        <CardDescription>Job ID: {job.batchId}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Progress: {progressPercent.toFixed(0)}%</span>
            <span>ETA: ~{etaMinutes} min</span>
          </div>
          <Progress value={progressPercent} />
        </div>

        <div className="flex gap-2">
          <Badge>{job.status}</Badge>
          {job.currentEpoch && (
            <Badge variant="outline">
              Epoch {job.currentEpoch}/{job.totalEpochs || '?'}
            </Badge>
          )}
          {job.loss && (
            <Badge variant="outline">
              Loss: {job.loss.toFixed(4)}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

