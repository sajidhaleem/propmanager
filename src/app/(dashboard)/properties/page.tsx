'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Home, Users, DollarSign, Activity } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatCurrency, getStatusColor } from '@/lib/utils'
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
  const queryClient = useQueryClient()
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
          {properties.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="relative group overflow-hidden">
                <div className={`h-2 ${['bg-blue-500','bg-green-500','bg-purple-500','bg-orange-500'][i % 4]}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Home className="h-5 w-5 text-primary" />
                    </div>
                    <Badge className={getStatusColor(p.status)} variant="outline">{p.status}</Badge>
                  </div>
                  <CardTitle className="text-base mt-2">{p.name}</CardTitle>
                  {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                </CardHeader>
                <CardContent className="pb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> {p.capacity} guests
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" /> {formatCurrency(p.baseRate)}/night
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" /> {p._count?.bookings || 0} bookings
                    </div>
                    <div className="text-muted-foreground capitalize">{p.type}</div>
                  </div>
                  {p.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.amenities.slice(0, 3).map((a) => (
                        <span key={a} className="text-xs bg-muted px-1.5 py-0.5 rounded">{a}</span>
                      ))}
                      {p.amenities.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{p.amenities.length - 3}</span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(p)}>
                      <Edit className="h-3.5 w-3.5" />Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm('Delete property?')) deleteMutation.mutate(p.id) }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {properties.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No properties yet. Add your first property.
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
                  {['room','suite','apartment','villa','studio'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capacity (guests)</Label>
              <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Base Rate ($/night) *</Label>
              <Input type="number" value={form.baseRate} onChange={(e) => setForm({ ...form, baseRate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['ACTIVE','INACTIVE','MAINTENANCE'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
