import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { RawTrade, ClosedTrade, OpenPosition } from './types'
import { matchTrades } from './utils/tradeMatching'

interface TradeStore {
  rawTrades: RawTrade[]
  closedTrades: ClosedTrade[]
  openPositions: OpenPosition[]
  addTrades: (trades: RawTrade[]) => void
  removeTrade: (id: string) => void
  clearAll: () => void
}

function recompute(rawTrades: RawTrade[]) {
  return matchTrades(rawTrades)
}

export const useTradeStore = create<TradeStore>()(
  persist(
    (set, get) => ({
      rawTrades: [],
      closedTrades: [],
      openPositions: [],

      addTrades: (incoming) => {
        const existing = get().rawTrades
        const existingIds = new Set(existing.map((t) => t.id))
        const merged = [...existing, ...incoming.filter((t) => !existingIds.has(t.id))]
        const { closedTrades, openPositions } = recompute(merged)
        set({ rawTrades: merged, closedTrades, openPositions })
      },

      removeTrade: (id) => {
        const rawTrades = get().rawTrades.filter((t) => t.id !== id)
        const { closedTrades, openPositions } = recompute(rawTrades)
        set({ rawTrades, closedTrades, openPositions })
      },

      clearAll: () => set({ rawTrades: [], closedTrades: [], openPositions: [] }),
    }),
    { name: 'trading-pl-store' }
  )
)
