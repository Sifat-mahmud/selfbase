'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Keyboard } from 'lucide-react'

interface KeyboardShortcutsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const shortcuts = [
  { keys: ['⌘', 'K'], description: 'Open Command Palette' },
  { keys: ['⌘', 'B'], description: 'Toggle Sidebar' },
  { keys: ['⌘', '1–9'], description: 'Switch to section 1–9' },
  { keys: ['⌘', '/'], description: 'Show keyboard shortcuts' },
  { keys: ['Esc'], description: 'Close dialog / palette' },
]

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-md bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-1.5">
              <Keyboard className="h-4 w-4 text-emerald-600" />
            </div>
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Quick shortcuts to navigate and control SelfBase Admin Studio
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm text-foreground">{shortcut.description}</span>
              <div className="flex items-center gap-0.5">
                {shortcut.keys.map((key, i) => (
                  <kbd
                    key={i}
                    className="pointer-events-none inline-flex h-6 min-w-[24px] select-none items-center justify-center rounded-md border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-md bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-800/30 p-3">
          <p className="text-xs text-muted-foreground">
            On Windows and Linux, use <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">Ctrl</kbd> instead of <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">⌘</kbd>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
