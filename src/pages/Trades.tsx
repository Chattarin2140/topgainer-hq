import { useState, useMemo } from 'react'
import { useTradeStore } from '../store'

export default function Trades() {
  const { closedTrades } = useTradeStore()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'closeDate', dir: -1 })

  const filtered = useMemo(() => {
    const q = search.toUpperCase()
    return closedTrades.filter((t) => !q || t.symbol.includes(q))
  }, [closedTrades, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sort.key]
      const bv = (b as Record<string, unknown>)[sort.key]
      if (typeof av === 'string' && typeof bv === 'string')
        return av.localeCompare(bv) * sort.dir
      return ((av as number) - (bv as number)) * sort.dir
    })
  }, [filtered, sort])

  function toggleSort(key: string) {
    setSort((s) => s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 })
  }

  function Th({ k, label }: { k: string; label: string }) {
    const active = sort.key === k
    return (
      <th
        className="px-4 py-2 text-left cursor-pointer select-none hover:text-white"
        onClick={() => toggleSort(k)}
      >
        {label} {active ? (sort.dir === 1 ? '↑' : '↓') : ''}
      </th>
    )
  }

  const totalPL = sorted.reduce((s, t) => s + t.netPL, 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-white text-2xl font-bold">Closed Trades</h1>
        <span className="text-gray-400 text-sm">{sorted.length} trades</span>
      </div>

      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Filter by symbol..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 w-48"
        />
        <div className={`text-sm font-semibold ${totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          Total: {totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-gray-400 text-center py-16">No closed trades found.</div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-xs uppercase border-b border-gray-700">
              <tr>
                <Th k="symbol" label="Symbol" />
                <Th k="side" label="Side" />
                <Th k="openDate" label="Open" />
                <Th k="closeDate" label="Close" />
                <Th k="holdingDays" label="Days" />
                <Th k="quantity" label="Qty" />
                <Th k="entryPrice" label="Entry" />
                <Th k="exitPrice" label="Exit" />
                <Th k="grossPL" label="Gross P&L" />
                <Th k="commission" label="Comm" />
                <Th k="netPL" label="Net P&L" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id} className="border-t border-gray-700 hover:bg-gray-700/40">
                  <td className="px-4 py-2 text-white font-medium">{t.symbol}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.side === 'long' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'}`}>
                      {t.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400">{t.openDate}</td>
                  <td className="px-4 py-2 text-gray-300">{t.closeDate}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{t.holdingDays}d</td>
                  <td className="px-4 py-2 text-right text-gray-300">{t.quantity}</td>
                  <td className="px-4 py-2 text-right text-gray-300">${t.entryPrice.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-gray-300">${t.exitPrice.toFixed(2)}</td>
                  <td className={`px-4 py-2 text-right ${t.grossPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.grossPL >= 0 ? '+' : ''}{t.grossPL.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500">{t.commission.toFixed(2)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${t.isWin ? 'text-green-400' : 'text-red-400'}`}>
                    {t.netPL >= 0 ? '+' : ''}{t.netPL.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
