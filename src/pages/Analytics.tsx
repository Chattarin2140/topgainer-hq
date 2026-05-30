import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useTradeStore } from '../store'
import { calcStats, groupBySymbol, groupByMonth } from '../utils/analytics'
import StatsCard from '../components/StatsCard'

export default function Analytics() {
  const { closedTrades } = useTradeStore()
  const stats = useMemo(() => calcStats(closedTrades), [closedTrades])
  const bySymbol = useMemo(() => groupBySymbol(closedTrades).slice(0, 15), [closedTrades])
  const byMonth = useMemo(() => groupByMonth(closedTrades), [closedTrades])

  if (closedTrades.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-gray-400">Import trades to see analytics.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-white text-2xl font-bold">Analytics</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard label="Total Trades" value={String(stats.totalTrades)} color="blue" />
        <StatsCard
          label="Largest Win"
          value={`+$${stats.largestWin.toFixed(2)}`}
          color="green"
        />
        <StatsCard
          label="Largest Loss"
          value={`$${stats.largestLoss.toFixed(2)}`}
          color="red"
        />
        <StatsCard
          label="Avg Holding"
          value={`${stats.avgHoldingDays.toFixed(1)} days`}
          color="neutral"
        />
        <StatsCard
          label="Total Commission"
          value={`$${stats.totalCommission.toFixed(2)}`}
          color="red"
        />
        <StatsCard
          label="Avg Win"
          value={`+$${stats.avgWin.toFixed(2)}`}
          color="green"
        />
        <StatsCard
          label="Avg Loss"
          value={`-$${stats.avgLoss.toFixed(2)}`}
          color="red"
        />
        <StatsCard
          label="Profit Factor"
          value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
          color={stats.profitFactor >= 1.5 ? 'green' : stats.profitFactor >= 1 ? 'blue' : 'red'}
        />
      </div>

      {/* Monthly P&L */}
      {byMonth.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-white font-semibold mb-4">Monthly P&L</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byMonth} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickLine={false}
                tickFormatter={(v: number) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Net P&L']}
              />
              <Bar dataKey="netPL" radius={[4, 4, 0, 0]}>
                {byMonth.map((entry, i) => (
                  <Cell key={i} fill={entry.netPL >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* P&L by Symbol */}
      {bySymbol.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-white font-semibold mb-4">P&L by Symbol</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={bySymbol}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              />
              <YAxis
                type="category"
                dataKey="symbol"
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                tickLine={false}
                width={60}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(value: number, _: string, props: { payload?: { count?: number; winRate?: number } }) => [
                  `$${value.toFixed(2)} (${props.payload?.count} trades, ${props.payload?.winRate?.toFixed(0)}% WR)`,
                  'Net P&L',
                ]}
              />
              <Bar dataKey="netPL" radius={[0, 4, 4, 0]}>
                {bySymbol.map((entry, i) => (
                  <Cell key={i} fill={entry.netPL >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
