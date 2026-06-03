'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Building2, ShieldCheck, BarChart3 } from 'lucide-react'
import { useState } from 'react'
import { loginSchema, LoginInput } from '@/lib/validations'
import { useAuth } from '@/hooks/useAuth'

const FEATURES = [
  { icon: Building2, text: 'Manage all properties in one place' },
  { icon: BarChart3, text: 'Real-time revenue & occupancy analytics' },
  { icon: ShieldCheck, text: 'Role-based access for your whole team' },
]

export default function LoginPage() {
  const { login, isLoggingIn } = useAuth()
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-purple-600/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full border border-blue-800/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full border border-blue-700/15" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          <div className="flex items-center gap-3 mb-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 shadow-lg shadow-blue-500/30">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">PropManager</span>
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Your properties,<br />
            <span className="text-blue-400">perfectly managed.</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-sm">
            The all-in-one platform for short-term rental management.
            Track bookings, income, and payouts effortlessly.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="relative space-y-4"
        >
          {FEATURES.map(({ icon: Icon, text }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Icon className="h-4 w-4 text-blue-400" />
              </div>
              <span className="text-slate-300 text-sm">{text}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg">PropManager</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground text-sm mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit((d) => login(d))} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 transition-shadow"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 transition-shadow"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="flex w-full items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none transition-colors"
            >
              {isLoggingIn ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 rounded-xl border bg-muted/40 p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Demo credentials</p>
            {[
              { role: 'Admin', email: 'admin@propmanager.com', pass: 'admin123' },
              { role: 'Manager', email: 'manager@propmanager.com', pass: 'manager123' },
            ].map(({ role, email, pass }) => (
              <div key={role} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{role}</span>
                <span className="font-mono text-foreground/70">{email} / {pass}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
