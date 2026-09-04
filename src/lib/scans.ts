/**
 * Which card a scanned image is.
 *
 * The desk is asked to scan a CNIC only while there is no CNIC on file, and
 * that question is entirely separate from the passport one — a Pakistani guest
 * has no passport to scan and a foreign guest has no CNIC. Counting documents
 * without knowing their kind would keep asking for a card that is already held.
 */
export type ScanKind = 'CNIC_FRONT' | 'CNIC_BACK' | 'PASSPORT'

export const SCAN_KINDS: ScanKind[] = ['CNIC_FRONT', 'CNIC_BACK', 'PASSPORT']

export const SCAN_LABELS: Record<ScanKind, string> = {
  CNIC_FRONT: 'CNIC front',
  CNIC_BACK: 'CNIC back',
  PASSPORT: 'Passport',
}

export function isScanKind(v: unknown): v is ScanKind {
  return typeof v === 'string' && (SCAN_KINDS as string[]).includes(v)
}

export interface ScanRecord {
  id?: string
  kind?: string | null
  /** Blob URL for a scan taken in this session, before it has been saved. */
  previewUrl?: string
}

/** The scans held for one card type, whether already saved or taken just now. */
export function scansOfKind<T extends ScanRecord>(scans: T[], kind: ScanKind): T[] {
  return scans.filter(s => s.kind === kind)
}

export function hasKind(scans: ScanRecord[], kind: ScanKind): boolean {
  return scans.some(s => s.kind === kind)
}

/** A CNIC needs both sides; either one alone still leaves the card incomplete. */
export function cnicComplete(scans: ScanRecord[]): boolean {
  return hasKind(scans, 'CNIC_FRONT') && hasKind(scans, 'CNIC_BACK')
}

export function passportComplete(scans: ScanRecord[]): boolean {
  return hasKind(scans, 'PASSPORT')
}

/**
 * Whether there is any card on file at all. This is what "the guest has been
 * scanned" means for the filing checklist — one document is enough evidence,
 * and demanding both would mark every foreign guest incomplete forever.
 */
export function anyScan(scans: ScanRecord[]): boolean {
  return scans.length > 0
}
