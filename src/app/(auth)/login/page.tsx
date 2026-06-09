'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Eye, EyeOff, Loader2, Building2, ShieldCheck,
  CalendarCheck, Banknote, Check, ArrowRight, Star,
} from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { loginSchema, LoginInput } from '@/lib/validations'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

// ── Aceternity Spotlight (21st.dev/r/aceternity/spotlight) ────────────────
function Spotlight({ className, fill }: { className?: string; fill?: string }) {
  return (
    <svg
      className={cn(
        'animate-spotlight pointer-events-none absolute z-[1] h-[169%] w-[138%] lg:w-[84%] opacity-0',
        className,
      )}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 3787 2842"
      fill="none"
    >
      <g filter="url(#sfilter)">
        <ellipse
          cx="1924.71" cy="273.501" rx="1924.71" ry="273.501"
          transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
          fill={fill || 'white'} fillOpacity="0.21"
        />
      </g>
      <defs>
        <filter id="sfilter" x="0.860352" y="0.838989" width="3785.16" height="2840.26"
          filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="151" result="effect1_foregroundBlur_1065_8" />
        </filter>
      </defs>
    </svg>
  )
}

// ── Data ──────────────────────────────────────────────────────────────────
const STATS = [
  {
    icon: Building2,
    label: 'Properties',
    value: '12+',
    gradient: 'from-blue-500 to-blue-700',
    bg: 'bg-blue-500/10 border-blue-500/20',
    text: 'text-blue-300',
  },
  {
    icon: CalendarCheck,
    label: 'Avg Occupancy',
    value: '94%',
    gradient: 'from-emerald-500 to-green-700',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-300',
  },
  {
    icon: Banknote,
    label: 'Monthly Revenue',
    value: 'Rs 2.4M',
    gradient: 'from-violet-500 to-purple-700',
    bg: 'bg-violet-500/10 border-violet-500/20',
    text: 'text-violet-300',
  },
]

const FEATURES = [
  'Smart booking management across all channels',
  'Real-time revenue, expense & payout tracking',
  'Property calendar with availability overview',
  'Role-based access — Admin, Manager & Staff',
]

// ── Animation variants ────────────────────────────────────────────────────
const fadeUp = (i: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1 + 0.25, duration: 0.55, ease: [0.22, 1, 0.36, 1] as any },
  },
})

export default function LoginPage() {
  const { login, isLoggingIn } = useAuth()
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ═══════════════════════════════════════════════════════════════
          LEFT — branding panel
      ═══════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] relative overflow-hidden flex-col justify-between p-12
        bg-[linear-gradient(135deg,#060b18_0%,#0d1535_50%,#08021a_100%)]">

        {/* dot grid */}
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #6b8cff 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />

        {/* Spotlight from aceternity */}
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="#60a5fa" />

        {/* ambient glow blobs */}
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-blue-600/6 blur-[130px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 h-[500px] w-[500px] rounded-full bg-purple-700/6 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-blue-500/4 blur-[80px] pointer-events-none" />

        {/* ── Logo ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl
            bg-gradient-to-br from-blue-500 to-blue-700
            shadow-lg shadow-blue-600/40 ring-1 ring-white/10">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">PropManager</div>
            <div className="flex items-center gap-0.5 mt-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
              ))}
              <span className="text-[10px] text-slate-500 ml-1.5">5.0 · Trusted Platform</span>
            </div>
          </div>
        </motion.div>

        {/* ── Hero content ── */}
        <div className="relative z-10 flex-1 flex flex-col justify-center -mt-4">

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-blue-500/20
              bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400 mb-5 w-fit"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            Property Management Platform
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="text-[2.6rem] xl:text-5xl font-bold leading-[1.1] text-white mb-5"
          >
            Your properties,<br />
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              perfectly managed.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.55 }}
            className="text-slate-400 text-base leading-relaxed max-w-xs mb-10"
          >
            The all-in-one platform for short-term rental management.
            Track bookings, income, and payouts effortlessly.
          </motion.p>

          {/* ── Stats grid ── */}
          <div className="grid grid-cols-3 gap-3 mb-10">
            {STATS.map((s, i) => (
              <motion.div key={s.label} {...fadeUp(i)}
                className={cn('rounded-xl border p-3.5 backdrop-blur-sm', s.bg)}
              >
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br mb-3', s.gradient)}>
                  <s.icon className="h-4 w-4 text-white" />
                </div>
                <div className={cn('text-lg font-bold leading-none', s.text)}>{s.value}</div>
                <div className="text-[11px] text-slate-500 mt-1 leading-tight">{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* ── Feature list ── */}
          <div className="space-y-2.5">
            {FEATURES.map((f, i) => (
              <motion.div key={f} {...fadeUp(i + 3)} className="flex items-center gap-2.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                  bg-blue-500/15 border border-blue-500/25">
                  <Check className="h-2.5 w-2.5 text-blue-400" />
                </div>
                <span className="text-sm text-slate-400">{f}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Bottom trust line ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          className="relative z-10 flex items-center gap-2 text-slate-600 text-xs"
        >
          <ShieldCheck className="h-4 w-4" />
          Trusted by property managers · End-to-end encryption
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          RIGHT — login form
      ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 bg-background relative overflow-hidden">

        {/* subtle background accent */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full
            bg-[radial-gradient(ellipse,hsl(221_83%_53%/0.05),transparent_70%)]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full
            bg-[radial-gradient(ellipse,hsl(263_70%_50%/0.04),transparent_70%)]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[390px]"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl
              bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/30">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">PropManager</span>
          </div>

          {/* Header */}
          <div className="mb-7">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border
              bg-muted/50 px-3 py-1 text-xs text-muted-foreground mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Secure · All data encrypted
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground text-sm mt-1.5">
              Sign in to your PropManager account to continue.
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm
            p-6 shadow-2xl shadow-black/5 ring-1 ring-white/5 dark:ring-white/[0.03]">
            <form method="post" onSubmit={handleSubmit((d) => login(d))} className="space-y-4">

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="flex h-10 w-full rounded-lg border border-input bg-background/80 px-3 py-2 text-sm
                    placeholder:text-muted-foreground
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                    transition-all duration-150"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="flex h-10 w-full rounded-lg border border-input bg-background/80 px-3 py-2 pr-10 text-sm
                      placeholder:text-muted-foreground
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                      transition-all duration-150"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2
                      text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="group flex w-full items-center justify-center gap-2 h-11 rounded-lg
                  bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold
                  hover:from-blue-600 hover:to-blue-700
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                  disabled:opacity-60 disabled:pointer-events-none
                  shadow-lg shadow-blue-500/30
                  transition-all duration-200 mt-2"
              >
                {isLoggingIn ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-150" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-5">
            Having trouble?{' '}
            <span className="text-primary cursor-pointer hover:underline underline-offset-2">
              Contact your admin
            </span>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
