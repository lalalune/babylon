/**
 * Data Collection Chart
 * 
 * Shows trajectory collection rate over time.
 * Updates in real-time as agents collect data.
 */

'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DataPoint {
  hour: string;
  trajectories: number;
  avgReward: number;
}

export function DataCollectionChart() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const res = await fetch('/api/admin/training/data-stats');
    if (!res.ok) {
      console.error('Failed to load chart data:', res.statusText);
      setLoading(false);
      return;
    }
    const stats = await res.json();
    setData(stats.hourlyData || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Collection</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Collection Rate</CardTitle>
        <CardDescription>Trajectories collected per hour (last 24h)</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="trajectories" 
              stroke="#8884d8" 
              strokeWidth={2}
              name="Trajectories"
            />
            <Line 
              type="monotone" 
              dataKey="avgReward" 
              stroke="#82ca9d" 
              strokeWidth={2}
              name="Avg Reward"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}


