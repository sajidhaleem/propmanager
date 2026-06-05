'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, UserCheck, UserX, Shield, Key } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { registerSchema, RegisterInput } from '@/lib/validations'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { CurrencySelector } from '@/components/ui/CurrencySelector'
import { useCurrency } from '@/hooks/useCurrency'
import { formatAmount, getCurrency } from '@/lib/currencies'

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  STAFF: 'bg-green-100 text-green-700',
}

async function fetchUsers() {
  const res = await fetch('/api/users')
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export default function SettingsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const users = data?.data || []

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'STAFF' },
  })

  const createUserMutation = useMutation({
    mutationFn: async (data: RegisterInput) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setModalOpen(false)
      reset()
      toast.success('User created')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated')
    },
    onError: () => toast.error('Failed to update user'),
  })

  const isAdmin = user?.role === 'ADMIN'
  const { currency, setCurrency, currencyInfo, format } = useCurrency()

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage users, roles, and system configuration" />

      <Tabs defaultValue="currency">
        <TabsList>
          <TabsTrigger value="currency">Currency</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="account">My Account</TabsTrigger>
          <TabsTrigger value="system">System Info</TabsTrigger>
        </TabsList>

        {/* ── Currency Tab ── */}
        <CurrencyTab />

        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{users.length} users total</p>
            {isAdmin && (
              <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" />Add User</Button>
            )}
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                    {isAdmin && <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="border-b">
                        {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4" /></td>)}
                      </tr>
                    ))
                  ) : users.map((u: any) => (
                    <tr key={u.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {u.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'} variant="outline">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {u.id !== user?.userId && (
                              <Button variant="ghost" size="sm"
                                onClick={() => updateUserMutation.mutate({ id: u.id, data: { isActive: !u.isActive } })}>
                                {u.isActive ? <UserX className="h-3.5 w-3.5 text-red-500" /> : <UserCheck className="h-3.5 w-3.5 text-green-500" />}
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader><CardTitle>Account Information</CardTitle><CardDescription>Your profile details</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white text-2xl font-bold">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-semibold">{user?.name}</p>
                  <p className="text-muted-foreground">{user?.email}</p>
                  <Badge className={ROLE_COLORS[user?.role || ''] || ''} variant="outline">{user?.role}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" />Security</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>✓ JWT authentication with 7-day expiry</p>
                <p>✓ Role-based access control (RBAC)</p>
                <p>✓ HTTP-only cookies</p>
                <p>✓ bcrypt password hashing</p>
                <p>✓ Input validation via Zod</p>
                <p>✓ SQL injection prevention via Prisma ORM</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Key className="h-4 w-4" />System Info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>App: PropManager v1.0.0</p>
                <p>Framework: Next.js 15</p>
                <p>Database: PostgreSQL + Prisma ORM</p>
                <p>Auth: Custom JWT</p>
                <p>Environment: {process.env.NODE_ENV}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createUserMutation.mutate(d))}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input type="password" {...register('password')} />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select defaultValue="STAFF" onValueChange={(v) => setValue('role', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['ADMIN','MANAGER','STAFF'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Currency Tab Component ────────────────────────────────────────────────────
function CurrencyTab() {
  const { currency, setCurrency, currencyInfo, format } = useCurrency()

  const PREVIEW_AMOUNTS = [1000, 25000, 150000, 1250000]

  return (
    <TabsContent value="currency" className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-xl">{currencyInfo.flag}</span>
              Display Currency
            </CardTitle>
            <CardDescription>
              All amounts across the app will be displayed in this currency.
              Your preference is saved automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CurrencySelector value={currency} onChange={setCurrency} />
            <div className="rounded-lg bg-muted/40 border p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-xl shrink-0">
                {currencyInfo.flag}
              </div>
              <div>
                <p className="text-sm font-semibold">{currencyInfo.name}</p>
                <p className="text-xs text-muted-foreground">
                  Code: <span className="font-mono">{currencyInfo.code}</span> · Symbol: <span className="font-mono">{currencyInfo.symbol}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>How amounts will appear across the app</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PREVIEW_AMOUNTS.map(amount => (
              <div key={amount} className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
                <span className="text-sm text-muted-foreground">{amount.toLocaleString()} units</span>
                <span className="text-sm font-semibold tabular-nums">{format(amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Negative (expense)</span>
              <span className="text-sm font-semibold text-red-500 tabular-nums">-{format(5500)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Popular currencies quick-select */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Select</CardTitle>
          <CardDescription>Switch to a commonly used currency</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['PKR','USD','EUR','GBP','AED','SAR','INR','AUD','CAD','JPY','CHF','TRY'].map(code => {
              const c = getCurrency(code)
              return (
                <button
                  key={code}
                  onClick={() => setCurrency(code)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    currency === code
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <span>{c.flag}</span>
                  <span className="font-mono">{code}</span>
                  <span className="text-muted-foreground">{c.symbol}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}
