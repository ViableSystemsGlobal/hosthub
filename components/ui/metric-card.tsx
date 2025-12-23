'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  trend?: {
    value: number
    period: string
    isPositive?: boolean
  }
  chart?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function MetricCard({
  title,
  value,
  icon,
  trend,
  chart,
  className,
  style,
}: MetricCardProps) {
  const formatValue = (val: number | string): string => {
    // If it's already a formatted string (like currency), return as is
    if (typeof val === 'string') {
      return val
    }
    // If it's not a number (e.g., object), return 0
    if (typeof val !== 'number' || isNaN(val)) {
      return '0'
    }
    // For integers (counts), don't show decimals
    if (Number.isInteger(val)) {
      return val.toLocaleString('en-US')
    }
    // Otherwise format as number with 2 decimal places
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const formatTrendValue = (val: number): string => {
    const absVal = Math.abs(val)
    if (absVal >= 1000000) {
      return `$${(absVal / 1000000).toFixed(2)}M`
    }
    if (absVal >= 1000) {
      return `$${(absVal / 1000).toFixed(2)}K`
    }
    return `$${absVal.toFixed(2)}`
  }

  const getTrendIcon = () => {
    if (!trend) return null
    if (trend.value === 0) {
      return <Minus className="w-4 h-4" />
    }
    return trend.isPositive ? (
      <TrendingUp className="w-4 h-4" />
    ) : (
      <TrendingDown className="w-4 h-4" />
    )
  }

  const getTrendColor = () => {
    if (!trend) return 'text-gray-600'
    if (trend.value === 0) return 'text-gray-600'
    return trend.isPositive ? 'text-green-600' : 'text-red-600'
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="relative">
        {chart && (
          <div className="absolute inset-0 top-8 bottom-0 opacity-20">
            {chart}
          </div>
        )}
        <div className="relative z-10">
          <div className="text-2xl font-bold" style={style}>{formatValue(value)}</div>
          {trend && (
            <div className="flex items-center gap-1 mt-2 text-xs">
              <span className="text-muted-foreground">{trend.period}</span>
              <div className={cn('flex items-center gap-1', getTrendColor())}>
                {getTrendIcon()}
                <span>{formatTrendValue(trend.value)}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

