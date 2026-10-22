import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import clsx from 'clsx'
import { CheckCircle2, File as FileIcon, FileArchive, FileText, FileUp, Image as ImageIcon, Upload, X } from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const MAGNET_DISTANCE = 180
const MAX_MAGNET_OFFSET = 10
const IDLE = { x: 0, y: 0, s: 1, gx: 0, gy: 0 }

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const v = bytes / 1024 ** i
  return `${v >= 10 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`
}
function iconFor(file: File) {
  if (file.type.startsWith('image/')) return ImageIcon
  if (file.type === 'application/pdf') return FileText
  if (file.type.includes('zip') || file.name.toLowerCase().endsWith('.zip')) return FileArchive
  return FileIcon
}
const isFileDrag = (dt: DataTransfer | null) => (dt ? Array.from(dt.types).includes('Files') : false)
function acceptsFile(file: File, accept: string) {
  if (!accept.trim()) return true
  const name = file.name.toLowerCase(); const type = file.type.toLowerCase()
  return accept.split(',').map((r) => r.trim().toLowerCase()).some((r) =>
    r.startsWith('.') ? name.endsWith(r) : r.endsWith('/*') ? type.startsWith(r.slice(0, -1)) : type === r)
}

/** منطقة رفع ملفات «مغناطيسية»: تنجذب نحو الملف أثناء سحبه من أي مكان في الصفحة */
export function MagneticDropZone({ accept = 'image/*,.pdf', className, maxSize = 10 * 1024 * 1024, multiple = false, onFilesChange }: {
  accept?: string; className?: string; maxSize?: number; multiple?: boolean; onFilesChange?: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const zoneRef = useRef<HTMLDivElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [near, setNear] = useState(false)
  const [over, setOver] = useState(false)
  const [mag, setMag] = useState(IDLE)
  const [error, setError] = useState<string | null>(null)
  const reduced = useReducedMotion()

  const reset = useCallback(() => { setMag(IDLE); setNear(false); setOver(false) }, [])

  useEffect(() => {
    const onWindowDragOver = (e: globalThis.DragEvent) => {
      if (!isFileDrag(e.dataTransfer)) return
      const zone = zoneRef.current
      if (!zone) return
      const r = zone.getBoundingClientRect()
      const cx = r.left + r.width / 2; const cy = r.top + r.height / 2
      const dx = Math.max(Math.abs(e.clientX - cx) - r.width / 2, 0)
      const dy = Math.max(Math.abs(e.clientY - cy) - r.height / 2, 0)
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      const proximity = Math.max(0, 1 - Math.hypot(dx, dy) / MAGNET_DISTANCE)
      if (proximity === 0) return reset()
      const vx = e.clientX - cx; const vy = e.clientY - cy
      const dist = Math.max(Math.hypot(vx, vy), 1)
      const off = inside ? 0 : proximity * MAX_MAGNET_OFFSET
      setMag(reduced ? IDLE : { x: (vx / dist) * off, y: (vy / dist) * off, s: inside ? 1.025 : 1.01, gx: vx, gy: vy })
      setNear(true); setOver(inside)
    }
    window.addEventListener('dragover', onWindowDragOver)
    window.addEventListener('dragend', reset)
    window.addEventListener('drop', reset)
    return () => {
      window.removeEventListener('dragover', onWindowDragOver)
      window.removeEventListener('dragend', reset)
      window.removeEventListener('drop', reset)
    }
  }, [reduced, reset])

  const accepted = useCallback((incoming: File[]) => {
    const next = multiple ? incoming : incoming.slice(0, 1)
    const bad = next.find((f) => !acceptsFile(f, accept))
    const big = next.find((f) => f.size > maxSize)
    if (bad) { setFiles([]); setError(`«${bad.name}» نوع ملف غير مدعوم`); onFilesChange?.([]); return }
    if (big) { setFiles([]); setError(`«${big.name}» أكبر من ${formatBytes(maxSize)}`); onFilesChange?.([]); return }
    if (!next.length) return
    setFiles(next); setError(null); onFilesChange?.(next)
  }, [accept, maxSize, multiple, onFilesChange])

  const onDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); accepted(Array.from(e.dataTransfer.files)); reset() }
  const onDragOver = (e: DragEvent<HTMLDivElement>) => { if (!isFileDrag(e.dataTransfer)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }
  const onInput = (e: ChangeEvent<HTMLInputElement>) => { accepted(Array.from(e.target.files ?? [])); e.target.value = '' }
  const pick = () => inputRef.current?.click()
  const clear = () => { setFiles([]); setError(null); onFilesChange?.([]) }

  const first = files[0]
  const TypeIcon = first ? iconFor(first) : FileIcon
  const title = over ? 'أفلت الملف الآن' : near ? 'قرّب الملف أكثر' : 'اسحب الملف هنا'
  const ease = 'cubic-bezier(0.23, 1, 0.32, 1)'
  const smallBtn = 'flex h-8 items-center gap-1.5 rounded-lg border border-cream-400 bg-white px-3 text-xs font-semibold text-brand-700 transition active:scale-[0.97] hover:bg-cream-100'

  return (
    <div
      ref={zoneRef} onDragOver={onDragOver} onDrop={onDrop}
      className={clsx(
        'relative flex min-h-44 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-5 py-6 text-center outline-none',
        over ? 'border-gold-500 bg-gold-50' : near ? 'border-gold-400 bg-cream-100' : 'border-cream-400 bg-cream-100/70', className)}
      style={{
        transform: reduced ? undefined : `translate3d(${mag.x}px, ${mag.y}px, 0) scale(${mag.s})`,
        transition: `transform 280ms ${ease}, border-color 200ms ${ease}, background-color 200ms ${ease}`,
      }}
    >
      <input ref={inputRef} type="file" hidden accept={accept} multiple={multiple} onChange={onInput} />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -ml-20 -mt-20 h-40 w-40 rounded-full bg-gold-400/30 blur-3xl"
        style={{ opacity: near ? 1 : 0, transform: `translate3d(${reduced ? 0 : mag.gx}px, ${reduced ? 0 : mag.gy}px, 0)`, transition: `transform 280ms ${ease}, opacity 200ms` }} />

      {first ? (
        <div className="relative flex w-full flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-gold-400 bg-gold-100 text-brand-700 shadow-sm"><TypeIcon aria-hidden className="h-6 w-6" /></div>
          <div className="mt-3 flex items-center gap-1.5">
            <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-semibold text-brand-800">{files.length === 1 ? 'جاهز للرفع' : `${files.length} ملفات جاهزة`}</p>
          </div>
          <p className="mt-1 max-w-full truncate text-sm text-stone-600" dir="auto">{first.name}{files.length > 1 ? ` +${files.length - 1}` : ''}</p>
          <p className="mt-0.5 text-[10px] uppercase text-stone-400" dir="ltr">{formatBytes(first.size)}</p>
          <div className="mt-4 flex items-center gap-2">
            <button type="button" className={smallBtn} onClick={pick}><Upload aria-hidden className="h-3.5 w-3.5" /> استبدال</button>
            <button type="button" className={smallBtn} aria-label={`إزالة ${first.name}`} onClick={clear}><X aria-hidden className="h-3.5 w-3.5" /> إزالة</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={pick}
          className="relative flex flex-col items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cream-400 bg-white text-brand-600 shadow-sm">
            <FileUp aria-hidden className={clsx('h-6 w-6 transition-colors', near && 'text-gold-600')} />
          </div>
          <p className="mt-3 text-sm font-semibold text-brand-800">{title}</p>
          <p className="mt-1 text-xs text-stone-500">أو اضغط للاختيار · حتى {formatBytes(maxSize)}</p>
        </button>
      )}
      {error && <p aria-live="polite" className="relative mt-3 max-w-64 text-xs text-red-600">{error}</p>}
    </div>
  )
}
