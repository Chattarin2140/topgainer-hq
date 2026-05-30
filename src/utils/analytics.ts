import { ClosedTrade, EquityPoint, TradeStats } from '../types'

export function calcStats(trades: ClosedTrade[]): TradeStats {
  if (trades.length === 0) {
    return {
      totalNetPL: 0, totalGrossPL: 0, totalCommission: 0,
      totalTrades: 0, winCount: 0, lossCount: 0, winRate: 0,
      avgWin: 0, avgLoss: 0, profitFactor: 0, maxDrawdown: 0,
      largestWin: 0, largestLoss: 0, avgHoldingDays: 0,
    }
  }

  const wins = trades.filter((t) => t.isWin)
  const losses = trades.filter((t) => !t.isWin)
  const totalNetPL = trades.reduce((s, t) => s + t.netPL, 0)
  const totalGrossPL = trades.reduce((s, t) => s + t.grossPL, 0)
  const totalCommission = trades.reduce((s, t) => s + t.commission, 0)
  const grossWins = wins.reduce((s, t) => s + t.netPL, 0)
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.netPL, 0))

  // Max drawdown from equity curve
  const sorted = [...trades].sort((a, b) => a.closeDate.localeCompare(b.closeDate))
  let peak = 0
  let equity = 0
  let maxDrawdown = 0
  for (const t of sorted) {
    equity += t.netPL
    if (equity > peak) peak = equity
    const dd = peak - equity
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  return {
    totalNetPL,
    totalGrossPL,
    totalCommission,
    totalTrades: trades.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    avgWin: wins.length > 0 ? grossWins / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLosses / losses.length : 0,
    profitFactor: grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0,
    maxDrawdown,
    largestWin: wins.length > 0 ? Math.max(...wins.map((t) => t.netPL)) : 0,
    largestLoss: losses.length > 0 ? Math.min(...losses.map((t) => t.netPL)) : 0,
    avgHoldingDays:
      trades.length > 0
        ? trades.reduce((s, t) => s + t.holdingDays, 0) / trades.length
        : 0,
  }
}

export function buildEquityCurve(trades: ClosedTrade[]): EquityPoint[] {
  const sorted = [...trades].sort((a, b) => a.closeDate.localeCompare(b.closeDate))
  const byDate: Record<string, number> = {}
  for (const t of sorted) {
    byDate[t.closeDate] = (byDate[t.closeDate] ?? 0) + t.netPL
  }
  let cumulative = 0
  return Object.entries(byDate).map(([date, dailyPL]) => {
    cumulative += dailyPL
    return { date, dailyPL, cumulativePL: cumulative }
  })
}

export function groupBySymbol(trades: ClosedTrade[]) {
  const map: Record<string, { netPL: number; count: number; wins: number }> = {}
  for (const t of trades) {
    if (!map[t.symbol]) map[t.symbol] = { netPL: 0, count: 0, wins: 0 }
    map[t.symbol].netPL += t.netPL
    map[t.symbol].count++
    if (t.isWin) map[t.symbol].wins++
  }
  return Object.entries(map)
    .map(([symbol, v]) => ({ symbol, ...v, winRate: (v.wins / v.count) * 100 }))
    .sort((a, b) => b.netPL - a.netPL)
}

export function groupByMonth(trades: ClosedTrade[]) {
  const map: Record<string, number> = {}
  for (const t of trades) {
    const month = t.closeDate.slice(0, 7)
    map[month] = (map[month] ?? 0) + t.netPL
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, netPL]) => ({ month, netPL }))
}
