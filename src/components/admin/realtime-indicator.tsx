'use client'

import { useState } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type Status = 'live' | 'connecting' | 'offline'

export function RealtimeIndicator() {
  const { connected, loadScore, activeConnections } = useRealtime()

  // Track "ever connected" using the recommended "adjust state during render"
  // pattern from the React docs. This avoids both refs-during-render and
  // setState-in-effect cascading renders.
  const [prevConnected, setPrevConnected] = useState(false)
  const [everConnected, setEverConnected] = useState(false)
  if (connected !== prevConnected) {
    setPrevConnected(connected)
    if (connected) setEverConnected(true)
  }

  // Derive status: until first successful connection, show "connecting";
  // once connected, show "live"; if connection drops after connecting, show "offline".
  const status: Status = connected ? 'live' : everConnected ? 'offline' : 'connecting'

  const palette = {
    live: {
      dot: 'bg-emerald-500',
      ring: 'bg-emerald-500/15',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      bg: 'bg-emerald-50',
      label: 'Live',
      pulse: true,
    },
    connecting: {
      dot: 'bg-amber-500',
      ring: 'bg-amber-500/15',
      text: 'text-amber-700',
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      label: 'Connecting...',
      pulse: false,
    },
    offline: {
      dot: 'bg-red-500',
      ring: 'bg-red-500/15',
      text: 'text-red-700',
      border: 'border-red-200',
      bg: 'bg-red-50',
      label: 'Offline',
      pulse: false,
    },
  }[status]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
            palette.bg,
            palette.border,
            palette.text,
            'hover:opacity-90',
          )}
          aria-label={`Realtime status: ${palette.label}`}
        >
          <span className="relative flex h-2 w-2 items-center justify-center">
            <span
              className={cn(
                'absolute inline-flex h-2 w-2 rounded-full',
                palette.ring,
                palette.pulse && 'animate-ping',
              )}
            />
            <span className={cn('relative inline-flex h-2 w-2 rounded-full', palette.dot)} />
          </span>
          <span className="hidden sm:inline">{palette.label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="px-3 py-2 text-xs">
        <div className="flex min-w-[160px] flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-primary-foreground/70">Status</span>
            <span className="font-medium">{palette.label}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-primary-foreground/70">Active connections</span>
            <span className="font-medium">{activeConnections}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-primary-foreground/70">Load score</span>
            <span className="font-medium">{loadScore.toFixed(2)}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
