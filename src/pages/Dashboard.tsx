import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useTradeStore } from '../store'
import { calcStats, buildEquityCurve } from '../utils/analytics'
import StatsCard from '../components/StatsCard'
import { Link } from 'react-router-dom'

function fmt(n: number) {
  const abs = Math.abs(n)
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(2)}`
  return n < 0 ? `-${s}` : `+${s}`
}

export default function Dashboard() {
  const { closedTrades } = useTradeStore()
  const stats = useMemo(() => calcStats(closedTrades), [closedTrades])
  const equityCurve = useMemo(() => buildEquityCurve(closedTrades), [closedTrades])

  if (closedTrades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-white text-2xl font-bold mb-2">ยังไม่มีข้อมูล Trade</h2>
        <p className="text-gray-400 mb-6">เริ่มต้นโดย import ไฟล์ CSV จาก Broker ของคุณ</p>
        <Link
          to="/import"
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition"
        >
          Import CSV
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-white text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label="Net P&L"
          value={fmt(stats.totalNetPL)}
          sub={`Gross ${fmt(stats.totalGrossPL)}`}
          color={stats.totalNetPL >= 0 ? 'green' : 'red'}
        />
        <StatsCard
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          sub={`${stats.winCount}W / ${stats.lossCount}L`}
          color={stats.winRate >= 50 ? 'green' : 'red'}
        />
        <StatsCard
          label="Profit Factor"
          value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
          sub={`Avg W $${stats.avgWin.toFixed(0)} / Avg L $${stats.avgLoss.toFixed(0)}`}
          color={stats.profitFactor >= 1 ? 'green' : 'red'}
        />
        <StatsCard
          label="Max Drawdown"
          value={`-$${stats.maxDrawdown.toFixed(2)}`}
          color={stats.maxDrawdown > 0 ? 'red' : 'neutral'}
          sub={`${stats.totalTrades} closed trades`}
        />
      </div>

      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h2 className="text-white font-semibold mb-4">Equity Curve (Cumulative Net P&L)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={equityCurve} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="plGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              tickFormatter={(v: number) =>
                `$${v < 0 ? '-' : ''}${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}k` : Math.abs(v).toFixed(0)}`
              }
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cumulative P&L']}
            />
            <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" />
            <Area
              type="monotone"
              dataKey="cumulativePL"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#plGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-700">
          <h2 className="text-white font-semibold">Recent Closed Trades</h2>
          <Link to="/trades" className="text-blue-400 text-sm hover:text-blue-300">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase">
                <th className="px-4 py-2 text-left">Symbol</th>
                <th className="px-4 py-2 text-left">Close Date</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Entry</th>
                <th className="px-4 py-2 text-right">Exit</th>
                <th className="px-4 py-2 text-right">Net P&L</th>
              </tr>
            </thead>
            <tbody>
              {[...closedTrades]
                .sort((a, b) => b.closeDate.localeCompare(a.closeDate))
                .slice(0, 10)
                .map((t) => (
                  <tr key={t.id} className="border-t border-gray-700 hover:bg-gray-700/40">
                    <td className="px-4 py-2 text-white font-medium">{t.symbol}</td>
                    <td className="px-4 py-2 text-gray-300">{t.closeDate}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{t.quantity}</td>
                    <td className="px-4 py-2 text-right text-gray-300">${t.entryPrice.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-gray-300">${t.exitPrice.toFixed(2)}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${t.isWin ? 'text-green-400' : 'text-red-400'}`}>
                      {t.netPL >= 0 ? '+' : ''}{t.netPL.toFixed(2)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
