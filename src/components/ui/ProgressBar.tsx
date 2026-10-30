interface ProgressBarProps {
  /** Backend `progress_percent`; may exceed 100 on over-collection. */
  percent: number
  label?: string
}

export function ProgressBar({ percent, label = 'Progres pengumpulan' }: ProgressBarProps) {
  const width = Math.min(100, Math.max(0, percent))
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-stone-600">{label}</span>
        <span className="font-semibold text-green-700 tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={width}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${percent}%`}
        className="h-2.5 overflow-hidden rounded-full bg-stone-100"
      >
        <div className="h-full rounded-full bg-green-600 transition-all" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}
