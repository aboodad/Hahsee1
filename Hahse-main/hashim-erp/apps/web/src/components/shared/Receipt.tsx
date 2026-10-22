import { fmtDateTime, fmtMoney, fmtNum } from '@/lib/formatters'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useCompany, useSetting } from '@/hooks/useLookups'
import { Printer, Share2 } from 'lucide-react'
import { shareText } from '@/lib/platform'

export interface ReceiptData {
  invoice_no: string; invoice_date: string; branch?: string; cashier?: string; customer?: string
  items: { name: string; qty: number; unit_price: number; line_total: number }[]
  subtotal: number; discount: number; tax_amount: number; total: number
  paid_amount: number; change_amount: number; remaining: number
  payments?: { method: string; amount: number }[]
}

export function ReceiptModal({ data, onClose }: { data: ReceiptData | null; onClose: () => void }) {
  const { data: company } = useCompany()
  const { data: printCfg } = useSetting<{ paper?: string }>('invoice.print', { paper: '80mm' })
  const a4 = printCfg?.paper === 'A4'
  if (!data) return null

  const asText = () =>
    [`${company?.name ?? ''}`, `فاتورة ${data.invoice_no}`, fmtDateTime(data.invoice_date),
      ...data.items.map((i) => `${i.name} × ${fmtNum(i.qty)} = ${fmtMoney(i.line_total)}`),
      `الإجمالي: ${fmtMoney(data.total)}`].join('\n')

  return (
    <Modal open onClose={onClose} title={`فاتورة ${data.invoice_no}`} size="sm"
      footer={<>
        <Button variant="secondary" onClick={() => shareText(`فاتورة ${data.invoice_no}`, asText())}><Share2 className="h-4 w-4" /> مشاركة</Button>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة</Button>
      </>}>
      <div id="print-area" style={{ width: a4 ? '190mm' : '80mm' }} className={`mx-auto w-full ${a4 ? 'max-w-[560px] text-[13px]' : 'max-w-[300px] text-[12px]'} leading-5`}>
        <div className="text-center">
          {company?.logo_url && <img src={company.logo_url} alt="" className="mx-auto mb-1 h-12" />}
          <div className="text-base font-bold">{company?.name ?? 'هاشم للطيب والعطور'}</div>
          {company?.phone && <div>{company.phone}</div>}
          {company?.tax_number && <div>الرقم الضريبي: {company.tax_number}</div>}
        </div>
        <hr className="my-2 border-dashed" />
        <div>رقم الفاتورة: <b>{data.invoice_no}</b></div>
        <div>التاريخ: {fmtDateTime(data.invoice_date)}</div>
        {data.branch && <div>الفرع: {data.branch}</div>}
        {data.cashier && <div>البائع: {data.cashier}</div>}
        {data.customer && <div>العميل: {data.customer}</div>}
        <hr className="my-2 border-dashed" />
        <table className="w-full">
          <thead><tr className="border-b border-dashed"><th className="text-start">الصنف</th><th>كمية</th><th className="text-end">المبلغ</th></tr></thead>
          <tbody>
            {data.items.map((i, k) => (
              <tr key={k}>
                <td className="py-0.5">{i.name}<div className="text-[10px] text-stone-500">{fmtMoney(i.unit_price, false)}</div></td>
                <td className="text-center">{fmtNum(i.qty)}</td>
                <td className="text-end">{fmtMoney(i.line_total, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="my-2 border-dashed" />
        <Row l="المجموع" v={fmtMoney(data.subtotal)} />
        {data.discount > 0 && <Row l="الخصم" v={`- ${fmtMoney(data.discount)}`} />}
        {data.tax_amount > 0 && <Row l="الضريبة" v={fmtMoney(data.tax_amount)} />}
        <div className="flex justify-between border-t border-dashed pt-1 text-sm font-bold"><span>الصافي</span><span>{fmtMoney(data.total)}</span></div>
        {data.payments?.map((p, k) => <Row key={k} l={p.method} v={fmtMoney(p.amount)} />)}
        {data.change_amount > 0 && <Row l="الباقي للعميل" v={fmtMoney(data.change_amount)} />}
        {data.remaining > 0 && <Row l="المتبقي (آجل)" v={fmtMoney(data.remaining)} />}
        {company?.invoice_footer && <div className="mt-3 text-center">{company.invoice_footer}</div>}
      </div>
    </Modal>
  )
}

const Row = ({ l, v }: { l: string; v: string }) => <div className="flex justify-between"><span>{l}</span><span>{v}</span></div>
