'use client'

import { useRef, useState, DragEvent } from 'react'
import { ScanLine, Upload, X, Loader2, CheckCircle2, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export interface CnicData {
  cnic: string
  name: string
  father_name: string
  gender: string
  date_of_birth: string
  address: string
}

interface Props {
  onExtracted: (data: CnicData) => void
  className?: string
}

type SideState = 'idle' | 'scanning' | 'done' | 'error'

interface SideData {
  state: SideState
  preview: string | null
}

const EMPTY: SideData = { state: 'idle', preview: null }

export function CnicScanner({ onExtracted, className }: Props) {
  const [front, setFront] = useState<SideData>(EMPTY)
  const [back,  setBack]  = useState<SideData>(EMPTY)
  const [frontDrag, setFrontDrag] = useState(false)
  const [backDrag,  setBackDrag]  = useState(false)

  const frontRef = useRef<HTMLInputElement>(null)
  const backRef  = useRef<HTMLInputElement>(null)

  async function scan(file: File | Blob, side: 'front' | 'back', preview: string) {
    const set = side === 'front' ? setFront : setBack
    set({ preview, state: 'scanning' })

    const fd = new FormData()
    fd.append('file', file)
    fd.append('side', side)

    try {
      const res  = await fetch('/api/cnic-extract', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Extraction failed')

      // Emit result — applyScannedCnic uses `data.field || f.field` so
      // empty strings from this side won't overwrite values from the other side
      onExtracted(json.data ?? json)
      set(prev => ({ ...prev, state: 'done' }))
      toast.success(side === 'front' ? 'Front scanned — name & CNIC filled' : 'Back scanned — address filled')
    } catch (e: any) {
      set(prev => ({ ...prev, state: 'error' }))
      toast.error(e.message || `Could not read CNIC ${side}`)
    }
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') {
    const file = e.target.files?.[0]
    if (!file) return
    scan(file, side, URL.createObjectURL(file))
    e.target.value = ''
  }

  function drop(e: DragEvent<HTMLDivElement>, side: 'front' | 'back') {
    e.preventDefault()
    ;(side === 'front' ? setFrontDrag : setBackDrag)(false)
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please drop an image file')
      return
    }
    scan(file, side, URL.createObjectURL(file))
  }

  const bothDone = front.state === 'done' && back.state === 'done'

  return (
    <div className={cn('rounded-xl border bg-muted/30 p-4 space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ScanLine className="h-4 w-4 text-primary" />
        CNIC Scanner — upload front &amp; back to auto-fill guest fields
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Front */}
        <input ref={frontRef} type="file" accept="image/*" className="hidden" onChange={e => pickFile(e, 'front')} />
        <DropZone
          label="Front side"
          hint="CNIC No · Name · DOB"
          data={front}
          dragging={frontDrag}
          onClick={() => front.state !== 'scanning' && frontRef.current?.click()}
          onDrop={e => drop(e, 'front')}
          onDragOver={e => { e.preventDefault(); setFrontDrag(true) }}
          onDragLeave={() => setFrontDrag(false)}
          onReset={() => setFront(EMPTY)}
        />

        {/* Back */}
        <input ref={backRef} type="file" accept="image/*" className="hidden" onChange={e => pickFile(e, 'back')} />
        <DropZone
          label="Back side"
          hint="Address"
          data={back}
          dragging={backDrag}
          onClick={() => back.state !== 'scanning' && backRef.current?.click()}
          onDrop={e => drop(e, 'back')}
          onDragOver={e => { e.preventDefault(); setBackDrag(true) }}
          onDragLeave={() => setBackDrag(false)}
          onReset={() => setBack(EMPTY)}
        />
      </div>

      {bothDone && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900/40 px-3 py-2 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Both sides scanned — all guest fields populated
        </div>
      )}
    </div>
  )
}

// ── DropZone ─────────────────────────────────────────────────────────────────

interface DropZoneProps {
  label: string
  hint: string
  data: SideData
  dragging: boolean
  onClick: () => void
  onDrop: (e: DragEvent<HTMLDivElement>) => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onReset: () => void
}

function DropZone({ label, hint, data, dragging, onClick, onDrop, onDragOver, onDragLeave, onReset }: DropZoneProps) {
  const { state, preview } = data
  const scanning = state === 'scanning'
  const done     = state === 'done'
  const error    = state === 'error'

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed',
        'min-h-[120px] p-3 text-center gap-1.5 select-none transition-colors',
        !preview && 'cursor-pointer',
        dragging       && 'border-primary bg-primary/5',
        !dragging && !preview && 'border-border hover:border-primary/50 hover:bg-muted/50',
        preview        && 'border-transparent bg-card cursor-pointer',
      )}
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      {/* Background preview */}
      {preview && (
        <div className="absolute inset-0 rounded-lg overflow-hidden">
          <img src={preview} alt={label} className="w-full h-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-black/30 rounded-lg" />
        </div>
      )}

      {/* Content */}
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
            <span className={cn('text-[10px] font-bold tracking-widest', preview ? 'text-white/70' : 'text-muted-foreground')}>{label.toUpperCase()}</span>
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
            <span className="text-xs font-semibold">{label}</span>
            <span className="text-[10px] text-muted-foreground">{hint}</span>
            <span className="text-[10px] text-muted-foreground">Drop or click to upload</span>
          </>
        )}
      </div>

      {/* Reset × */}
      {(done || error) && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onReset() }}
          className="absolute top-1.5 right-1.5 z-20 h-5 w-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
