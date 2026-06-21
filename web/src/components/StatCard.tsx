interface Props {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: string
}

export default function StatCard({ icon, label, value, sub, color }: Props) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}
