import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-16 text-center dark:border-slate-600 dark:bg-slate-800/40">
      {icon && (
        <div className="mb-4 text-slate-400 dark:text-slate-500" aria-hidden>
          {icon}
        </div>
      )}
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
