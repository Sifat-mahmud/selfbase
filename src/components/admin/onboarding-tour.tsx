'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Database,
  GitBranch,
  Brain,
  Rocket,
  ChevronRight,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type AdminSection } from '@/stores/admin-store'

const STORAGE_KEY = 'selfbase_onboarding_done'

interface TourStep {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  gradient: string
  bgGradient: string
}

const steps: TourStep[] = [
  {
    title: 'Welcome to SelfBase!',
    description:
      'Your self-hosted, local-first, AI-native Backend-as-a-Service platform. Manage data, build pipelines, and leverage AI — all from one dashboard.',
    icon: Sparkles,
    gradient: 'from-emerald-400 to-teal-500',
    bgGradient: 'from-emerald-500/10 via-teal-500/10 to-emerald-500/5',
  },
  {
    title: 'Your Data Hub',
    description:
      'Create tables, define schemas, and manage your data with a powerful visual editor. Import and export data with ease, browse rows, and edit inline.',
    icon: Database,
    gradient: 'from-emerald-500 to-emerald-600',
    bgGradient: 'from-emerald-500/10 via-emerald-600/5 to-emerald-500/10',
  },
  {
    title: 'Data Pipelines',
    description:
      'Connect to external data sources, scrape websites, and automate data ingestion. Build pipelines that keep your database fresh and up-to-date.',
    icon: GitBranch,
    gradient: 'from-teal-500 to-teal-600',
    bgGradient: 'from-teal-500/10 via-teal-600/5 to-teal-500/10',
  },
  {
    title: 'AI-Powered',
    description:
      'Leverage RAG chat, semantic search, embeddings, and multiple LLM providers. Let AI understand your data and help you make smarter decisions.',
    icon: Brain,
    gradient: 'from-teal-400 to-emerald-500',
    bgGradient: 'from-teal-500/10 via-emerald-500/5 to-teal-500/10',
  },
  {
    title: 'Get Started!',
    description:
      'You\'re all set! Create your first table, set up a pipeline, or explore the AI features. Click below to jump right in.',
    icon: Rocket,
    gradient: 'from-emerald-500 to-teal-400',
    bgGradient: 'from-emerald-500/10 via-teal-400/5 to-emerald-500/10',
  },
]

interface OnboardingTourProps {
  onComplete: (navigateTo?: AdminSection) => void
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [open, setOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY)
      if (!done) {
        // Small delay so the page renders first
        const timer = setTimeout(() => setOpen(true), 600)
        return () => clearTimeout(timer)
      }
    } catch {
      // localStorage may not be available
    }
  }, [])

  function handleSkip() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore
    }
    setOpen(false)
    onComplete()
  }

  function handleNext() {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      // Final step — complete
      try {
        localStorage.setItem(STORAGE_KEY, '1')
      } catch {
        // ignore
      }
      setOpen(false)
      onComplete('tables')
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1)
    }
  }

  function handleQuickAction(section: AdminSection) {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore
    }
    setOpen(false)
    onComplete(section)
  }

  const step = steps[currentStep]
  const StepIcon = step.icon
  const isLast = currentStep === steps.length - 1

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {/* Close button */}
            <button
              type="button"
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              onClick={handleSkip}
              aria-label="Skip tour"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Top gradient area with icon */}
            <div className={`relative bg-gradient-to-br ${step.bgGradient} px-8 pt-8 pb-6`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col items-center text-center"
                >
                  <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${step.gradient} text-white shadow-lg`}>
                    <StepIcon className="h-8 w-8" />
                  </div>
                  <h2 className={`text-2xl font-bold bg-gradient-to-r ${step.gradient} bg-clip-text text-transparent`}>
                    {step.title}
                  </h2>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Content area */}
            <div className="px-8 py-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-center text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>

                  {/* Quick actions on last step */}
                  {isLast && (
                    <div className="mt-5 flex flex-col gap-2">
                      <button
                        type="button"
                        className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-500/5 px-4 py-3 text-left transition-colors hover:bg-emerald-500/10 dark:border-emerald-800"
                        onClick={() => handleQuickAction('tables')}
                      >
                        <Database className="h-5 w-5 text-emerald-600 shrink-0" />
                        <div>
                          <div className="text-sm font-medium">Create Your First Table</div>
                          <div className="text-xs text-muted-foreground">Define a schema and start storing data</div>
                        </div>
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-500/5 px-4 py-3 text-left transition-colors hover:bg-teal-500/10 dark:border-teal-800"
                        onClick={() => handleQuickAction('pipeline')}
                      >
                        <GitBranch className="h-5 w-5 text-teal-600 shrink-0" />
                        <div>
                          <div className="text-sm font-medium">Set Up a Pipeline</div>
                          <div className="text-xs text-muted-foreground">Connect to external data sources</div>
                        </div>
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-500/5 px-4 py-3 text-left transition-colors hover:bg-emerald-500/10 dark:border-emerald-800"
                        onClick={() => handleQuickAction('ai')}
                      >
                        <Brain className="h-5 w-5 text-emerald-600 shrink-0" />
                        <div>
                          <div className="text-sm font-medium">Explore AI Features</div>
                          <div className="text-xs text-muted-foreground">RAG chat, embeddings, and more</div>
                        </div>
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation dots */}
              <div className="mt-6 flex items-center justify-center gap-1.5">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`h-2 rounded-full transition-all duration-200 ${
                      i === currentStep
                        ? 'w-6 bg-gradient-to-r from-emerald-500 to-teal-500'
                        : 'w-2 bg-muted-foreground/25 hover:bg-muted-foreground/40'
                    }`}
                    onClick={() => setCurrentStep(i)}
                    aria-label={`Go to step ${i + 1}`}
                  />
                ))}
              </div>

              {/* Buttons */}
              <div className="mt-5 flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
                  Skip Tour
                </Button>
                <div className="flex items-center gap-2">
                  {currentStep > 0 && (
                    <Button variant="outline" size="sm" onClick={handleBack}>
                      Back
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleNext}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                  >
                    {isLast ? 'Get Started' : 'Next'}
                    {!isLast && <ChevronRight className="ml-1 h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
