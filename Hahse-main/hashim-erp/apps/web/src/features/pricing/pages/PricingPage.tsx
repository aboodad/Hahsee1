import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Boxes, Coins, Layers, Search, SplitSquareHorizontal, Tag, Pencil, ArrowUpCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errMsg } from '@/lib/errors'
import { toast } from '@/store/toast.store'
import { useAuth } from '@/store/auth.store'
import { usePermission } from '@/hooks/usePermission'
import { useMainWarehouse } from '@/hooks/useLookups'
import { fmtDate, fmtMoney, fmtNum } from '@/lib/formatters'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { BranchSelect } from '@/components/shared/BranchSelect'
import { DataTable, type Column } from '@/components/data/DataTable'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Field, Input } from '@/components/ui/Field'

interface LotRow {
  lot_id: string; branch_id: string; branch_name: string; product_id: string
  product_name: string; sku: string; barcode: string | null
  unit_cost: number; qty_on_hand: number; lot_value: number
  retail_price: number | null; wholesale_price: number | null
  effective_retail: number; effective_wholesale: number
  product_retail: number; product_wholesale: number
  first_received_at: string; last_received_at: string
  lot_seq: number; active_lots: number
}
interface Group { key: string; product_id: string; product_name: string; sku: string; branch_name: string; lots: LotRow[]; product_retail: number; product_wholesale: number }

const margin = (price: number, cost: number) => (cost > 0 && price > 0 ? ((price - cost) / cost) * 100 : null)

