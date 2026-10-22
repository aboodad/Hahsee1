import { createContext, useContext, type HTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'
import { CheckCircle2, Loader2 } from 'lucide-react'

export type ReceiptPrinterStage = 'processing' | 'printing' | 'complete'
export type ReceiptFeedMotion = 'smooth' | 'stepped'

const Ctx = createContext<{ stage: ReceiptPrinterStage; feed: ReceiptFeedMotion; animate: boolean } | null>(null)
const useRP = (name: string) => {
  const c = useContext(Ctx)
  if (!c) throw new Error(`${name} must be used inside ReceiptPrinter.Root`)
  return c
}

// حافّة الورقة المسنّنة
const TEETH = 40, DEPTH = 4
const pts = Array.from({ length: TEETH * 2 }, (_, i) => `${100 - ((i + 1) * 100) / (TEETH * 2)}% ${i % 2 === 0 ? '100%' : `calc(100% - ${DEPTH}px)`}`).join(', ')
const CLIP = `polygon(0 0, 100% 0, 100% calc(100% - ${DEPTH}px), ${pts})`

// خروج الورقة سطراً بسطر
const STEPS = [-100, -91, -91, -81, -81, -70, -70, -58, -58, -45, -45, -32, -32, -20, -20, -10, -10, -3, -3, 0]
const TIMES = [0, 7.5, 10.5, 18, 21, 28.5, 31.5, 39, 42, 49.5, 52.5, 60, 63, 70.5, 73.5, 81, 84, 91.5, 94.5, 100]
const keyframes = `
@keyframes rp-feed-stepped{${STEPS.map((v, i) => `${TIMES[i]}%{transform:translateY(${v === -100 ? 'calc(-100% + 2px)' : v + '%'})}`).join('')}}
@keyframes rp-feed-smooth{from{transform:translateY(calc(-100% + 2px))}to{transform:translateY(0)}}
@keyframes rp-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.rp-feed,.rp-fade{animation:none !important;transform:none !important}}
`

export const STATUS_LABELS: Record<ReceiptPrinterStage, string> = {
  processing: 'جارٍ معالجة الطلب', printing: 'جارٍ طباعة الإيصال', complete: 'تمت العملية',
}

function Root({ stage, feedMotion = 'stepped', animate = true, className, children, ...p }:
  HTMLAttributes<HTMLElement> & { stage: ReceiptPrinterStage; feedMotion?: ReceiptFeedMotion; animate?: boolean }) {
  return (
    <Ctx.Provider value={{ stage, feed: feedMotion, animate }}>
      <style>{keyframes}</style>
      <section aria-label="طابعة الإيصال" data-stage={stage} className={clsx('relative isolate flex w-full max-w-sm flex-col items-center', className)} {...p}>
        {children}
      </section>
    </Ctx.Provider>
  )
}

function Machine({ className, children, ...p }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('relative isolate w-full overflow-hidden rounded-3xl border border-brand-950 bg-gradient-to-b from-brand-800 to-brand-900 p-3 pb-8 shadow-[0_20px_36px_-20px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.12)]', className)} {...p}>
      {children}
      <div aria-hidden className="absolute inset-x-6 bottom-3 z-40 h-2 rounded bg-brand-950 shadow-inner" />
    </div>
  )
}

function Header({ className, children, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('relative z-10 flex h-11 items-start justify-between', className)} {...p}>{children}</div>
}

function Screen({ className, children, ...p }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('relative isolate z-10 overflow-hidden rounded-2xl border border-brand-950 bg-brand-950 p-4 text-cream-100 shadow-inner', className)} {...p}>
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function Status({ children, className, ...p }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  const { stage, animate } = useRP('ReceiptPrinter.Status')
  return (
    <div className={clsx('flex min-w-0 items-center gap-2', className)} {...p}>
      <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center">
        {stage === 'complete'
          ? <CheckCircle2 className="h-[18px] w-[18px] text-emerald-400" />
          : <Loader2 className={clsx('h-[18px] w-[18px] text-cream-400', animate && 'animate-spin motion-reduce:animate-none')} />}
      </span>
      <div role="status" aria-live="polite" className="min-w-0 flex-1">
        <div key={stage} className={clsx('rp-fade truncate text-xs font-medium leading-none text-cream-300')} style={animate ? { animation: 'rp-fade 180ms cubic-bezier(.23,1,.32,1)' } : undefined}>
          {children ?? STATUS_LABELS[stage]}
        </div>
      </div>
    </div>
  )
}

function Paper({ className, style, children, ...p }: HTMLAttributes<HTMLElement>) {
  return (
    <article className={clsx('relative z-10 min-h-60 bg-cream-50 px-6 pb-8 pt-6 font-mono text-brand-900', className)} style={{ clipPath: CLIP, ...style }} {...p}>
      {children}
    </article>
  )
}

function Output({ className, children, ...p }: HTMLAttributes<HTMLDivElement>) {
  const { stage, feed, animate } = useRP('ReceiptPrinter.Output')
  const visible = stage !== 'processing'
  const printing = stage === 'printing' && animate
  return (
    <div className={clsx('relative z-50 -mt-4 h-[26rem] w-[calc(80%+3rem)] max-w-full overflow-hidden px-6', className)} {...p}>
      {visible && <div aria-hidden className="pointer-events-none absolute inset-x-6 -top-1 z-20 h-2 bg-brand-950/70 blur-[6px]" />}
      <div
        aria-hidden={stage !== 'complete'}
        className="rp-feed relative isolate drop-shadow-[0_8px_16px_rgba(0,0,0,.25)]"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible || !animate ? 'translateY(0)' : 'translateY(calc(-100% + 2px))',
          transition: animate ? 'opacity 160ms cubic-bezier(.23,1,.32,1)' : undefined,
          animation: printing ? (feed === 'stepped' ? 'rp-feed-stepped 1.75s linear forwards' : 'rp-feed-smooth 1.75s cubic-bezier(.77,0,.175,1) forwards') : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export const ReceiptPrinter = { Root, Machine, Header, Screen, Status, Output, Paper }
