import { useTradeStore } from '../store'
import { Link } from 'react-router-dom'

export default function Positions() {
  const { openPositions } = useTradeStore()

  if (openPositions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="text-5xl mb-4">📭</div>
        <h2 className="text-white text-xl font-bold mb-2">ไม่มี Open Positions</h2>
        <p className="text-gray-400">positions ทั้งหมดปิดแล้ว หรือยังไม่มี trade data</p>
        <Link to="/import" className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
          Import trades →
        </Link>
      </div>
    )
  }

  const totalCost = openPositions.reduce((s, p) => s + p.totalCost, 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-white text-2xl font-bold">Open Positions</h1>
        <span className="text-gray-400 text-sm">
          Capital at Risk: ${totalCost.toFixed(2)}
        </span>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs uppercase border-b border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Avg Cost</th>
              <th className="px-4 py-3 text-right">Total Cost</th>
              <th className="px-4 py-3 text-left">Open Date</th>
            </tr>
          </thead>
          <tbody>
            {openPositions.map((p) => (
              <tr key={p.symbol} className="border-t border-gray-700 hover:bg-gray-700/40">
                <td className="px-4 py-3 text-white font-semibold">{p.symbol}</td>
                <td className="px-4 py-3 text-right text-gray-300">{p.quantity}</td>
                <td className="px-4 py-3 text-right text-gray-300">${p.avgPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-blue-400 font-medium">${p.totalCost.toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-400">{p.openDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
