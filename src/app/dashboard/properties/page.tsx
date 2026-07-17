'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Home, Users, Banknote, Activity, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { MagicCard } from '@/components/ui/magic-card'
import { EmptyState } from '@/components/ui/empty-state'
import { getStatusColor } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { Property } from '@/types'

async function fetchProperties() {
  const res = await fetch('/api/properties')
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

const EMPTY_FORM = {
  name: '', description: '', type: 'room', capacity: '2',
  baseRate: '', status: 'ACTIVE', amenities: '',
}

export default function PropertiesPage() {
  const { format } = useCurrency()
  const queryClient = useQueryClient()
  const shouldReduceMotion = useReducedMotion()
  const [modalOpen, setModalOpen] = useState(false)
  const [editProperty, setEditProperty] = useState<Property | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data, isLoading } = useQuery({ queryKey: ['properties'], queryFn: fetchProperties })
  const properties: Property[] = data?.data || []

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editProperty ? `/api/properties/${editProperty.id}` : '/api/properties'
      const res = await fetch(url, {
        method: editProperty ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          capacity: Number(payload.capacity),
          baseRate: Number(payload.baseRate),
          amenities: payload.amenities.split(',').map((a: string) => a.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] })
      setModalOpen(false)
      toast.success(editProperty ? 'Property updated' : 'Property created')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/properties/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] })
      toast.success('Property deleted')
    },
    onError: () => toast.error('Delete failed'),
  })

  function openCreate() { setEditProperty(null); setForm(EMPTY_FORM); setModalOpen(true) }
  function openEdit(p: Property) {
    setEditProperty(p)
    setForm({
      name: p.name, description: p.description || '', type: p.type,
      capacity: String(p.capacity), baseRate: String(p.baseRate),
      status: p.status, amenities: p.amenities.join(', '),
    })
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Properties" description="Manage your rental properties and rooms">
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add Property</Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {properties.map((p, i) => {
            const COLORS = [
              { bar: 'from-teal-400 to-teal-600',   glow: 'rgba(27,165,142,0.10)',  icon: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
              { bar: 'from-green-400 to-green-600',  glow: 'rgba(34,197,94,0.10)',   icon: 'bg-green-500/15 text-green-600 dark:text-green-400' },
              { bar: 'from-purple-400 to-violet-600',glow: 'rgba(168,85,247,0.10)',  icon: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
              { bar: 'from-orange-400 to-orange-600',glow: 'rgba(249,115,22,0.10)',  icon: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
            ]
            const c = COLORS[i % COLORS.length]
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: shouldReduceMotion ? 0.01 : 0.3, delay: shouldReduceMotion ? 0 : i * 0.08 }}
              >
                <MagicCard glowColor={c.glow} className="relative overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
                  {/* Gradient top bar */}
                  <div className={`h-[3px] bg-gradient-to-r ${c.bar}`} />

                  <div className="p-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.icon}`}>
                        <Home className="h-5 w-5" />
                      </div>
                      <Badge className={getStatusColor(p.status)} variant="outline">
                        {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                      </Badge>
                    </div>

                    {/* Name + description */}
                    <h3 className="font-semibold text-sm leading-tight mb-0.5">{p.name}</h3>
                    {p.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.description}</p>
                    )}

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs text-muted-foreground mb-3">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        <span>{p.capacity} guests</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Banknote className="h-3.5 w-3.5 shrink-0" />
                        <span>{format(p.baseRate)}/night</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 shrink-0" />
                        <span>{p._count?.bookings || 0} bookings</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="capitalize">{p.type}</span>
                      </div>
                    </div>

                    {/* Amenities */}
                    {p.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {p.amenities.slice(0, 3).map((a) => (
                          <span key={a} className="text-[11px] bg-muted/70 text-muted-foreground px-2 py-0.5 rounded-full border">
                            {a}
                          </span>
                        ))}
                        {p.amenities.length > 3 && (
                          <span className="text-[11px] text-muted-foreground px-1">+{p.amenities.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1 border-t border-border/60">
                      <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs mt-2" onClick={() => openEdit(p)}>
                        <Edit className="h-3.5 w-3.5 mr-1" />Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs mt-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => { if (confirm('Delete property?')) deleteMutation.mutate(p.id) }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </MagicCard>
              </motion.div>
            )
          })}

          {properties.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={Building2}
                title="No properties yet" aria-label="No properties yet"
                description="Add your first property to start managing bookings, tracking revenue, and monitoring occupancy."
                action={{ label: 'Add Property', onClick: openCreate }}
              />
            </div>
          )}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editProperty ? 'Edit Property' : 'Add Property'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Property Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['room','suite','apartment','villa','studio'].map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capacity (guests)</Label>
              <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Base Rate (per night) *</Label>
              <Input type="number" value={form.baseRate} onChange={(e) => setForm({ ...form, baseRate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { value: 'ACTIVE',      label: 'Active' },
                    { value: 'INACTIVE',    label: 'Inactive' },
                    { value: 'MAINTENANCE', label: 'Maintenance' },
                  ].map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Amenities (comma-separated)</Label>
              <Input value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} placeholder="WiFi, AC, TV, ..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editProperty ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
