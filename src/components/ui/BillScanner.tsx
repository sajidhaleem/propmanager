'use client'

import { useRef, useState, DragEvent } from 'react'
import { ScanLine, Upload, X, Loader2, CheckCircle2, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export interface ScannedBill {
  vendor: string
  amount: string
  date: string
  category: string
  subcategory: string
  description: string
  receiptData: string
  receiptMimeType: string
  receiptName: string
}

interface Props {
  onExtracted: (data: ScannedBill) => void
  className?: string
}

type State = 'idle' | 'scanning' | 'done' | 'error'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function BillScanner({ onExtracted, className }: Props) {
  const [state, setState] = useState<State>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function scan(file: File) {
    if (file.size > 8 * 1024 * 1024) { toast.error('Image too large (max 8MB)'); return }
    setPreview(URL.createObjectURL(file))
    setState('scanning')

    try {
      const [base64, extractRes] = await Promise.all([
        fileToBase64(file),
        (async () => {
          const fd = new FormData()
          fd.append('file', file)
          const res = await fetch('/api/expense-extract', { method: 'POST', body: fd })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error || 'Extraction failed')
          return json.data ?? json
        })(),
      ])

      onExtracted({
        vendor: extractRes.vendor || '',
        amount: extractRes.amount || '',
        date: extractRes.date || '',
        category: extractRes.category || 'OTHER',
        subcategory: extractRes.subcategory || '',
        description: extractRes.description || '',
        receiptData: base64,
        receiptMimeType: file.type || 'image/jpeg',
        receiptName: file.name,
      })
      setState('done')
      toast.success('Bill scanned — fields filled in below')
    } catch (e: any) {
      setState('error')
      toast.error(e.message || 'Could not read bill')
    }
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) scan(file)
    e.target.value = ''
  }

  function drop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) { toast.error('Please drop an image file'); return }
    scan(file)
  }

  const scanning = state === 'scanning'
  const done = state === 'done'
  const error = state === 'error'

  return (
    <div className={cn('rounded-xl border bg-muted/30 p-4 space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ScanLine className="h-4 w-4 text-primary" />
        Scan Bill — upload a photo to auto-fill vendor, amount, date &amp; category
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
      <div
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed',
          'min-h-[110px] p-3 text-center gap-1.5 select-none transition-colors cursor-pointer',
          dragging       && 'border-primary bg-primary/5',
          !dragging && !preview && 'border-border hover:border-primary/50 hover:bg-muted/50',
          preview        && 'border-transparent bg-card',
        )}
        onClick={() => state !== 'scanning' && inputRef.current?.click()}
        onDrop={drop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
      >
        {preview && (
          <div className="absolute inset-0 rounded-lg overflow-hidden">
            <img src={preview} alt="Bill preview" className="w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0 bg-black/30 rounded-lg" />
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center gap-1">
          {scanning && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Reading bill…</span>
            </>
          )}
          {done && (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-xs font-medium text-green-600 dark:text-green-400">Scanned — click to rescan</span>
            </>
          )}
          {error && (
            <>
              <X className="h-5 w-5 text-destructive" />
              <span className="text-xs text-destructive">Couldn't read that bill</span>
              <span className="text-[10px] text-muted-foreground">Click to try again</span>
            </>
          )}
          {state === 'idle' && (
            <>
              {dragging ? <Upload className="h-5 w-5 text-primary" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
              <span className="text-xs font-semibold">Bill / Receipt photo</span>
              <span className="text-[10px] text-muted-foreground">Drop or click to upload</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
