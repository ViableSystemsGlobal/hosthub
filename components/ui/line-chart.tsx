'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface LineChartProps {
  data: Array<{ label: string; value: number }>
  data2?: Array<{ label: string; value: number }> // For comparison line
  height?: number
  showGrid?: boolean
  showLabels?: boolean
  color?: string
  color2?: string
  className?: string
}

export function LineChart({
  data,
  data2,
  height = 200,
  showGrid = true,
  showLabels = true,
  color = '#3b82f6',
  color2 = '#10b981',
  className,
}: LineChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null

    const allValues = [
      ...data.map((d) => d.value),
      ...(data2 || []).map((d) => d.value),
    ]
    const max = Math.max(...allValues, 0)
    const min = Math.min(...allValues, 0)
    const range = max - min || 1

    return {
      data1: data.map((point) => ({
        ...point,
        normalized: ((point.value - min) / range) * 100,
      })),
      data2: data2
        ? data2.map((point) => ({
            ...point,
            normalized: ((point.value - min) / range) * 100,
          }))
        : null,
      max,
      min,
    }
  }, [data, data2])

  if (!chartData || chartData.data1.length === 0) {
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
  const paddingTop = 20
  const paddingBottom = 40
  const innerWidth = viewBoxWidth - paddingLeft - paddingRight
  const innerHeight = viewBoxHeight - paddingTop - paddingBottom

  const points1 = chartData.data1
    .map((point, index) => {
      const x = paddingLeft + (index / (chartData.data1.length - 1 || 1)) * innerWidth
      const y = paddingTop + innerHeight - (point.normalized / 100) * innerHeight
      return { x, y, ...point }
    })
    .filter((p) => !isNaN(p.x) && !isNaN(p.y))

  const points2 = chartData.data2
    ? chartData.data2
        .map((point, index) => {
          const x = paddingLeft + (index / (chartData.data2!.length - 1 || 1)) * innerWidth
          const y = paddingTop + innerHeight - (point.normalized / 100) * innerHeight
          return { x, y, ...point }
        })
        .filter((p) => !isNaN(p.x) && !isNaN(p.y))
    : null

  const path1 = points1
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  const path2 = points2
    ? points2.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : null

  const areaPath1 = `M ${points1[0]?.x || 0} ${paddingTop + innerHeight} ${path1} L ${points1[points1.length - 1]?.x || 0} ${paddingTop + innerHeight} Z`

  // Show only a subset of labels to prevent overlap
  const labelInterval = Math.ceil(chartData.data1.length / 7)

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

        {/* Area fill for data1 */}
        <path
          d={areaPath1}
          fill={color}
          fillOpacity="0.1"
          className="transition-opacity"
        />

        {/* Line for data1 */}
        <path
          d={path1}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Line for data2 (comparison) */}
        {path2 && (
          <path
            d={path2}
            fill="none"
            stroke={color2}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6,6"
          />
        )}

        {/* Data points */}
        {points1.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={color}
            className="transition-all"
          />
        ))}

        {points2 &&
          points2.map((point, index) => (
            <circle
              key={`2-${index}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={color2}
              className="transition-all"
            />
          ))}

        {/* Labels */}
        {showLabels && (
          <g>
            {chartData.data1.map((point, index) => {
              if (index % labelInterval !== 0 && index !== chartData.data1.length - 1) return null
              const pointData = points1[index]
              if (!pointData) return null
              return (
                <text
                  key={index}
                  x={pointData.x}
                  y={viewBoxHeight - 10}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#6b7280"
                  fontFamily="system-ui, sans-serif"
                >
                  {point.label}
                </text>
              )
            })}
          </g>
        )}
      </svg>
    </div>
  )
}
