export interface RawTrade {
  id: string
  date: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  commission: number
  broker?: string
}

export interface ClosedTrade {
  id: string
  symbol: string
  openDate: string
  closeDate: string
  side: 'long' | 'short'
  quantity: number
  entryPrice: number
  exitPrice: number
  grossPL: number
  commission: number
  netPL: number
  holdingDays: number
  isWin: boolean
}

export interface OpenPosition {
  symbol: string
  quantity: number
  avgPrice: number
  totalCost: number
  openDate: string
}

export interface EquityPoint {
  date: string
  cumulativePL: number
  dailyPL: number
}

export interface TradeStats {
  totalNetPL: number
  totalGrossPL: number
  totalCommission: number
  totalTrades: number
  winCount: number
  lossCount: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  maxDrawdown: number
  largestWin: number
  largestLoss: number
  avgHoldingDays: number
}
