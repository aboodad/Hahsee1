import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { HoldToConfirmButton } from '@/components/ui/HoldToConfirmButton'
import { UndoNotice } from '@/components/ui/UndoNotice'

interface ConfirmOpts { title?: string; message: string; label?: string; tone?: 'danger' | 'brand' }
interface Pending extends ConfirmOpts { resolve: (ok: boolean) => void }
interface UndoItem { id: number; message: string; run: () => void | Promise<void> }

let showConfirm: ((p: Pending) => void) | null = null
let pushUndo: ((u: UndoItem) => void) | null = null
let seq = 0

/** بديل confirm(): نافذة تأكيد بالضغط المستمر. تُرجع true عند التأكيد */
export function holdConfirm(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (!showConfirm) return resolve(window.confirm(opts.message)) // احتياط إن لم يُركَّب المضيف
    showConfirm({ ...opts, resolve })
  })
}

/** ينفّذ العملية بعد مهلة (5 ثوانٍ) يظهر فيها «تراجع». التراجع يلغي التنفيذ */
export function deferWithUndo(message: string, run: () => void | Promise<void>) {
  if (!pushUndo) { void run(); return }
  pushUndo({ id: ++seq, message, run })
}

/** يُركَّب مرة واحدة في Providers */
export function HoldConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null)
  const [undos, setUndos] = useState<UndoItem[]>([])

  useEffect(() => {
    showConfirm = (p) => setPending(p)
    pushUndo = (u) => setUndos((l) => [...l, u])
    return () => { showConfirm = null; pushUndo = null }
  }, [])

  const settle = (ok: boolean) => { pending?.resolve(ok); setPending(null) }
  const drop = (id: number) => setUndos((l) => l.filter((x) => x.id !== id))

  return (
    <>
      <Modal open={!!pending} onClose={() => settle(false)} title={pending?.title ?? 'تأكيد العملية'} size="sm"
        footer={<Button variant="secondary" onClick={() => settle(false)}>إلغاء</Button>}>
        <p className="mb-5 text-sm leading-relaxed text-stone-700">{pending?.message}</p>
        <div className="flex justify-center">
          <HoldToConfirmButton tone={pending?.tone ?? 'danger'} resetAfter={0} onConfirm={() => window.setTimeout(() => settle(true), 250)}>
            {pending?.label ?? 'اضغط مطوّلاً للتأكيد'}
          </HoldToConfirmButton>
        </div>
      </Modal>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {undos.map((u) => (
          <UndoNotice key={u.id} className="pointer-events-auto w-full max-w-sm" message={u.message}
            onExpire={() => { drop(u.id); void u.run() }} onUndo={() => drop(u.id)} />
        ))}
      </div>
    </>
  )
}
