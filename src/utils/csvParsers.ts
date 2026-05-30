import { RawTrade } from '../types'

function generateId() {
  return Math.random().toString(36).slice(2, 11)
}

function parseDate(raw: string): string {
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  // Try MM/DD/YYYY
  const parts = raw.split('/')
  if (parts.length === 3) {
    const iso = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
    return iso
  }
  return raw
}

function parseNum(v: string): number {
  return parseFloat(v.replace(/[$,\s]/g, '')) || 0
}

export type BrokerFormat = 'webull' | 'tdameritrade' | 'robinhood' | 'monthly' | 'generic'

// ──────────────────── Monthly Statement (DD/MM/YYYY) ───────────────
function parseDMY(raw: string): string {
  const parts = raw.trim().split('/')
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  return raw
}

function parseMonthlyStatement(rows: string[][]): RawTrade[] {
  const trades: RawTrade[] = []
  type Section = 'none' | 'stocks' | 'options'
  let section: Section = 'none'
  let headerIdx = -1
  let colMap: Record<string, number> = {}

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const first = row[0]?.trim() ?? ''

    if (first === 'Stocks') { section = 'stocks'; headerIdx = -1; continue }
    if (first === 'Options') { section = 'options'; headerIdx = -1; continue }
    if (first === 'Portfolio Advisory' || first === 'PORTFOLIO SUMMARY') { section = 'none'; continue }
    if (section === 'none') continue

    const headerCells = row.map((h) => h.trim().toLowerCase())

    if (headerCells[0] === 'symbol & name') {
      colMap = {}
      headerCells.forEach((h, idx) => { colMap[h] = idx })
      headerIdx = i
      continue
    }

    if (headerIdx < 0 || row.length < 4) continue

    const symbolRaw = row[colMap['symbol & name']]?.trim() ?? ''
    if (!symbolRaw) continue

    // Normalize OCC option symbol or extract ticker from "TICKER COMPANY NAME"
    const symbol = section === 'options'
      ? symbolRaw.replace(/\s+/g, '')    // "ALMU  260417C00020000 " → "ALMU260417C00020000"
      : symbolRaw.split(/\s+/)[0].toUpperCase()

    const buySellRaw = row[colMap['buy/sell']]?.trim().toLowerCase() ?? ''
    const side = buySellRaw === 'buy' ? 'buy' : buySellRaw === 'sell' ? 'sell' : null
    if (!side) continue

    const qty = parseNum(row[colMap['quantity']] ?? '0')
    const rawPrice = parseNum(row[colMap['traded price']] ?? '0')
    if (qty === 0 || rawPrice === 0) continue

    const multiplier = section === 'options'
      ? (parseNum(row[colMap['multiplier']] ?? '100') || 100)
      : 1
    const price = rawPrice * multiplier

    trades.push({
      id: generateId(),
      date: parseDMY(row[colMap['trade date']] ?? ''),
      symbol,
      side,
      quantity: qty,
      price,
      commission: Math.abs(parseNum(row[colMap['comm/fee/tax']] ?? '0')),
      broker: 'Monthly Statement',
    })
  }

  return trades
}

// ───────────────────────────── Webull ──────────────────────────────
function parseWebull(rows: string[][]): RawTrade[] {
  // Webull order history CSV: Date/Time, Symbol, Type, Side, Filled Qty, Avg Price, Commission
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const dateIdx = header.findIndex((h) => h.includes('time') || h.includes('date'))
  const symbolIdx = header.findIndex((h) => h === 'symbol' || h.includes('ticker'))
  const sideIdx = header.findIndex((h) => h === 'side' || h.includes('action'))
  const qtyIdx = header.findIndex((h) => h.includes('qty') || h.includes('quantity') || h.includes('filled'))
  const priceIdx = header.findIndex((h) => h.includes('price') || h.includes('avg'))
  const commIdx = header.findIndex((h) => h.includes('comm') || h.includes('fee'))

  return rows.slice(1).flatMap((row) => {
    if (row.length < 4) return []
    const side = row[sideIdx]?.trim().toLowerCase()
    if (side !== 'buy' && side !== 'sell') return []
    return [{
      id: generateId(),
      date: parseDate(row[dateIdx] ?? ''),
      symbol: (row[symbolIdx] ?? '').trim().toUpperCase(),
      side: side as 'buy' | 'sell',
      quantity: parseNum(row[qtyIdx] ?? '0'),
      price: parseNum(row[priceIdx] ?? '0'),
      commission: parseNum(row[commIdx] ?? '0'),
      broker: 'Webull',
    }]
  })
}

// ──────────────────────── TD Ameritrade ────────────────────────────
function parseTDA(rows: string[][]): RawTrade[] {
  // TDA trade history: DATE, TRANSACTION ID, DESCRIPTION, QUANTITY, SYMBOL, PRICE, COMMISSION, AMOUNT
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const dateIdx = header.findIndex((h) => h === 'date')
  const descIdx = header.findIndex((h) => h.includes('description') || h.includes('desc'))
  const qtyIdx = header.findIndex((h) => h === 'quantity' || h === 'qty')
  const symbolIdx = header.findIndex((h) => h === 'symbol')
  const priceIdx = header.findIndex((h) => h === 'price')
  const commIdx = header.findIndex((h) => h.includes('commission'))

  return rows.slice(1).flatMap((row) => {
    if (row.length < 5) return []
    const desc = (row[descIdx] ?? '').toLowerCase()
    const side: 'buy' | 'sell' | null = desc.includes('bought') || desc.includes('buy')
      ? 'buy'
      : desc.includes('sold') || desc.includes('sell')
      ? 'sell'
      : null
    if (!side) return []
    const symbol = (row[symbolIdx] ?? '').trim().toUpperCase()
    if (!symbol) return []
    return [{
      id: generateId(),
      date: parseDate(row[dateIdx] ?? ''),
      symbol,
      side,
      quantity: Math.abs(parseNum(row[qtyIdx] ?? '0')),
      price: parseNum(row[priceIdx] ?? '0'),
      commission: Math.abs(parseNum(row[commIdx] ?? '0')),
      broker: 'TD Ameritrade',
    }]
  })
}

