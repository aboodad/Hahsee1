import { Check, Eye, ShoppingCart } from 'lucide-react'
import { ReceiptPrinter, type ReceiptPrinterStage } from '@/components/shared/ReceiptPrinter'
import { Button } from '@/components/ui/Button'
import { fmtMoney, fmtNum } from '@/lib/formatters'
import { useCompany } from '@/hooks/useLookups'

export interface SaleProgressState {
  stage: ReceiptPrinterStage
  total: number
  invoice_no?: string
  paid?: number
  change?: number
  remaining?: number
  lines: { name: string; qty: number; total: number }[]
}

/** شاشة إتمام البيع: معالجة ← طباعة الإيصال ← اكتمال */
export function SaleProgress({ state, canView, onView, onClose }: {
  state: SaleProgressState; canView: boolean; onView: () => void; onClose: () => void
}) {
  const { data: company } = useCompany()
  const done = state.stage === 'complete'
  const shown = state.lines.slice(0, 5)
  const hidden = state.lines.length - shown.length

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-brand-950/70 p-4 backdrop-blur-sm">
      <ReceiptPrinter.Root stage={state.stage}>
        <ReceiptPrinter.Machine>
          <ReceiptPrinter.Header>
            {company?.logo_url
              ? <img src={company.logo_url} alt="" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5" />
              : <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold-300 to-gold-600 text-sm font-bold text-brand-950">هـ</div>}
            <Button size="sm" variant="gold" onClick={done || !canView ? onClose : onView} disabled={state.stage === 'processing'}>
              {done ? <><ShoppingCart className="h-3.5 w-3.5" /> بيع جديد</> : 'تخطي'}
            </Button>
          </ReceiptPrinter.Header>
          <ReceiptPrinter.Screen>
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div><p className="text-sm font-semibold">{company?.name ?? 'هاشم للطيب والعطور'}</p><p className="text-xs text-cream-400">نقطة البيع</p></div>
                <div className="text-end"><p className="text-[10px] text-cream-400">الإجمالي</p><strong className="text-lg">{fmtMoney(state.total)}</strong></div>
              </div>
              <ReceiptPrinter.Status />
            </div>
          </ReceiptPrinter.Screen>
        </ReceiptPrinter.Machine>

        <ReceiptPrinter.Output>
          <ReceiptPrinter.Paper>
            <div className="text-center">
              <h2 className="text-sm font-bold">{company?.name ?? 'هاشم للطيب والعطور'}</h2>
              <p className="mt-0.5 text-[11px] opacity-70" dir="ltr">{state.invoice_no ?? ''}</p>
            </div>
            <hr className="my-3 border-dashed border-brand-300" />
            <ul className="space-y-1.5 text-xs">
              {shown.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate">{l.name} × {fmtNum(l.qty)}</span><span dir="ltr">{fmtMoney(l.total, false)}</span>
                </li>
              ))}
              {hidden > 0 && <li className="text-center opacity-60">+ {hidden} أصناف أخرى</li>}
            </ul>
            <hr className="my-3 border-dashed border-brand-300" />
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between text-sm font-bold"><dt>الإجمالي</dt><dd>{fmtMoney(state.total)}</dd></div>
              {state.paid != null && <div className="flex justify-between"><dt>المدفوع</dt><dd>{fmtMoney(state.paid)}</dd></div>}
              {!!state.change && <div className="flex justify-between"><dt>الباقي للعميل</dt><dd>{fmtMoney(state.change)}</dd></div>}
              {!!state.remaining && <div className="flex justify-between text-red-700"><dt>المتبقي (آجل)</dt><dd>{fmtMoney(state.remaining)}</dd></div>}
            </dl>
            <p className="mt-4 flex items-center justify-center gap-1 text-center text-[11px] opacity-70"><Check className="h-3 w-3" /> شكراً لتعاملكم معنا</p>
            {done && canView && (
              <div className="mt-4 flex justify-center">
                <Button size="sm" variant="secondary" onClick={onView}><Eye className="h-3.5 w-3.5" /> عرض الفاتورة للطباعة</Button>
              </div>
            )}
          </ReceiptPrinter.Paper>
        </ReceiptPrinter.Output>
      </ReceiptPrinter.Root>
    </div>
  )
}
