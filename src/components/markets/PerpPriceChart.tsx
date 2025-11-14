'use client';

import { useState } from 'react';
import { XAxis, YAxis, CartesianGrid, Area, AreaChart, ReferenceLine, Brush } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface PricePoint {
  time: number;
  price: number;
}

interface PerpPriceChartProps {
  data: PricePoint[];
  currentPrice: number;
  ticker: string;
  showBrush?: boolean;
}

type TimeRange = '1H' | '4H' | '1D' | '1W' | 'ALL';

const chartConfig = {
  price: {
    label: "Price",
    color: "hsl(var(--chart-1))",
  },
  priceUp: {
    label: "Price Up",
    color: "#16a34a",
  },
  priceDown: {
    label: "Price Down",
    color: "#dc2626",
  },
} satisfies ChartConfig;

export function PerpPriceChart({ data, currentPrice, ticker, showBrush = true }: PerpPriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
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

  // Format data for recharts
  const allChartData = data.map(point => ({
    timestamp: point.time,
    price: point.price,
    date: new Date(point.time).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));

  // Filter data based on time range
  const getFilteredData = () => {
    if (timeRange === 'ALL' || allChartData.length === 0) return allChartData;
    
    const now = Date.now();
    const ranges: Record<TimeRange, number> = {
      '1H': 60 * 60 * 1000,
      '4H': 4 * 60 * 60 * 1000,
      '1D': 24 * 60 * 60 * 1000,
      '1W': 7 * 24 * 60 * 60 * 1000,
      'ALL': 0,
    };
    
    const cutoff = now - ranges[timeRange];
    return allChartData.filter(d => d.timestamp >= cutoff);
  };

  const chartData = getFilteredData();

  // Determine if the price is going up or down for color
  const isPositive = (chartData[chartData.length - 1]?.price ?? 0) >= (chartData[0]?.price ?? 0);
  const priceColor = isPositive ? 'var(--color-priceUp)' : 'var(--color-priceDown)';
  
  // Calculate price change
  const priceChange = chartData.length > 1 
    ? ((chartData[chartData.length - 1]?.price ?? 0) - (chartData[0]?.price ?? 0))
    : 0;
  const priceChangePercent = chartData.length > 1 && chartData[0]?.price
    ? (priceChange / chartData[0].price) * 100
    : 0;

  // Format value for display
  const formatValue = (value: number, includeSymbol: boolean = false): string => {
    const prefix = includeSymbol ? '$' : '';
    
    if (value === 0) return '';
    if (value >= 1000000000) return `${prefix}${(value / 1000000000).toFixed(2)}B`;
    if (value >= 1000000) return `${prefix}${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${prefix}${(value / 1000).toFixed(2)}K`;
    if (value >= 1) return `${prefix}${value.toFixed(2)}`;
    if (value >= 0.01) return `${prefix}${value.toFixed(4)}`;
    if (value >= 0.0001) return `${prefix}${value.toFixed(6)}`;
    return `${prefix}${value.toFixed(8)}`;
  };

  const formatYAxisValue = (value: number): string => formatValue(value, true);

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
  
  const handleResetZoom = () => {
    setZoomDomain(undefined);
  };

  const timeRangeButtons: TimeRange[] = ['1H', '4H', '1D', '1W', 'ALL'];

  return (
    <div className="w-full space-y-2">
      {/* Price info and controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-2xl font-bold">{formatValue(currentPrice, true)}</div>
            <div className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '↑' : '↓'} {formatValue(Math.abs(priceChange), true)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="flex items-center gap-1 bg-muted/30 rounded-md p-1">
            {timeRangeButtons.map((range) => (
              <button
                key={range}
                onClick={() => {
                  setTimeRange(range);
                  setZoomDomain(undefined);
                }}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  timeRange === range
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          
          {zoomDomain && (
            <button
              onClick={handleResetZoom}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
            >
              Reset Zoom
            </button>
          )}
        </div>
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
              <linearGradient id={`fillPrice-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={priceColor}
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor={priceColor}
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
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
                // Show different format based on time range
                if (timeRange === '1H' || timeRange === '4H') {
                  return d.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                }
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
              tickFormatter={formatYAxisValue}
              domain={['auto', 'auto']}
            />
            <ChartTooltip
              cursor={{ stroke: priceColor, strokeWidth: 1, strokeDasharray: '4 4' }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  className="min-w-[200px] px-3 py-2"
                  labelFormatter={(_, items) => {
                    const first = Array.isArray(items) && items.length > 0 ? items[0] : undefined;
                    const p = first && typeof first === 'object' && 'payload' in first ? (first.payload as { date?: string }) : undefined;
                    return p?.date ?? '';
                  }}
                  formatter={(value) => {
                    if (typeof value !== 'number') return value;
                    return formatValue(value, true);
                  }}
                />
              }
            />
            <Area
              dataKey="price"
              type="monotone"
              fill={`url(#fillPrice-${ticker})`}
              fillOpacity={0.4}
              stroke={priceColor}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <ReferenceLine
              y={currentPrice}
              stroke="#0066FF"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: formatValue(currentPrice, true),
                position: 'insideTopLeft',
                fill: '#0066FF',
                fontSize: 12,
                fontWeight: 'bold',
              }}
            />
            
            {showBrush && chartData.length > 10 && (
              <Brush
                dataKey="timestamp"
                height={20}
                stroke={priceColor}
                fill="hsl(var(--muted))"
                onChange={(e: { startIndex?: number; endIndex?: number }) => {
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

