interface Props {
  label: string
  value: string
  sub?: string
  color?: 'green' | 'red' | 'neutral' | 'blue'
}

export default function StatsCard({ label, value, sub, color = 'neutral' }: Props) {
  const valueColor =
    color === 'green' ? 'text-green-400'
    : color === 'red' ? 'text-red-400'
    : color === 'blue' ? 'text-blue-400'
    : 'text-white'

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}