// ──────────────────────── Robinhood ────────────────────────────────
function parseRobinhood(rows: string[][]): RawTrade[] {
  // Robinhood: Activity Date, Process Date, Settle Date, Instrument, Description, Trans Code, Quantity, Price, Amount
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const dateIdx = header.findIndex((h) => h.includes('activity'))
  const symbolIdx = header.findIndex((h) => h.includes('instrument'))
  const descIdx = header.findIndex((h) => h.includes('description'))
  const codeIdx = header.findIndex((h) => h.includes('trans') || h.includes('code'))
  const qtyIdx = header.findIndex((h) => h === 'quantity')
  const priceIdx = header.findIndex((h) => h === 'price')

  return rows.slice(1).flatMap((row) => {
    if (row.length < 5) return []
    const code = (row[codeIdx] ?? '').trim().toUpperCase()
    const desc = (row[descIdx] ?? '').toLowerCase()
    const side: 'buy' | 'sell' | null =
      code === 'BUY' || desc.includes('buy') ? 'buy'
      : code === 'SLL' || code === 'SELL' || desc.includes('sell') ? 'sell'
      : null
    if (!side) return []
    const symbol = (row[symbolIdx] ?? '').trim().toUpperCase()
    if (!symbol) return []
    return [{
      id: generateId(),
      date: parseDate(row[dateIdx] ?? ''),
      symbol,
      side,
      quantity: Math.abs(parseNum(row[qtyIdx] ?? '0')),
      price: parseNum(row[priceIdx] ?? '0'),
      commission: 0,
      broker: 'Robinhood',
    }]
  })
}

// ──────────────────────── Generic CSV ──────────────────────────────
function parseGeneric(rows: string[][]): RawTrade[] {
  const header = rows[0].map((h) => h.trim().toLowerCase())

  const findCol = (...terms: string[]) =>
    header.findIndex((h) => terms.some((t) => h.includes(t)))

  const dateIdx = findCol('date', 'time')
  const symbolIdx = findCol('symbol', 'ticker', 'instrument')
  const sideIdx = findCol('side', 'action', 'type', 'transaction')
  const qtyIdx = findCol('qty', 'quantity', 'shares', 'units')
  const priceIdx = findCol('price', 'avg', 'fill')
  const commIdx = findCol('comm', 'fee', 'cost')

  return rows.slice(1).flatMap((row) => {
    if (row.length < 4) return []
    const rawSide = (row[sideIdx] ?? '').toLowerCase()
    const side: 'buy' | 'sell' | null =
      rawSide.includes('buy') || rawSide === 'b' ? 'buy'
      : rawSide.includes('sell') || rawSide === 's' ? 'sell'
      : null
    if (!side) return []
    const symbol = (row[symbolIdx] ?? '').trim().toUpperCase()
    if (!symbol) return []
    const qty = Math.abs(parseNum(row[qtyIdx] ?? '0'))
    const price = parseNum(row[priceIdx] ?? '0')
    if (qty === 0 || price === 0) return []
    return [{
      id: generateId(),
      date: parseDate(row[dateIdx] ?? ''),
      symbol,
      side,
      quantity: qty,
      price,
      commission: commIdx >= 0 ? Math.abs(parseNum(row[commIdx] ?? '0')) : 0,
      broker: 'Generic',
    }]
  })
}

// ──────────────────────── CSV Tokenizer ────────────────────────────
function tokenizeCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.trim().split(/\r?\n/)
  for (const line of lines) {
    const cells: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        cells.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    cells.push(cur)
    rows.push(cells)
  }
  return rows
}

export function detectFormat(text: string): BrokerFormat {
  const lower = text.slice(0, 500).toLowerCase()
  if (lower.includes('monthly statement') || lower.includes('trade records')) return 'monthly'
  if (lower.includes('webull') || (lower.includes('side') && lower.includes('filled'))) return 'webull'
  if (lower.includes('td ameritrade') || lower.includes('transaction id')) return 'tdameritrade'
  if (lower.includes('robinhood') || lower.includes('trans code') || lower.includes('activity date')) return 'robinhood'
  return 'generic'
}

export function parseCSV(text: string, format?: BrokerFormat): RawTrade[] {
  const rows = tokenizeCSV(text)
  if (rows.length < 2) return []
  const fmt = format ?? detectFormat(text)
  switch (fmt) {
    case 'webull': return parseWebull(rows)
    case 'tdameritrade': return parseTDA(rows)
    case 'robinhood': return parseRobinhood(rows)
    case 'monthly': return parseMonthlyStatement(rows)
    default: return parseGeneric(rows)
  }
}
