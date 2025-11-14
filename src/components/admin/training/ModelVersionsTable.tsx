/**
 * Model Versions Table
 * 
 * Lists all trained model versions with performance metrics and deployment status.
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlayCircle, RotateCcw, TrendingUp } from 'lucide-react';

interface ModelVersion {
  version: string;
  baseModel: string;
  trainedAt: Date;
  accuracy?: number;
  avgReward?: number;
  status: string;
  agentsUsing: number;
  blobUrl: string;
}

export function ModelVersionsTable() {
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModels();
  }, []);

  async function loadModels() {
    try {
      const res = await fetch('/api/admin/training/models');
      const data = await res.json();
      setModels(data.models || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load models:', error);
      setLoading(false);
    }
  }

  async function deployModel(version: string) {
    if (!confirm(`Deploy ${version} to all agents?`)) return;

    try {
      const res = await fetch('/api/admin/training/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelVersion: version, strategy: 'gradual' })
      });

      if (res.ok) {
        alert('Model deployment started!');
        await loadModels();
      }
    } catch (error) {
      alert(`Deployment failed: ${error}`);
    }
  }

  async function rollbackTo(version: string) {
    if (!confirm(`Rollback to ${version}?`)) return;

    try {
      const res = await fetch('/api/admin/training/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetVersion: version })
      });

      if (res.ok) {
        alert('Rollback initiated!');
        await loadModels();
      }
    } catch (error) {
      alert(`Rollback failed: ${error}`);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Versions</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Versions</CardTitle>
        <CardDescription>All trained models with performance metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Base Model</TableHead>
              <TableHead>Avg Reward</TableHead>
              <TableHead>Accuracy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Agents</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.version}>
                <TableCell className="font-medium">{model.version}</TableCell>
                <TableCell>{model.baseModel}</TableCell>
                <TableCell>
                  {model.avgReward ? (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-green-500" />
                      {model.avgReward.toFixed(2)}
                    </div>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {model.accuracy ? `${(model.accuracy * 100).toFixed(1)}%` : '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={
                    model.status === 'deployed' ? 'default' :
                    model.status === 'ready' ? 'secondary' :
                    model.status === 'training' ? 'outline' :
                    'destructive'
                  }>
                    {model.status}
                  </Badge>
                </TableCell>
                <TableCell>{model.agentsUsing}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {model.status === 'ready' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deployModel(model.version)}
                      >
                        <PlayCircle className="w-3 h-3 mr-1" />
                        Deploy
                      </Button>
                    )}
                    {model.status !== 'deployed' && models.some(m => m.status === 'deployed') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rollbackTo(model.version)}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Rollback
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

