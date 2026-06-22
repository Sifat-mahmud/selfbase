'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Toggle theme">
        <Sun className="h-3.5 w-3.5" />
      </Button>
    )
  }

  const isDark = theme === 'dark'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 relative overflow-hidden"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Sun
            className={`h-3.5 w-3.5 transition-all duration-300 ${
              isDark ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
            }`}
          />
          <Moon
            className={`absolute h-3.5 w-3.5 transition-all duration-300 ${
              isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'
            }`}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{isDark ? 'Light mode' : 'Dark mode'}</p>
      </TooltipContent>
    </Tooltip>
  )
}
