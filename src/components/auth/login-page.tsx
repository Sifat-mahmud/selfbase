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
  const [googleEnabled, setGoogleEnabled] = useState(false)

  useEffect(() => {
    // Check if setup is needed and if Google auth is enabled
    Promise.all([
      fetch('/api/auth/setup').then(r => r.json()),
      fetch('/api/auth/google/status').then(r => r.json()),
    ])
      .then(([setupData, googleData]) => {
        setCheckingSetup(false)
        if (setupData.needsSetup) {
          setSetupMode(true)
        }
        setGoogleEnabled(googleData.enabled === true)
      })
      .catch(() => {
        setCheckingSetup(false)
      })
  }, [])

  // Handle OAuth error redirect (e.g., ?error=google_auth_failed)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err) {
      const errorMessages: Record<string, string> = {
        google_auth_failed: 'Google sign-in failed. Please try again.',
        google_not_configured: 'Google sign-in is not configured. Contact your administrator.',
        google_access_denied: 'Google sign-in was cancelled.',
        google_state_mismatch: 'Security check failed. Please try again.',
        google_token_exchange_failed: 'Could not complete Google sign-in. Check your OAuth configuration.',
        google_userinfo_failed: 'Could not retrieve your Google account info.',
        google_no_email: 'Your Google account does not have an email address.',
        account_disabled: 'Your account has been disabled. Contact your administrator.',
      }
      setError(errorMessages[err] || 'Authentication error. Please try again.')
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    // Redirect to Google OAuth initiation endpoint
    window.location.href = '/api/auth/google'
  }

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

            {/* Google OAuth Button */}
            {googleEnabled && !setupMode && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  variant="outline"
                  className="w-full border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  Sign in with Google
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          SelfBase v1.0 · Self-hosted · Local-First
        </p>
      </motion.div>
    </div>
  )
}
