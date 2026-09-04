'use client'

import { useRef, useState, DragEvent } from 'react'
import { ScanLine, Upload, X, Loader2, CheckCircle2, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScannedImage } from '@/types'
import { SCAN_LABELS } from '@/lib/scans'
import toast from 'react-hot-toast'

export interface PassportData {
  passport_number: string
  name: string
  nationality: string
  gender: string
  date_of_birth: string
  expiry_date: string
}

interface Props {
  onExtracted: (data: PassportData, scan?: ScannedImage) => void
  className?: string
}

type ScanState = 'idle' | 'scanning' | 'done' | 'error'

const EMPTY: { state: ScanState; preview: string | null } = { state: 'idle', preview: null }

export function PassportScanner({ onExtracted, className }: Props) {
  const [data, setData] = useState(EMPTY)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function scan(file: File | Blob, preview: string) {
    setData({ preview, state: 'scanning' })

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res  = await fetch('/api/passport-extract', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Extraction failed')

      // The image rides along so it can be filed against the booking
      onExtracted(json.data ?? json, { file, kind: 'PASSPORT', label: SCAN_LABELS.PASSPORT, previewUrl: preview })
      setData(prev => ({ ...prev, state: 'done' }))
      toast.success('Passport scanned — guest fields filled')
    } catch (e: any) {
      setData(prev => ({ ...prev, state: 'error' }))
      toast.error(e.message || 'Could not read passport')
    }
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    scan(file, URL.createObjectURL(file))
    e.target.value = ''
  }

  function drop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please drop an image file')
      return
    }
    scan(file, URL.createObjectURL(file))
  }

  const { state, preview } = data
  const scanning = state === 'scanning'
  const done     = state === 'done'
  const error    = state === 'error'

  return (
    <div className={cn('rounded-xl border bg-muted/30 p-4 space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ScanLine className="h-4 w-4 text-primary" />
        Passport Scanner — upload the bio/data page to auto-fill guest fields
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
      <div
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed',
          'min-h-[120px] p-3 text-center gap-1.5 select-none transition-colors',
          !preview && 'cursor-pointer',
          dragging       && 'border-primary bg-primary/5',
          !dragging && !preview && 'border-border hover:border-primary/50 hover:bg-muted/50',
          preview        && 'border-transparent bg-card cursor-pointer',
        )}
        onClick={() => state !== 'scanning' && inputRef.current?.click()}
        onDrop={drop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
      >
        {preview && (
          <div className="absolute inset-0 rounded-lg overflow-hidden">
            <img src={preview} alt="Passport" className="w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0 bg-black/30 rounded-lg" />
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center gap-1">
          {scanning && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Reading…</span>
            </>
          )}
          {done && (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-xs font-medium text-green-600 dark:text-green-400">Scanned</span>
              <span className={cn('text-[10px] font-bold tracking-widest', preview ? 'text-white/70' : 'text-muted-foreground')}>PASSPORT</span>
            </>
          )}
          {error && (
            <>
              <X className="h-5 w-5 text-destructive" />
              <span className="text-xs text-destructive">Failed</span>
              <span className="text-[10px] text-muted-foreground">Click to retry</span>
            </>
          )}
          {state === 'idle' && (
            <>
              {dragging
                ? <Upload className="h-5 w-5 text-primary" />
                : <ImageIcon className="h-5 w-5 text-muted-foreground" />
              }
              <span className="text-xs font-semibold">Bio / data page</span>
              <span className="text-[10px] text-muted-foreground">Passport # · Name · Nationality · Expiry</span>
              <span className="text-[10px] text-muted-foreground">Drop or click to upload</span>
            </>
          )}
        </div>

        {(done || error) && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setData(EMPTY) }}
            className="absolute top-1.5 right-1.5 z-20 h-5 w-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}
