'use client'

import { useRef, useState, useCallback } from 'react'
import { ScanLine, Camera, Upload, X, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

export function CnicScanner({ onExtracted, className }: Props) {
  const [mode, setMode] = useState<'idle' | 'uploading' | 'webcam' | 'scanning' | 'done'>('idle')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const scanImage = useCallback(async (file: File | Blob) => {
    setMode('scanning')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/cnic-extract', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Extraction failed')
      onExtracted(json.data ?? json)
      setMode('done')
      toast.success('CNIC scanned — fields filled')
    } catch (e: any) {
      toast.error(e.message || 'Could not read CNIC')
      setMode('idle')
    }
  }, [onExtracted])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setMode('uploading')
    scanImage(file)
    e.target.value = ''
  }

  async function startWebcam() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setStream(s)
      setMode('webcam')
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s }, 100)
    } catch {
      toast.error('Camera not available')
    }
  }

  function captureWebcam() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const url = canvas.toDataURL('image/jpeg', 0.92)
    setPreviewUrl(url)
    stream?.getTracks().forEach(t => t.stop())
    setStream(null)
    canvas.toBlob(blob => { if (blob) scanImage(blob) }, 'image/jpeg', 0.92)
  }

  function reset() {
    stream?.getTracks().forEach(t => t.stop())
    setStream(null)
    setPreviewUrl(null)
    setMode('idle')
  }

  return (
    <div className={cn('rounded-xl border bg-muted/30 p-4 space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ScanLine className="h-4 w-4 text-primary" />
        CNIC Scanner — scan ID to auto-fill guest fields
      </div>

      {/* Webcam view */}
      {mode === 'webcam' && (
        <div className="space-y-2">
          <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg border bg-black max-h-48 object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <Button size="sm" onClick={captureWebcam} className="flex-1">Capture</Button>
            <Button size="sm" variant="outline" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Scanning / preview */}
      {(mode === 'uploading' || mode === 'scanning') && previewUrl && (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <img src={previewUrl} alt="CNIC" className="h-16 w-24 rounded object-cover border shrink-0" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Reading CNIC with Claude Vision…
          </div>
        </div>
      )}

      {/* Done */}
      {mode === 'done' && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900/40 p-3">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            CNIC read — guest fields populated below
          </div>
          <Button size="sm" variant="ghost" onClick={reset} className="h-7 w-7 p-0 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Actions */}
      {(mode === 'idle' || mode === 'done') && (
        <div className="flex gap-2 flex-wrap">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Upload CNIC Photo
          </Button>
          <Button size="sm" variant="outline" onClick={startWebcam} className="gap-1.5">
            <Camera className="h-3.5 w-3.5" /> Use Camera
          </Button>
        </div>
      )}
    </div>
  )
}
