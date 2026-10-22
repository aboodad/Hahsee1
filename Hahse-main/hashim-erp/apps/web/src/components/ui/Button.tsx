import { forwardRef, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'gold' | 'secondary' | 'danger' | 'ghost' | 'success'

const styles: Record<Variant, string> = {
  primary: 'bg-gradient-to-b from-brand-600 to-brand-800 text-cream-50 shadow-sm hover:from-brand-700 hover:to-brand-900',
  gold: 'bg-gradient-to-b from-gold-400 to-gold-600 text-brand-950 shadow-gold hover:from-gold-300 hover:to-gold-500',
  secondary: 'border border-cream-400 bg-white text-brand-700 hover:bg-cream-100',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  success: 'bg-emerald-700 text-white hover:bg-emerald-800',
  ghost: 'text-brand-600 hover:bg-cream-200',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', loading, size = 'md', className, children, disabled, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx('btn', styles[variant], size === 'sm' && '!px-3 !py-1.5 !text-xs', size === 'lg' && '!px-6 !py-3 !text-base', className)}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
