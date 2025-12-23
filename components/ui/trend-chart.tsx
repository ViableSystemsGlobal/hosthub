'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface TrendChartProps {
  data: number[]
  isPositive?: boolean
  className?: string
}

export function TrendChart({ data, isPositive, className }: TrendChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null

    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1

    return data.map((value) => ({
      value,
      normalized: ((value - min) / range) * 100,
    }))
  }, [data])

  if (!chartData || chartData.length === 0) {
    return (
      <div className={cn('h-full flex items-center justify-center', className)}>
        <div className="text-xs text-muted-foreground">No data</div>
      </div>
    )
  }

  const points = chartData
    .map((point, index) => {
      const x = (index / (chartData.length - 1)) * 100
      const y = 100 - point.normalized
      return `${x},${y}`
    })
    .join(' ')

  const areaPoints = `0,100 ${points} 100,100`

  const lineColor = isPositive ? '#10b981' : '#ef4444'
  const areaColor = isPositive
    ? 'rgba(16, 185, 129, 0.1)'
    : 'rgba(239, 68, 68, 0.1)'

  return (
    <div className={cn('h-full w-full', className)}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {/* Area fill */}
        <polygon
          points={areaPoints}
          fill={areaColor}
          className="transition-opacity"
        />
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

