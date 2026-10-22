import { KeyRound } from 'lucide-react'

/** شاشة تظهر فقط إذا لم تُضبط مفاتيح Supabase في ملف .env */
export function EnvMissing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 p-6">
      <div className="card w-full max-w-xl p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-600 text-brand-950"><KeyRound className="h-6 w-6" /></div>
          <div><h1 className="text-xl font-bold text-brand-800">مطلوب ربط Supabase</h1><p className="text-sm text-brand-400">آخر خطوة قبل تشغيل النظام</p></div>
        </div>
        <ol className="list-decimal space-y-3 pe-5 text-sm leading-7 text-brand-700">
          <li>انسخ الملف <code className="rounded bg-cream-200 px-1.5" dir="ltr">.env.example</code> إلى <code className="rounded bg-cream-200 px-1.5" dir="ltr">.env</code> داخل <code className="rounded bg-cream-200 px-1.5" dir="ltr">apps/web</code>.</li>
          <li>من لوحة Supabase افتح <b>Project Settings ← API</b> وانسخ القيمتين:
            <pre dir="ltr" className="mt-2 rounded-xl bg-cream-100 p-3 text-xs">{`VITE_SUPABASE_URL=https://xxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJ...`}</pre></li>
          <li>أعد تشغيل الخادم: <code className="rounded bg-cream-200 px-1.5" dir="ltr">npm run dev</code></li>
        </ol>
        <p className="mt-5 rounded-xl border border-gold-300 bg-gold-50 p-3 text-xs text-gold-800">استخدم مفتاح <b>anon / public</b> فقط. لا تضع مفتاح service_role في هذا الملف أبداً.</p>
      </div>
    </div>
  )
}
