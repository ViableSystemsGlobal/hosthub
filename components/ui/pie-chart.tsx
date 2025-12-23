'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface PieChartProps {
  data: Array<{ label: string; value: number; color?: string }>
  height?: number
  showLabels?: boolean
  className?: string
}

const DEFAULT_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
]

export function PieChart({
  data,
  height = 200,
  showLabels = true,
  className,
}: PieChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null

    const total = data.reduce((sum, item) => sum + item.value, 0)
    if (total === 0) return null

    let currentAngle = -90 // Start at top
    const segments = data.map((item, index) => {
      const percentage = (item.value / total) * 100
      const angle = (item.value / total) * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + angle
      currentAngle = endAngle

      return {
        ...item,
        percentage,
        angle,
        startAngle,
        endAngle,
        color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      }
    })

    return { segments, total }
  }, [data])

  if (!chartData || chartData.segments.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center', className)}
        style={{ height }}
      >
        <div className="text-sm text-muted-foreground">No data available</div>
      </div>
    )
  }

  const viewBoxSize = 200
  const centerX = viewBoxSize / 2
  const centerY = viewBoxSize / 2
  const radius = 70

  const getArcPath = (startAngle: number, endAngle: number) => {
    const start = (startAngle * Math.PI) / 180
    const end = (endAngle * Math.PI) / 180
    const x1 = centerX + radius * Math.cos(start)
    const y1 = centerY + radius * Math.sin(start)
    const x2 = centerX + radius * Math.cos(end)
    const y2 = centerY + radius * Math.sin(end)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0

    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <div className="flex flex-col items-center">
        <svg
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-48 h-48"
        >
          {/* Segments */}
          {chartData.segments.map((segment, index) => (
            <path
              key={index}
              d={getArcPath(segment.startAngle, segment.endAngle)}
              fill={segment.color}
              className="transition-opacity hover:opacity-80"
            />
          ))}

          {/* Center circle for donut effect */}
          <circle cx={centerX} cy={centerY} r="35" fill="white" />
        </svg>

        {/* Legend */}
        {showLabels && (
          <div className="mt-4 flex flex-wrap gap-3 justify-center max-w-full">
            {chartData.segments.map((segment, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-xs text-gray-600 whitespace-nowrap">
                  {segment.label.length > 12 ? segment.label.substring(0, 12) + '...' : segment.label} ({segment.percentage.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
