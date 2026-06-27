'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, UserCheck, UserX, Shield, Key,
  Pencil, Trash2, Eye, EyeOff, Save, Lock, Database, RotateCcw, Download, Layers,
} from 'lucide-react'
import { SortableTh } from '@/components/ui/sortable-th'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { registerSchema, RegisterInput } from '@/lib/validations'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { CurrencySelector } from '@/components/ui/CurrencySelector'
import { getCurrency } from '@/lib/currencies'
import { useCurrency } from '@/hooks/useCurrency'

// ── Types ─────────────────────────────────────────────────────────────────────
type UserRow = { id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string }

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  ADMIN:   'bg-red-100 text-red-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  STAFF:   'bg-green-100 text-green-700',
}

const ROLE_PERMS = [
  {
    role: 'ADMIN',
    badge: 'bg-red-100 text-red-700',
    description: 'Full system access',
    can: [
      'All Bookings — create, edit, delete',
      'All Properties — create, edit, delete',
      'All Expenses — create, edit, delete',
      'User Management — add, edit, delete',
      'Settings & Currency',
      'Calendar & Dashboard',
    ],
    cannot: [] as string[],
  },
  {
    role: 'MANAGER',
    badge: 'bg-blue-100 text-blue-700',
    description: 'Operational access',
    can: [
      'All Bookings — create, edit, delete',
      'Properties — create & edit',
      'Expenses — create, edit, delete',
      'Calendar & Dashboard',
    ],
    cannot: [
      'User Management',
      'System Settings',
      'Delete Properties',
    ],
  },
  {
    role: 'STAFF',
    badge: 'bg-green-100 text-green-700',
    description: 'Basic operations',
    can: [
      'Create & edit bookings',
      'View properties & calendar',
      'View expenses & dashboard',
    ],
    cannot: [
      'Delete bookings or properties',
      'User Management',
      'System Settings',
    ],
  },
]

