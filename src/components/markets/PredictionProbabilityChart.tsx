'use client';

import { useState } from 'react';
import { XAxis, YAxis, CartesianGrid, Area, AreaChart, ReferenceLine, ReferenceArea, Brush } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface PricePoint {
  time: number;
  yesPrice: number;
  noPrice: number;
  volume: number;
}

interface PredictionProbabilityChartProps {
  data: PricePoint[];
  marketId: string;
  showBrush?: boolean;
}

const chartConfig = {
  probability: {
    label: "YES Probability",
    color: "#16a34a",
  },
  noProbability: {
    label: "NO Probability",
    color: "#dc2626",
  },
} satisfies ChartConfig;

export function PredictionProbabilityChart({ data, marketId, showBrush = false }: PredictionProbabilityChartProps) {
  const [zoomDomain, setZoomDomain] = useState<[number, number] | undefined>(undefined);

  if (data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="text-sm">Loading chart data...</div>
        </div>
      </div>
    );
  }

  // Format data for recharts - convert to percentages
  // Include both YES and NO for better visualization
  const chartData = data.map(point => ({
    timestamp: point.time,
    probability: point.yesPrice * 100,
    noProbability: point.noPrice * 100,
    volume: point.volume,
    date: new Date(point.time).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
    }),
  }));

  const getEvenlySpacedTimeTicks = (count: number): number[] => {
    if (chartData.length === 0) return [];
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    if (!first || !last) return [];
    const min = first.timestamp;
    const max = last.timestamp;
    if (count <= 1 || min === max) return [min];
    const step = (max - min) / (count - 1);
    return Array.from({ length: count }, (_, i) => Math.round(min + i * step));
  };

  // Determine color based on current probability
  const currentProbability = chartData[chartData.length - 1]?.probability ?? 50;
  const isYesFavored = currentProbability >= 50;
  const lineColor = isYesFavored ? '#16a34a' : '#dc2626'; // Green if YES favored, red if NO favored
  
  // Reset zoom handler
  const handleResetZoom = () => {
    setZoomDomain(undefined);
  };

  return (
    <div className="w-full space-y-2">
      {/* Outcome indicator */}
      <div className="flex items-center justify-between px-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-600"></div>
            <span className="text-sm font-medium">YES {currentProbability.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <span className="text-sm font-medium">NO {(100 - currentProbability).toFixed(1)}%</span>
          </div>
        </div>
        {zoomDomain && (
          <button
            onClick={handleResetZoom}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset Zoom
          </button>
        )}
      </div>
      
      <div className="bg-muted/20 rounded-lg p-3">
        <ChartContainer config={chartConfig} className="aspect-auto h-[400px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
              top: 12,
              bottom: showBrush ? 32 : 12,
            }}
          >
            <defs>
              <linearGradient id={`fillProbability-${marketId}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={lineColor}
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor={lineColor}
                  stopOpacity={0.1}
                />
              </linearGradient>
              {/* YES zone gradient (green, top half) */}
              <linearGradient id={`yesZone-${marketId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
              </linearGradient>
              {/* NO zone gradient (red, bottom half) */}
              <linearGradient id={`noZone-${marketId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dc2626" stopOpacity={0.02} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            
            {/* Background zones for YES (>50%) and NO (<50%) */}
            <ReferenceArea y1={50} y2={100} fill={`url(#yesZone-${marketId})`} fillOpacity={1} />
            <ReferenceArea y1={0} y2={50} fill={`url(#noZone-${marketId})`} fillOpacity={1} />
            
            <CartesianGrid
              horizontal={true}
              vertical={false}
              strokeDasharray="8 8"
              strokeWidth={1}
              stroke="hsl(var(--muted-foreground))"
              opacity={0.2}
            />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={zoomDomain || ['dataMin', 'dataMax']}
              ticks={getEvenlySpacedTimeTicks(6)}
              tickFormatter={(ts) => {
                const d = new Date(ts);
                return d.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
              }}
              interval={0}
              tickLine={false}
              tickMargin={12}
              strokeWidth={1.5}
              className="text-xs fill-muted-foreground"
            />
            <YAxis
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={0}
              tickCount={6}
              className="text-xs fill-muted-foreground"
              tickFormatter={(value) => `${value.toFixed(0)}%`}
              domain={[0, 100]}
            />
            <ChartTooltip
              cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '4 4' }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  className="min-w-[200px] px-3 py-2"
                  labelFormatter={(_, items) => {
                    const first = Array.isArray(items) && items.length > 0 ? items[0] : undefined;
                    const p = first && typeof first === 'object' && 'payload' in first ? (first.payload as { date?: string }) : undefined;
                    return p?.date ?? '';
                  }}
                  formatter={(value, name) => {
                    if (typeof value !== 'number') return value;
                    const displayName = name === 'probability' ? 'YES' : 'NO';
                    const color = name === 'probability' ? '#16a34a' : '#dc2626';
                    return (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
                        <span>{displayName}: {value.toFixed(1)}%</span>
                      </div>
                    );
                  }}
                />
              }
            />
            
            {/* 50% reference line */}
            <ReferenceLine
              y={50}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeWidth={2}
              strokeOpacity={0.6}
              label={{
                value: '50% Line',
                position: 'insideTopRight',
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 11,
                fontWeight: 'bold',
              }}
            />
            
            <Area
              dataKey="probability"
              type="monotone"
              fill={`url(#fillProbability-${marketId})`}
              fillOpacity={0.4}
              stroke={lineColor}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            
            {showBrush && (
              <Brush
                dataKey="timestamp"
                height={20}
                stroke={lineColor}
                fill="hsl(var(--muted))"
                onChange={(e) => {
                  if (e.startIndex !== undefined && e.endIndex !== undefined) {
                    const start = chartData[e.startIndex]?.timestamp;
                    const end = chartData[e.endIndex]?.timestamp;
                    if (start && end) {
                      setZoomDomain([start, end]);
                    }
                  }
                }}
              />
            )}
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
}

