interface Props {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: string
}

export default function StatCard({ icon, label, value, sub, color }: Props) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border dark:border-slate-700">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{label}</p>
    </div>
  )
}