// ── Data fetcher ──────────────────────────────────────────────────────────────
async function fetchUsers() {
  const res = await fetch('/api/users')
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'ADMIN'

  // User management modal state
  const [addModalOpen, setAddModalOpen]   = useState(false)
  const [editingUser, setEditingUser]     = useState<UserRow | null>(null)
  const [deletingUser, setDeletingUser]   = useState<UserRow | null>(null)
  const [editForm, setEditForm]           = useState({ name: '', email: '', role: 'STAFF', resetPwd: false, newPassword: '' })
  const [showEditPwd, setShowEditPwd]     = useState(false)

  // My Account state
  const [profileForm, setProfileForm] = useState({ name: '', email: '' })
  const [profileReady, setProfileReady] = useState(false)
  const [pwdForm, setPwdForm]         = useState({ current: '', newPwd: '', confirm: '' })
  const [showPwd, setShowPwd]         = useState({ current: false, newPwd: false, confirm: false })

  useEffect(() => {
    if (user && !profileReady) {
      setProfileForm({ name: user.name || '', email: user.email || '' })
      setProfileReady(true)
    }
  }, [user, profileReady])

  // User list query (admin only)
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: !!isAdmin,
  })
  const users: UserRow[] = data?.data || []

  // Client-side sort for users (small dataset)
  const [userSortBy,    setUserSortBy]    = useState('name')
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('asc')

  function handleUserSort(field: string) {
    if (field === userSortBy) setUserSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setUserSortBy(field); setUserSortOrder('asc') }
  }

  const sortedUsers = [...users].sort((a, b) => {
    const dir = userSortOrder === 'asc' ? 1 : -1
    const av  = (a as any)[userSortBy] ?? ''
    const bv  = (b as any)[userSortBy] ?? ''
    if (typeof av === 'boolean') return ((av ? 1 : 0) - (bv ? 1 : 0)) * dir
    return String(av).localeCompare(String(bv)) * dir
  })

  // Add user form (react-hook-form)
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'STAFF' },
  })

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createUserMutation = useMutation({
    mutationFn: async (d: RegisterInput) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setAddModalOpen(false); reset()
      toast.success('User created')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated')
    },
    onError: () => toast.error('Failed to update user'),
  })

  const editUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditingUser(null)
      toast.success('User updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeletingUser(null)
      toast.success('User deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateProfileMutation = useMutation({
    mutationFn: async (d: { name: string; email: string }) => {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('Profile updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const changePasswordMutation = useMutation({
    mutationFn: async (d: { currentPassword: string; newPassword: string }) => {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
    },
    onSuccess: () => {
      setPwdForm({ current: '', newPwd: '', confirm: '' })
      toast.success('Password changed successfully')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function openEditUser(u: UserRow) {
    setEditForm({ name: u.name, email: u.email, role: u.role, resetPwd: false, newPassword: '' })
    setShowEditPwd(false)
    setEditingUser(u)
  }

  function handleEditSave() {
    if (!editingUser) return
    const payload: any = { name: editForm.name, email: editForm.email, role: editForm.role }
    if (editForm.resetPwd) {
      if (!editForm.newPassword || editForm.newPassword.length < 6) {
        toast.error('New password must be at least 6 characters'); return
      }
      payload.password = editForm.newPassword
    }
    editUserMutation.mutate({ id: editingUser.id, data: payload })
  }

  function handleChangePassword() {
    if (!pwdForm.current)          { toast.error('Enter your current password'); return }
    if (pwdForm.newPwd.length < 6) { toast.error('New password must be at least 6 characters'); return }
    if (pwdForm.newPwd !== pwdForm.confirm) { toast.error('Passwords do not match'); return }
    changePasswordMutation.mutate({ currentPassword: pwdForm.current, newPassword: pwdForm.newPwd })
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage users, roles, and system configuration" />

      <Tabs defaultValue="currency">
        <TabsList>
          <TabsTrigger value="currency">Currency</TabsTrigger>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="account">My Account</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
        </TabsList>

        {/* ── Currency ── */}
        <CurrencyTab />

        {/* ── Platforms ── */}
        <PlatformsTab />

        {/* ── User Management ── */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? 's' : ''}</p>
            {isAdmin && (
              <Button size="sm" onClick={() => setAddModalOpen(true)}>
                <Plus className="h-4 w-4" />Add User
              </Button>
            )}
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <SortableTh label="User"    field="name"      sortBy={userSortBy} sortOrder={userSortOrder} onSort={handleUserSort} />
                    <SortableTh label="Role"    field="role"      sortBy={userSortBy} sortOrder={userSortOrder} onSort={handleUserSort} />
                    <SortableTh label="Status"  field="isActive"  sortBy={userSortBy} sortOrder={userSortOrder} onSort={handleUserSort} />
                    <SortableTh label="Created" field="createdAt" sortBy={userSortBy} sortOrder={userSortOrder} onSort={handleUserSort} />
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
                  ) : sortedUsers.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {u.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">
                              {u.name}
                              {u.id === user?.userId && (
                                <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                              )}
                            </p>
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
                            <Button variant="ghost" size="sm" title="Edit user" onClick={() => openEditUser(u)}>
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            {u.id !== user?.userId && (
                              <>
                                <Button
                                  variant="ghost" size="sm"
                                  title={u.isActive ? 'Deactivate' : 'Activate'}
                                  onClick={() => toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive })}
                                >
                                  {u.isActive
                                    ? <UserX className="h-3.5 w-3.5 text-orange-500" />
                                    : <UserCheck className="h-3.5 w-3.5 text-green-500" />
                                  }
                                </Button>
                                <Button variant="ghost" size="sm" title="Delete user" onClick={() => setDeletingUser(u)}>
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </>
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

          {/* Role Permissions reference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />Role Permissions
              </CardTitle>
              <CardDescription>What each role can access and do in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                {ROLE_PERMS.map(({ role, badge, description, can, cannot }) => (
                  <div key={role} className="rounded-lg border p-4 space-y-3">
                    <div>
                      <Badge className={badge} variant="outline">{role}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">{description}</p>
                    </div>
                    <ul className="space-y-1.5">
                      {can.map(p => (
                        <li key={p} className="text-xs flex items-start gap-1.5">
                          <span className="text-green-600 shrink-0 mt-0.5">✓</span>
                          <span>{p}</span>
                        </li>
                      ))}
                      {cannot.map(p => (
                        <li key={p} className="text-xs flex items-start gap-1.5">
                          <span className="text-red-500 shrink-0 mt-0.5">✗</span>
                          <span className="text-muted-foreground">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── My Account ── */}
        <TabsContent value="account" className="space-y-4">
          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your display name and email address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white text-2xl font-bold shrink-0">
                  {(profileForm.name || user?.name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <Badge className={ROLE_COLORS[user?.role || ''] || ''} variant="outline" >{user?.role}</Badge>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={profileForm.name}
                    onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={profileForm.email}
                    onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="Your email"
                  />
                </div>
              </div>
              <Button
                onClick={() => updateProfileMutation.mutate(profileForm)}
                disabled={updateProfileMutation.isPending || !profileForm.name || !profileForm.email}
              >
                <Save className="h-4 w-4" />
                {updateProfileMutation.isPending ? 'Saving…' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" />Change Password</CardTitle>
              <CardDescription>Enter your current password, then choose a new one</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'current' as const, label: 'Current Password',      placeholder: 'Current password' },
                { key: 'newPwd'  as const, label: 'New Password',           placeholder: 'New password (min 6 characters)' },
                { key: 'confirm' as const, label: 'Confirm New Password',   placeholder: 'Confirm new password' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <div className="relative">
                    <Input
                      type={showPwd[key] ? 'text' : 'password'}
                      value={pwdForm[key]}
                      onChange={e => setPwdForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(s => ({ ...s, [key]: !s[key] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPwd[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
              <Button
                onClick={handleChangePassword}
                disabled={changePasswordMutation.isPending || !pwdForm.current || !pwdForm.newPwd || !pwdForm.confirm}
              >
                <Key className="h-4 w-4" />
                {changePasswordMutation.isPending ? 'Changing…' : 'Change Password'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Backups ── */}
        <BackupsTab />

      </Tabs>

      {/* ── Add User Modal ── */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Add a new user account to the system</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => createUserMutation.mutate(d))}>
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
                <Select defaultValue="STAFF" onValueChange={v => setValue('role', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['ADMIN', 'MANAGER', 'STAFF'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" type="button" onClick={() => { setAddModalOpen(false); reset() }}>Cancel</Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? 'Creating…' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Modal ── */}
      <Dialog open={!!editingUser} onOpenChange={open => { if (!open) setEditingUser(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update account details for {editingUser?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['ADMIN', 'MANAGER', 'STAFF'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="resetPwd"
                  checked={editForm.resetPwd}
                  onChange={e => setEditForm(f => ({ ...f, resetPwd: e.target.checked, newPassword: '' }))}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <Label htmlFor="resetPwd" className="cursor-pointer font-normal">Reset password for this user</Label>
              </div>
              {editForm.resetPwd && (
                <div className="relative">
                  <Input
                    type={showEditPwd ? 'text' : 'password'}
                    placeholder="New password (min 6 characters)"
                    value={editForm.newPassword}
                    onChange={e => setEditForm(f => ({ ...f, newPassword: e.target.value }))}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPwd(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showEditPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editUserMutation.isPending}>
              {editUserMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={!!deletingUser} onOpenChange={open => { if (!open) setDeletingUser(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deletingUser?.name}</strong> ({deletingUser?.email})?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deletingUser && deleteUserMutation.mutate(deletingUser.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? 'Deleting…' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Backups Tab ───────────────────────────────────────────────────────────────
type BackupRow = { id: string; label: string; recordCount: number; createdBy: string | null; createdAt: string }

function BackupsTab() {
  const queryClient = useQueryClient()
  const [restoring, setRestoring] = useState<BackupRow | null>(null)

  const { data, isLoading } = useQuery<{ success: boolean; data: BackupRow[] }>({
    queryKey: ['backups'],
    queryFn: async () => {
      const res = await fetch('/api/backups')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })
  const backups = data?.data || []

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      if (!res.ok) throw new Error('Failed to create backup')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      toast.success('Backup created')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/backups/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete backup')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      toast.success('Backup deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/backups/${id}/restore`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to restore')
    },
    onSuccess: () => {
      queryClient.invalidateQueries()
      setRestoring(null)
      toast.success('Database restored successfully')
    },
    onError: (e: Error) => { toast.error(e.message); setRestoring(null) },
  })

  return (
    <TabsContent value="backups" className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4" />Database Backups
              </CardTitle>
              <CardDescription>
                Automatic daily backup runs on first login each day. Backups include all properties, bookings, income, expenses, and payouts.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <Download className="h-4 w-4" />
              {createMutation.isPending ? 'Backing up…' : 'Backup Now'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : backups.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No backups yet. Click &quot;Backup Now&quot; or log in tomorrow for an automatic backup.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Label</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Records</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created By</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => (
                    <tr key={b.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{b.label}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.recordCount} records</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.createdBy || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(b.createdAt, 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" title="Restore this backup" onClick={() => setRestoring(b)}>
                            <RotateCcw className="h-3.5 w-3.5 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost" size="sm" title="Delete backup"
                            onClick={() => { if (confirm('Delete this backup?')) deleteMutation.mutate(b.id) }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!restoring} onOpenChange={open => { if (!open) setRestoring(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Restore Backup</DialogTitle>
            <DialogDescription>
              This will replace ALL current data with the backup from{' '}
              <strong>{restoring && formatDate(restoring.createdAt, 'MMM d, yyyy HH:mm')}</strong>{' '}
              ({restoring?.recordCount} records). This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoring(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={restoreMutation.isPending}
              onClick={() => restoring && restoreMutation.mutate(restoring.id)}
            >
              {restoreMutation.isPending ? 'Restoring…' : 'Yes, Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  )
}

// ── Platforms Tab ─────────────────────────────────────────────────────────────

export type PlatformItem = {
  value: string      // DB enum value: AIRBNB | DIRECT | BOOKING_COM | VRBO | OTHER
  label: string      // display name
  fee:   number      // default platform fee
  custom?: boolean   // user-added entry
}

export const DEFAULT_PLATFORMS: PlatformItem[] = [
  { value: 'AIRBNB',      label: 'Airbnb',       fee: 0 },
  { value: 'DIRECT',      label: 'Direct',       fee: 0 },
  { value: 'BOOKING_COM', label: 'Booking.com',  fee: 0 },
  { value: 'VRBO',        label: 'VRBO',         fee: 0 },
  { value: 'OTHER',       label: 'Other',        fee: 0 },
]

function PlatformsTab() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const { data, isLoading } = useQuery<PlatformItem[]>({
    queryKey: ['settings', 'platforms'],
    queryFn: async () => {
      const res = await fetch('/api/settings?key=platforms')
      const json = await res.json()
      return (json.data as { items: PlatformItem[] } | null)?.items ?? DEFAULT_PLATFORMS
    },
  })

  const [items, setItems] = useState<PlatformItem[]>([])
  const [newLabel, setNewLabel] = useState('')

  useEffect(() => {
    if (data) setItems(data)
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async (items: PlatformItem[]) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'platforms', value: { items } }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'platforms'] })
      toast.success('Platforms saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function updateItem(idx: number, patch: Partial<PlatformItem>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function addCustom() {
    const label = newLabel.trim()
    if (!label) return
    if (items.some(it => it.label.toLowerCase() === label.toLowerCase())) {
      toast.error('Platform already exists'); return
    }
    setItems(prev => [...prev, { value: 'OTHER', label, fee: 0, custom: true }])
    setNewLabel('')
  }

  if (isLoading) return (
    <TabsContent value="platforms">
      <div className="space-y-2 mt-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
    </TabsContent>
  )

  return (
    <TabsContent value="platforms" className="space-y-4 mt-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4" />Booking Platforms
              </CardTitle>
              <CardDescription>
                Customize platform names, default fees, and add your own. Changes apply to the booking form immediately.
              </CardDescription>
            </div>
            {isAdmin && (
              <Button size="sm" onClick={() => saveMutation.mutate(items)} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_180px_60px_36px] gap-2 px-2 pb-1 border-b text-xs font-medium text-muted-foreground">
            <span>Label (shown in app)</span>
            <span>Default Fee (amount)</span>
            <span>Type</span>
            <span />
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_180px_60px_36px] gap-2 items-center">
              <Input
                value={item.label}
                onChange={e => updateItem(idx, { label: e.target.value })}
                disabled={!isAdmin}
                className="h-8 text-sm"
              />
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  value={item.fee}
                  onChange={e => updateItem(idx, { fee: Number(e.target.value) || 0 })}
                  disabled={!isAdmin}
                  className="h-8 text-sm pr-2"
                />
              </div>
              <Badge variant="outline" className={item.custom ? 'text-violet-600 border-violet-400/40 bg-violet-500/10 text-[10px]' : 'text-muted-foreground text-[10px]'}>
                {item.custom ? 'custom' : 'built-in'}
              </Badge>
              {isAdmin && item.custom ? (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeItem(idx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : <div />}
            </div>
          ))}

          {/* Add custom platform */}
          {isAdmin && (
            <div className="flex items-center gap-2 pt-3 border-t mt-3">
              <Input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustom()}
                placeholder="New platform name (e.g. Facebook, Walk-in)"
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={addCustom} disabled={!newLabel.trim()}>
                <Plus className="h-4 w-4" />Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  )
}

// ── Currency Tab (unchanged, kept as sub-component) ───────────────────────────
function CurrencyTab() {
  const { currency, setCurrency, currencyInfo, format } = useCurrency()
  const PREVIEW_AMOUNTS = [1000, 25000, 150000, 1250000]

  return (
    <TabsContent value="currency" className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-xl">{currencyInfo.flag}</span>Display Currency
            </CardTitle>
            <CardDescription>
              All amounts across the app will be displayed in this currency. Your preference is saved automatically.
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
