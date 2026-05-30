import { RawTrade, ClosedTrade, OpenPosition } from '../types'

interface Lot {
  date: string
  quantity: number
  price: number
  commission: number
}

export function matchTrades(rawTrades: RawTrade[]): {
  closedTrades: ClosedTrade[]
  openPositions: OpenPosition[]
} {
  const sorted = [...rawTrades].sort((a, b) => a.date.localeCompare(b.date))
  const lots: Record<string, Lot[]> = {}
  const shortLots: Record<string, Lot[]> = {}
  const closedTrades: ClosedTrade[] = []

  for (const trade of sorted) {
    const { symbol, side, quantity, price, commission, date } = trade

    if (side === 'buy') {
      if (shortLots[symbol]?.length > 0) {
        // Closing a short position
        let remaining = quantity
        let totalEntryPrice = 0
        let totalEntryQty = 0
        let totalCommission = commission

        while (remaining > 0 && shortLots[symbol].length > 0) {
          const lot = shortLots[symbol][0]
          const matched = Math.min(remaining, lot.quantity)
          totalEntryPrice += lot.price * matched
          totalEntryQty += matched
          totalCommission += (lot.commission / lot.quantity) * matched
          lot.quantity -= matched
          remaining -= matched
          if (lot.quantity === 0) shortLots[symbol].shift()
        }

        if (totalEntryQty > 0) {
          const avgEntry = totalEntryPrice / totalEntryQty
          const grossPL = (avgEntry - price) * totalEntryQty
          const netPL = grossPL - totalCommission
          const openDate = shortLots[symbol][0]?.date ?? date
          const holdingDays = Math.ceil(
            (new Date(date).getTime() - new Date(openDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
          closedTrades.push({
            id: `${symbol}-${date}-${closedTrades.length}`,
            symbol,
            openDate,
            closeDate: date,
            side: 'short',
            quantity: totalEntryQty,
            entryPrice: avgEntry,
            exitPrice: price,
            grossPL,
            commission: totalCommission,
            netPL,
            holdingDays,
            isWin: netPL > 0,
          })
        }

        if (remaining > 0) {
          if (!lots[symbol]) lots[symbol] = []
          lots[symbol].push({ date, quantity: remaining, price, commission: 0 })
        }
      } else {
        if (!lots[symbol]) lots[symbol] = []
        lots[symbol].push({ date, quantity, price, commission })
      }
    } else {
      // sell
      if (lots[symbol]?.length > 0) {
        // Closing a long position
        let remaining = quantity
        let totalEntryPrice = 0
        let totalEntryQty = 0
        let totalCommission = commission
        let firstOpenDate = lots[symbol][0].date

        while (remaining > 0 && lots[symbol].length > 0) {
          const lot = lots[symbol][0]
          const matched = Math.min(remaining, lot.quantity)
          totalEntryPrice += lot.price * matched
          totalEntryQty += matched
          totalCommission += (lot.commission / lot.quantity) * matched
          lot.quantity -= matched
          remaining -= matched
          if (lot.quantity === 0) lots[symbol].shift()
        }

        if (totalEntryQty > 0) {
          const avgEntry = totalEntryPrice / totalEntryQty
          const grossPL = (price - avgEntry) * totalEntryQty
          const netPL = grossPL - totalCommission
          const holdingDays = Math.ceil(
            (new Date(date).getTime() - new Date(firstOpenDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
          closedTrades.push({
            id: `${symbol}-${date}-${closedTrades.length}`,
            symbol,
            openDate: firstOpenDate,
            closeDate: date,
            side: 'long',
            quantity: totalEntryQty,
            entryPrice: avgEntry,
            exitPrice: price,
            grossPL,
            commission: totalCommission,
            netPL,
            holdingDays,
            isWin: netPL > 0,
          })
        }

        if (remaining > 0) {
          // Short sell with no prior long
          if (!shortLots[symbol]) shortLots[symbol] = []
          shortLots[symbol].push({ date, quantity: remaining, price, commission: 0 })
        }
      } else {
        // Short position
        if (!shortLots[symbol]) shortLots[symbol] = []
        shortLots[symbol].push({ date, quantity, price, commission })
      }
    }
  }

  const openPositions: OpenPosition[] = []
  for (const [symbol, symbolLots] of Object.entries(lots)) {
    if (symbolLots.length === 0) continue
    const totalQty = symbolLots.reduce((s, l) => s + l.quantity, 0)
    const totalCost = symbolLots.reduce((s, l) => s + l.price * l.quantity, 0)
    openPositions.push({
      symbol,
      quantity: totalQty,
      avgPrice: totalCost / totalQty,
      totalCost,
      openDate: symbolLots[0].date,
    })
  }

  return { closedTrades, openPositions }
}