/** التسعيرة: مخزون كل صنف مقسّم حسب سعر الشراء (دفعات) مع تسعير مستقل لكل دفعة */
export default function PricingPage() {
  const qc = useQueryClient()
  const { can, seesAllBranches } = usePermission()
  const { data: main } = useMainWarehouse()
  const myBranch = useAuth((s) => s.profile?.branch_id) ?? ''
  const [branchId, setBranchId] = useState('')
  const [search, setSearch] = useState('')
  const [onlySplit, setOnlySplit] = useState(false)
  const [showEmpty, setShowEmpty] = useState(false)
  const [edit, setEdit] = useState<LotRow | null>(null)
  const [retail, setRetail] = useState('')
  const [wholesale, setWholesale] = useState('')
  const [pct, setPct] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!branchId) setBranchId(seesAllBranches ? (main?.id ?? '') : myBranch)
  }, [main, seesAllBranches, myBranch]) // eslint-disable-line

  const { data, isLoading } = useQuery({
    queryKey: ['stock-lots', branchId, showEmpty],
    enabled: !!branchId,
    queryFn: async () => {
      let q = supabase.from('v_stock_lots').select('*').eq('branch_id', branchId)
        .order('product_name').order('first_received_at').limit(3000)
      if (!showEmpty) q = q.gt('qty_on_hand', 0)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as LotRow[]
    },
  })

  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Group>()
    for (const r of data ?? []) {
      const key = `${r.branch_id}-${r.product_id}`
      if (!m.has(key)) m.set(key, { key, product_id: r.product_id, product_name: r.product_name, sku: r.sku, branch_name: r.branch_name, lots: [], product_retail: Number(r.product_retail), product_wholesale: Number(r.product_wholesale) })
      m.get(key)!.lots.push(r)
    }
    const s = search.trim().toLowerCase()
    return [...m.values()].filter((g) =>
      (!s || `${g.product_name} ${g.sku} ${g.lots[0]?.barcode ?? ''}`.toLowerCase().includes(s)) &&
      (!onlySplit || g.lots.filter((l) => Number(l.qty_on_hand) > 0).length > 1))
  }, [data, search, onlySplit])

  const stats = useMemo(() => {
    const lots = groups.flatMap((g) => g.lots)
    return {
      products: groups.length,
      split: groups.filter((g) => g.lots.filter((l) => Number(l.qty_on_hand) > 0).length > 1).length,
      qty: lots.reduce((s, l) => s + Number(l.qty_on_hand), 0),
      value: lots.reduce((s, l) => s + Number(l.lot_value), 0),
    }
  }, [groups])

  const openEdit = (l: LotRow) => {
    setEdit(l); setPct('')
    setRetail(l.retail_price != null ? String(l.retail_price) : '')
    setWholesale(l.wholesale_price != null ? String(l.wholesale_price) : '')
  }

  const applyMargin = (v: string) => {
    setPct(v)
    const n = Number(v)
    if (edit && v !== '' && n >= 0) setRetail((Number(edit.unit_cost) * (1 + n / 100)).toFixed(2))
  }

  const parse = (v: string) => (v.trim() === '' ? null : Number(v))
  const save = async () => {
    if (!edit) return
    const r = parse(retail), w = parse(wholesale)
    if ((r != null && (isNaN(r) || r < 0)) || (w != null && (isNaN(w) || w < 0))) return toast.error('أدخل أسعاراً صحيحة')
    if (r != null && r < Number(edit.unit_cost) && !window.confirm('سعر البيع أقل من سعر الشراء لهذه الدفعة. متابعة؟')) return
    setSaving(true)
    const { error } = await supabase.from('stock_lots').update({ retail_price: r, wholesale_price: w }).eq('id', edit.lot_id)
    setSaving(false)
    if (error) return toast.error(errMsg(error))
    toast.success('تم حفظ تسعيرة الدفعة')
    setEdit(null)
    qc.invalidateQueries({ queryKey: ['stock-lots'] })
  }

  const applyToProduct = async (l: LotRow) => {
    if (!window.confirm(`اعتماد أسعار هذه الدفعة كسعر عام للمنتج «${l.product_name}»؟ (يؤثر على نقطة البيع في كل الفروع)`)) return
    const { error } = await supabase.from('products')
      .update({ retail_price: Number(l.effective_retail), wholesale_price: Number(l.effective_wholesale) }).eq('id', l.product_id)
    if (error) return toast.error(errMsg(error))
    toast.success('تم تحديث سعر المنتج')
    qc.invalidateQueries({ queryKey: ['stock-lots'] })
  }

  const cols = (g: Group): Column<LotRow>[] => [
    { key: 'lot_seq', header: 'الدفعة', render: (l) => (
      <div className="flex items-center gap-2"><b>#{l.lot_seq}</b>
        {Number(l.qty_on_hand) > 0 && l === g.lots.find((x) => Number(x.qty_on_hand) > 0) && g.lots.filter((x) => Number(x.qty_on_hand) > 0).length > 1 && <Badge tone="amber">تُباع أولاً</Badge>}
        {Number(l.qty_on_hand) === 0 && <Badge tone="gray">نفدت</Badge>}
      </div>) },
    { key: 'first_received_at', header: 'تاريخ التوريد', render: (l) => fmtDate(l.first_received_at) },
    { key: 'unit_cost', header: 'سعر الشراء', render: (l) => <b>{fmtMoney(l.unit_cost)}</b> },
    { key: 'qty_on_hand', header: 'الكمية', render: (l) => <Badge tone={Number(l.qty_on_hand) > 0 ? 'green' : 'gray'}>{fmtNum(l.qty_on_hand)}</Badge> },
    { key: 'lot_value', header: 'قيمة الدفعة', render: (l) => fmtMoney(l.lot_value) },
    { key: 'retail', header: 'سعر البيع (مفرد)', render: (l) => (
      <div><b className="text-brand-700">{fmtMoney(l.effective_retail)}</b>
        {l.retail_price == null && <div className="text-[10px] text-stone-400">سعر المنتج العام</div>}</div>) },
    { key: 'wholesale', header: 'سعر الجملة', render: (l) => fmtMoney(l.effective_wholesale) },
    { key: 'margin', header: 'الهامش', render: (l) => {
      const m = margin(Number(l.effective_retail), Number(l.unit_cost))
      return m == null ? '—' : <Badge tone={m < 0 ? 'red' : m < 15 ? 'amber' : 'green'}>{m.toFixed(0)}%</Badge>
    } },
    { key: 'actions', header: '', render: (l) => (
      <div className="flex gap-1">
        {can('pricing', 'update') && <Button size="sm" variant="ghost" title="تسعير الدفعة" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>}
        {can('pricing', 'update') && can('products', 'update') && <Button size="sm" variant="ghost" title="اعتماد كسعر عام للمنتج" onClick={() => applyToProduct(l)}><ArrowUpCircle className="h-4 w-4 text-emerald-600" /></Button>}
      </div>) },
  ]

  return (
    <>
      <PageHeader title="التسعيرة" subtitle="مخزون كل صنف مقسّم حسب سعر الشراء — الدفعة القديمة منفصلة عن الجديدة"
        actions={seesAllBranches && <BranchSelect value={branchId} onChange={setBranchId} className="w-52" />} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="الأصناف" value={fmtNum(stats.products)} icon={Boxes} />
        <StatCard label="أصناف بأكثر من سعر شراء" value={fmtNum(stats.split)} icon={SplitSquareHorizontal} tone="red" />
        <StatCard label="إجمالي الكميات" value={fmtNum(stats.qty)} icon={Layers} tone="blue" />
        <StatCard label="قيمة المخزون" value={fmtMoney(stats.value)} icon={Coins} tone="green" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-stone-400" />
          <Input className="ps-9" placeholder="بحث بالاسم أو الباركود..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={onlySplit} onChange={(e) => setOnlySplit(e.target.checked)} /> المنقسمة فقط</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} /> إظهار الدفعات النافدة</label>
      </div>

      {isLoading && <div className="card p-10 text-center text-sm text-brand-300">جارٍ التحميل...</div>}
      {!isLoading && !groups.length && <div className="card p-10 text-center text-sm text-brand-300">لا توجد دفعات مطابقة</div>}

      <div className="space-y-4">
        {groups.map((g) => {
          const active = g.lots.filter((l) => Number(l.qty_on_hand) > 0).length
          return (
            <section key={g.key}>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <Tag className="h-4 w-4 text-gold-600" />
                <Link className="font-bold text-brand-800 hover:text-brand-600" to={`/products/${g.product_id}/movements`}>{g.product_name}</Link>
                <span dir="ltr" className="text-xs text-stone-400">{g.sku}</span>
                <Badge tone={active > 1 ? 'amber' : 'green'}>{active > 1 ? `${active} أسعار شراء` : 'سعر شراء واحد'}</Badge>
                <span className="ms-auto text-xs text-brand-400">سعر المنتج العام: {fmtMoney(g.product_retail)}</span>
              </div>
              <DataTable<LotRow> columns={cols(g)} rows={g.lots} rowKey={(l) => l.lot_id} />
            </section>
          )
        })}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `تسعير دفعة #${edit.lot_seq} — ${edit.product_name}` : ''} size="sm"
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>إلغاء</Button><Button loading={saving} onClick={save}>حفظ</Button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="rounded-xl bg-cream-100 p-3 text-sm">
              سعر الشراء: <b>{fmtMoney(edit.unit_cost)}</b> · الكمية: <b>{fmtNum(edit.qty_on_hand)}</b>
            </div>
            <Field label="هامش الربح % (اختياري — يحسب سعر البيع تلقائياً)">
              <Input type="number" min="0" inputMode="decimal" value={pct} onChange={(e) => applyMargin(e.target.value)} />
            </Field>
            <Field label="سعر البيع (مفرد)" hint="اتركه فارغاً لاستخدام سعر المنتج العام">
              <Input type="number" min="0" step="0.01" inputMode="decimal" value={retail} onChange={(e) => { setRetail(e.target.value); setPct('') }} />
            </Field>
            <Field label="سعر الجملة" hint="اتركه فارغاً لاستخدام سعر الجملة العام">
              <Input type="number" min="0" step="0.01" inputMode="decimal" value={wholesale} onChange={(e) => setWholesale(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  )
}
