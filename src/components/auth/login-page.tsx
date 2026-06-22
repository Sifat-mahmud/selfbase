'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Lock, Mail, Eye, EyeOff, Loader2, Shield, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface LoginPageProps {
  onLogin: (token: string, user: UserPayload) => void
}

interface UserPayload {
  id: string
  email: string
  name: string | null
  role: string
  mustChangePassword: boolean
  avatarUrl: string | null
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupMode, setSetupMode] = useState(false)
  const [setupName, setSetupName] = useState('')
  const [checkingSetup, setCheckingSetup] = useState(true)

  useEffect(() => {
    // Check if setup is needed
    fetch('/api/auth/setup')
      .then(r => r.json())
      .then(data => {
        setCheckingSetup(false)
        if (data.needsSetup) {
          setSetupMode(true)
        }
        // Don't show default password on login page - user should know their password
      })
      .catch(() => {
        setCheckingSetup(false)
      })
  }, [])

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password, name: setupName || 'Admin' }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Setup failed')
        return
      }

      // Now login with the new credentials
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const loginData = await loginRes.json()

      if (!loginRes.ok) {
        setError(loginData.error || 'Login failed after setup')
        return
      }

      localStorage.setItem('sb_auth_token', loginData.token)
      onLogin(loginData.token, loginData.user)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Invalid credentials')
        return
      }

      localStorage.setItem('sb_auth_token', data.token)
      onLogin(data.token, data.user)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Loading state while checking setup
  if (checkingSetup) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 animate-pulse">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            SelfBase
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-Native Backend-as-a-Service
          </p>
        </div>

        <Card className="border-0 shadow-xl shadow-black/5 dark:shadow-black/20">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">
              {setupMode ? 'Create Admin Account' : 'Welcome Back'}
            </CardTitle>
            <CardDescription>
              {setupMode
                ? 'Set up your admin account to get started with SelfBase'
                : 'Sign in to access your SelfBase dashboard'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={setupMode ? handleSetup : handleLogin} className="space-y-4">
              {setupMode && (
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="setup-name">Name</label>
                  <Input
                    id="setup-name"
                    type="text"
                    placeholder="Admin"
                    value={setupName}
                    onChange={e => setSetupName(e.target.value)}
                    disabled={loading}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@selfbase.local"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={setupMode ? 'Choose a strong password' : 'Enter your password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={loading}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {setupMode && (
                <p className="text-xs text-muted-foreground">
                  Password must be at least 6 characters long.
                </p>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/25"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                {setupMode ? 'Create Account & Sign In' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          SelfBase v1.0 · Self-hosted · Local-First
        </p>
      </motion.div>
    </div>
  )
}
