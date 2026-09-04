'use client'

import { useQuery } from '@tanstack/react-query'
import { ScanLine, X, IdCard, Plane } from 'lucide-react'
import { CnicScanner, type CnicData } from '@/components/ui/CnicScanner'
import { PassportScanner, type PassportData } from '@/components/ui/PassportScanner'
import { cn } from '@/lib/utils'
import type { ScannedImage } from '@/types'
import { SCAN_LABELS, cnicComplete, passportComplete, scansOfKind, type ScanKind } from '@/lib/scans'

/**
 * The CNIC and the passport, each asked for only while it is missing.
 *
 * The two are independent: a Pakistani guest has no passport to scan and a
 * foreign guest has no CNIC, so neither absence should keep prompting once the
 * other is held. Whatever is already on file is shown as the image itself
 * rather than as a scanner the desk has to know to ignore.
 *
 * Shared by the guest profile and the booking form so both answer "has this
 * guest been scanned" the same way.
 */

export interface SavedScan {
  id: string
  kind?: string | null
  name: string
  mimeType: string
}

interface Props {
  /** The saved profile these scans belong to; absent for a guest not yet created. */
  guestId?: string | null
  /** Scans taken in this session, not yet uploaded. */
  pending: ScannedImage[]
  onCnic: (data: CnicData, scan?: ScannedImage) => void
  onPassport: (data: PassportData, scan?: ScannedImage) => void
  /** Drop a not-yet-saved scan so it can be retaken. */
  onDropPending: (kind: ScanKind) => void
  className?: string
}

export function GuestScans({ guestId, pending, onCnic, onPassport, onDropPending, className }: Props) {
  const { data } = useQuery({
    queryKey: ['guest-documents', guestId],
    queryFn: async () => {
      const res = await fetch(`/api/guests/${guestId}/documents`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: !!guestId,
  })
  const saved: SavedScan[] = data?.data || []

  /* Saved and just-taken scans answer the same question, so they are judged
     together — a scan taken a second ago must not re-prompt for the same card
     merely because the booking has not been saved yet. */
  const held = [
    ...saved.map(s => ({ kind: s.kind, url: `/api/guests/${guestId}/documents/${s.id}?inline=1`, saved: true as const })),
    ...pending.map(p => ({ kind: p.kind, url: p.previewUrl, saved: false as const })),
  ]

  const haveCnic = cnicComplete(held)
  const havePassport = passportComplete(held)

  return (
    <div className={cn('space-y-3', className)}>
      {haveCnic ? (
        <HeldCard
          title="CNIC"
          icon={IdCard}
          images={(['CNIC_FRONT', 'CNIC_BACK'] as ScanKind[]).flatMap(k => scansOfKind(held, k))}
          onRetake={() => { onDropPending('CNIC_FRONT'); onDropPending('CNIC_BACK') }}
          retakable={held.some(h => !h.saved && (h.kind === 'CNIC_FRONT' || h.kind === 'CNIC_BACK'))}
        />
      ) : (
        <CnicScanner onExtracted={onCnic} />
      )}

      {havePassport ? (
        <HeldCard
          title="Passport"
          icon={Plane}
          images={scansOfKind(held, 'PASSPORT')}
          onRetake={() => onDropPending('PASSPORT')}
          retakable={held.some(h => !h.saved && h.kind === 'PASSPORT')}
        />
      ) : (
        <PassportScanner onExtracted={onPassport} />
      )}
    </div>
  )
}

type HeldImage = { kind?: string | null; url?: string; saved: boolean }

function HeldCard({
  title, icon: Icon, images, onRetake, retakable,
}: {
  title: string
  icon: typeof IdCard
  images: HeldImage[]
  onRetake: () => void
  retakable: boolean
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title} on file
        <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400">
          <ScanLine className="h-3 w-3" />Scanned
        </span>
      </div>

      <div className={cn('grid gap-2', images.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
        {images.map((img, i) => (
          <a
            key={`${img.kind}-${i}`}
            href={img.url}
            target="_blank"
            rel="noreferrer"
            title={`Open the full-size ${SCAN_LABELS[img.kind as ScanKind] ?? title}`}
            className="group relative block overflow-hidden rounded-lg border bg-background"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a private,
                auth-gated blob from our own API, or a local blob: URL */}
            <img
              src={img.url}
              alt={SCAN_LABELS[img.kind as ScanKind] ?? title}
              className="h-24 w-full object-contain"
            />
            <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
              {SCAN_LABELS[img.kind as ScanKind] ?? title}
            </span>
          </a>
        ))}
      </div>

      {/* Only a scan taken in this session can be dropped here. A saved one is
          replaced by scanning again from the guest profile, which keeps the
          filing evidence from being deleted by a stray click on a booking. */}
      {retakable && (
        <button
          type="button"
          onClick={onRetake}
          className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />Retake
        </button>
      )}
    </div>
  )
}
