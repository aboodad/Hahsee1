import {
  useCallback, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode,
} from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export type ConfirmationInput = 'keyboard' | 'pointer'
type HoldStatus = 'confirmed' | 'holding' | 'idle'

const TONES = {
  danger: {
    base: 'border-red-600 bg-red-50 text-red-800 focus-visible:ring-red-400',
    fill: 'bg-red-700 text-white',
    done: 'bg-red-700 text-white',
  },
  brand: {
    base: 'border-brand-600 bg-cream-100 text-brand-800 focus-visible:ring-gold-500',
    fill: 'bg-brand-700 text-cream-50',
    done: 'bg-brand-700 text-cream-50',
  },
} as const

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'> {
  children?: ReactNode
  confirmedContent?: ReactNode
  /** مدة الضغط المستمر بالملّي ثانية */
  duration?: number
  tone?: keyof typeof TONES
  onConfirm: (input: ConfirmationInput) => void
  resetAfter?: number
}

/** زر «اضغط مطوّلاً للتأكيد»: يمتلئ أثناء الضغط ويُنفَّذ عند اكتمال المدة. يعمل بالفأرة واللمس ولوحة المفاتيح (Enter / Space) */
export function HoldToConfirmButton({
  children = 'اضغط مطوّلاً للتأكيد', className, confirmedContent, disabled, duration = 1600,
  tone = 'danger', onConfirm, resetAfter = 1800, ...buttonProps
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const confirmTimer = useRef<number | null>(null)
  const resetTimer = useRef<number | null>(null)
  const pointerId = useRef<number | null>(null)
  const inputRef = useRef<ConfirmationInput>('pointer')
  const holding = useRef(false)
  const [input, setInput] = useState<ConfirmationInput | null>(null)
  const [status, setStatus] = useState<HoldStatus>('idle')
  const reduced = useReducedMotion()
  const t = TONES[tone]

  const clearConfirm = useCallback(() => {
    if (confirmTimer.current !== null) { window.clearTimeout(confirmTimer.current); confirmTimer.current = null }
  }, [])

  const complete = useCallback(() => {
    if (!holding.current) return
    holding.current = false; pointerId.current = null; clearConfirm()
    setStatus('confirmed'); onConfirm(inputRef.current)
    if (resetAfter > 0) resetTimer.current = window.setTimeout(() => { setStatus('idle'); resetTimer.current = null }, resetAfter)
  }, [clearConfirm, onConfirm, resetAfter])

  const cancel = useCallback(() => {
    if (!holding.current) return
    holding.current = false; pointerId.current = null; clearConfirm(); setStatus('idle')
  }, [clearConfirm])

  const start = useCallback((mode: ConfirmationInput) => {
    if (disabled || status === 'confirmed' || holding.current) return
    if (resetTimer.current !== null) { window.clearTimeout(resetTimer.current); resetTimer.current = null }
    inputRef.current = mode; setInput(mode); holding.current = true; setStatus('holding')
    confirmTimer.current = window.setTimeout(complete, duration)
  }, [complete, disabled, duration, status])

  useEffect(() => () => {
    clearConfirm()
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
  }, [clearConfirm])
  useEffect(() => { if (disabled) cancel() }, [cancel, disabled])

  const releaseCapture = (id: number) => {
    const b = buttonRef.current
    if (b?.hasPointerCapture(id)) b.releasePointerCapture(id)
  }
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (!e.isPrimary || e.button !== 0 || disabled) return
    pointerId.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    start('pointer')
  }
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!holding.current || pointerId.current !== e.pointerId) return
    const r = e.currentTarget.getBoundingClientRect(); const pad = 8
    if (e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) {
      cancel(); releaseCapture(e.pointerId)
    }
  }
  const onPointerEnd = (e: PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== e.pointerId) return
    cancel(); releaseCapture(e.pointerId)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault(); start('keyboard')
  }
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault(); cancel()
  }

  const confirmed = status === 'confirmed'
  const isHolding = status === 'holding'
  // الامتلاء يبدأ من جهة البداية (يمين في RTL)
  const overlay = {
    clipPath: isHolding ? 'inset(0 0 0 0)' : 'inset(0 0 0 100%)',
    transitionDuration: reduced || input === 'keyboard' ? '0ms' : isHolding ? `${duration}ms` : '180ms',
    transitionProperty: 'clip-path',
    transitionTimingFunction: isHolding ? 'linear' : 'cubic-bezier(0.23, 1, 0.32, 1)',
  } as const

  return (
    <button
      {...buttonProps}
      ref={buttonRef}
      type="button"
      aria-busy={isHolding}
      disabled={disabled}
      data-input={input}
      onBlur={cancel}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onLostPointerCapture={cancel}
      onPointerCancel={onPointerEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      className={clsx(
        'relative isolate inline-flex h-10 min-w-44 touch-none select-none items-center justify-center overflow-hidden rounded-xl border px-4 text-sm font-semibold outline-none transition-[transform,background-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 data-[input=pointer]:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        t.base, confirmed && t.done, className,
      )}
    >
      {confirmed ? (
        <span className="relative flex items-center justify-center gap-1.5">
          {confirmedContent ?? (<><Check aria-hidden className="h-4 w-4" strokeWidth={3} /> تم التأكيد</>)}
        </span>
      ) : (
        <>
          <span className="relative flex items-center justify-center gap-1.5">{children}</span>
          <span aria-hidden className={clsx('absolute inset-0 flex items-center justify-center gap-1.5 px-4', t.fill)} style={overlay}>
            {children}
          </span>
        </>
      )}
    </button>
  )
}
