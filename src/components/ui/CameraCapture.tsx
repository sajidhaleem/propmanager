'use client'

import { useRef } from 'react'
import { Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * "Take photo" for the document scanners.
 *
 * A plain file input with `capture="environment"`, which hands the job to the
 * phone's own camera app — no getUserMedia, no permission prompt of our own, no
 * video surface to keep alive while a dialog scrolls underneath it. The photo
 * arrives as a File and goes down exactly the same path as an uploaded one.
 *
 * It is a second control rather than an attribute on the existing input,
 * because `capture` removes the gallery and files choice: adding it to the
 * upload input would take away the ability to attach a photo taken earlier.
 *
 * Shown on coarse pointers only. On a desktop the attribute is ignored and the
 * button would open the same file picker the drop zone already opens.
 */
export function CameraCapture({
  onCapture,
  label = 'Take photo',
  disabled,
  className,
}: {
  onCapture: (file: File) => void
  label?: string
  disabled?: boolean
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onCapture(file)
          // cleared so retaking the same shot still fires a change event
          e.target.value = ''
        }}
      />
      <button
        type="button"
        disabled={disabled}
        /* The drop zones are themselves clickable, and their handler opens the
           upload picker — without this the camera button would open both. */
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
        className={cn(
          'hidden [@media(pointer:coarse)]:inline-flex items-center gap-1.5',
          'rounded-full border border-border/70 bg-background/80 px-2.5 py-1',
          'text-[11px] font-medium text-foreground/80',
          'active:scale-[0.97] transition-transform disabled:opacity-50',
          className,
        )}
      >
        <Camera className="h-3.5 w-3.5 shrink-0" />
        {label}
      </button>
    </>
  )
}
