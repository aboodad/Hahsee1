import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { CheckCircle2, Undo2 } from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export type UndoInteraction = 'keyboard' | 'pointer'

/** إشعار «تم … — تراجع» بعدّاد يمتلئ حتى انتهاء المهلة */
export function UndoNotice({ className, duration = 5000, message = 'تم الحذف', onExpire, onUndo }: {
  className?: string; duration?: number; message?: string
  onExpire: () => void; onUndo: (input: UndoInteraction) => void
}) {
  const [counting, setCounting] = useState(false)
  const reduced = useReducedMotion()
  const expireRef = useRef(onExpire)
  expireRef.current = onExpire // يمنع إعادة ضبط المؤقت عند إعادة رسم الأب

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCounting(true))
    const timer = window.setTimeout(() => expireRef.current(), duration)
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer) }
  }, [duration])

  return (
    <div role="status" aria-live="polite"
      className={clsx('flex min-h-10 items-center justify-between gap-3 rounded-xl border border-cream-300 bg-cream-100 p-1 ps-3 shadow-lg', className)}>
      <div className="flex min-w-0 items-center gap-2">
        <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-emerald-600" />
        <p className="truncate text-xs font-semibold text-brand-800">{message}</p>
      </div>
      <button type="button" onClick={(e) => onUndo(e.detail === 0 ? 'keyboard' : 'pointer')}
        className="relative isolate flex h-8 min-w-20 items-center justify-center overflow-hidden rounded-lg border border-cream-400 bg-white px-3 text-xs font-semibold text-brand-700 outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-gold-500 active:scale-[0.97]">
        <span className="flex items-center gap-1.5"><Undo2 aria-hidden className="h-3.5 w-3.5" /> تراجع</span>
        <span aria-hidden className="absolute inset-0 flex items-center justify-center gap-1.5 bg-brand-800 px-3 text-cream-50"
          style={{
            clipPath: counting ? 'inset(0 0 0 100%)' : 'inset(0 0 0 0)',
            transitionDuration: reduced ? '0ms' : `${duration}ms`,
            transitionProperty: 'clip-path', transitionTimingFunction: 'linear',
          }}>
          <Undo2 aria-hidden className="h-3.5 w-3.5" /> تراجع
        </span>
      </button>
    </div>
  )
}
