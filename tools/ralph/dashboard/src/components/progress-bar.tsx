import Link from 'next/link'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  label: string
  value: number
  max: number
  className?: string
  href?: string
}

export function ProgressBar({ label, value, max, className, href }: ProgressBarProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0

  const content = (
    <div className={cn('space-y-2', href && 'cursor-pointer hover:opacity-80 transition-opacity', className)}>
      <div className="flex justify-between text-sm">
        <span className={cn('font-medium', href && 'cyber-dark:hover:text-yellow-400')}>{label}</span>
        <span className="text-muted-foreground">{value}/{max} ({percentage}%)</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
