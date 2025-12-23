'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface BarChartProps {
  data: Array<{ label: string; value: number }>
  height?: number
  showGrid?: boolean
  showLabels?: boolean
  color?: string
  className?: string
}

export function BarChart({
  data,
  height = 200,
  showGrid = true,
  showLabels = true,
  color = '#3b82f6',
  className,
}: BarChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null

    const max = Math.max(...data.map((d) => d.value), 0)
    const min = Math.min(...data.map((d) => d.value), 0)
    const range = max - min || 1

    return {
      bars: data.map((point) => ({
        ...point,
        normalized: max > 0 ? (point.value / max) * 100 : 0,
      })),
      max,
      min,
    }
  }, [data])

  if (!chartData || chartData.bars.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center', className)}
        style={{ height }}
      >
        <div className="text-sm text-muted-foreground">No data available</div>
      </div>
    )
  }

  // Use larger viewBox for better text rendering
  const viewBoxWidth = 400
  const viewBoxHeight = 200
  const paddingLeft = 10
  const paddingRight = 10
  const paddingTop = 30
  const paddingBottom = 40
  const innerWidth = viewBoxWidth - paddingLeft - paddingRight
  const innerHeight = viewBoxHeight - paddingTop - paddingBottom
  const barWidth = (innerWidth / chartData.bars.length) * 0.6
  const barSpacing = innerWidth / chartData.bars.length

  // Show only a subset of labels to prevent overlap
  const labelInterval = Math.ceil(chartData.bars.length / 10)

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {/* Grid lines */}
        {showGrid && (
          <g>
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1={paddingLeft}
                y1={paddingTop + (y / 100) * innerHeight}
                x2={paddingLeft + innerWidth}
                y2={paddingTop + (y / 100) * innerHeight}
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            ))}
          </g>
        )}

        {/* Bars */}
        {chartData.bars.map((bar, index) => {
          const x = paddingLeft + index * barSpacing + (barSpacing - barWidth) / 2
          const barHeight = (bar.normalized / 100) * innerHeight
          const y = paddingTop + innerHeight - barHeight

          return (
            <g key={index}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                fill={color}
                fillOpacity="0.8"
                rx="2"
                className="transition-all hover:opacity-100"
              />
              {/* Value label on top of bar */}
              {bar.value > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#374151"
                  fontWeight="500"
                  fontFamily="system-ui, sans-serif"
                >
                  {bar.value >= 1000 ? `${(bar.value / 1000).toFixed(1)}k` : bar.value.toLocaleString()}
                </text>
              )}
            </g>
          )
        })}

        {/* Labels */}
        {showLabels && (
          <g>
            {chartData.bars.map((bar, index) => {
              if (index % labelInterval !== 0 && index !== chartData.bars.length - 1) return null
              const x = paddingLeft + index * barSpacing + barSpacing / 2
              return (
                <text
                  key={index}
                  x={x}
                  y={viewBoxHeight - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#6b7280"
                  fontFamily="system-ui, sans-serif"
                >
                  {bar.label.length > 8 ? bar.label.substring(0, 8) + '...' : bar.label}
                </text>
              )
            })}
          </g>
        )}
      </svg>
    </div>
  )
}
