import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { usePermission } from '@/hooks/usePermission'
import { useAuth } from '@/store/auth.store'
import { fmtMoney, toISODate } from '@/lib/formatters'
import { PageHeader } from '@/components/shared/PageHeader'
import { BranchSelect } from '@/components/shared/BranchSelect'
import { Input } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'

const sum = (rows: any[], k: string) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0)

export default function ProfitLossPage() {
  const { seesAllBranches } = usePermission()
  const myBranch = useAuth((s) => s.profile?.branch_id) ?? ''
  const [branch, setBranch] = useState(seesAllBranches ? '' : myBranch)
  const [from, setFrom] = useState(toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [to, setTo] = useState(toISODate(new Date()))

  const { data, isLoading } = useQuery({
    queryKey: ['pnl', branch, from, to],
    queryFn: async () => {
      let q = supabase.from('v_branch_pnl').select('*').gte('month', from.slice(0, 7) + '-01').lte('month', to)
      if (branch) q = q.eq('branch_id', branch)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  const r = data ?? []
  const lines: [string, number, 'plain' | 'sub' | 'total' | 'neg'][] = [
    ['إجمالي المبيعات', sum(r, 'gross_sales'), 'plain'],
    ['المرتجعات', -sum(r, 'returns_value'), 'neg'],
    ['الخصومات', -sum(r, 'discounts'), 'neg'],
    ['صافي المبيعات', sum(r, 'net_sales'), 'sub'],
    ['تكلفة البضاعة المباعة', -sum(r, 'cogs'), 'neg'],
    ['الربح الإجمالي', sum(r, 'gross_profit'), 'sub'],
    ['الرواتب', -sum(r, 'salaries'), 'neg'],
    ['العمولات', -sum(r, 'commissions'), 'neg'],
    ['الإيجارات', -sum(r, 'rent'), 'neg'],
    ['الكهرباء', -sum(r, 'electricity'), 'neg'],
    ['الماء', -sum(r, 'water'), 'neg'],
    ['الإنترنت', -sum(r, 'internet'), 'neg'],
    ['مصروفات أخرى', -sum(r, 'other_expenses'), 'neg'],
    ['إجمالي المصروفات', -sum(r, 'total_expenses'), 'sub'],
    ['إيرادات أخرى', sum(r, 'other_income'), 'plain'],
    ['صافي الربح', sum(r, 'net_profit'), 'total'],
  ]

  return (
    <>
      <PageHeader title="الأرباح والخسائر" subtitle="أداء كل فرع بشكل مستقل أو الشركة كاملة"
        actions={<>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          {seesAllBranches && <BranchSelect includeAll value={branch} onChange={setBranch} className="w-48" />}
        </>} />
      {isLoading ? <Spinner /> : (
        <div className="card mx-auto max-w-2xl divide-y divide-cream-200">
          {lines.map(([label, val, kind]) => (
            <div key={label} className={`flex items-center justify-between px-5 py-2.5 text-sm ${kind === 'sub' ? 'bg-cream-100 font-bold' : ''} ${kind === 'total' ? 'bg-brand-50 text-base font-bold' : ''}`}>
              <span>{label}</span>
              <span className={val < 0 ? 'text-red-600' : kind === 'total' && val > 0 ? 'text-emerald-700' : ''} dir="ltr">{fmtMoney(val)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-center text-xs text-stone-400">الأرقام شهرية مجمّعة؛ المرتجعات بقيمة المسترد (شاملة الضريبة).</p>
    </>
  )
}
