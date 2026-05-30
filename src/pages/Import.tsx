import { useState, useCallback } from 'react'
import { parseCSV, detectFormat, BrokerFormat } from '../utils/csvParsers'
import { useTradeStore } from '../store'
import { RawTrade } from '../types'

const BROKERS: { id: BrokerFormat; label: string; hint: string }[] = [
  { id: 'monthly', label: 'Monthly Statement', hint: 'DD/MM/YYYY, Stocks + Options sections' },
  { id: 'webull', label: 'Webull', hint: 'Order History CSV' },
  { id: 'tdameritrade', label: 'TD Ameritrade', hint: 'Trade History CSV' },
  { id: 'robinhood', label: 'Robinhood', hint: 'Account Activity CSV' },
  { id: 'generic', label: 'Generic CSV', hint: 'date, symbol, side, qty, price, commission' },
]

export default function Import() {
  const { addTrades, clearAll, rawTrades } = useTradeStore()
  const [broker, setBroker] = useState<BrokerFormat>('generic')
  const [preview, setPreview] = useState<RawTrade[]>([])
  const [status, setStatus] = useState<'idle' | 'preview' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [fileName, setFileName] = useState('')

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name)
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const detected = detectFormat(text)
          if (broker === 'generic' && detected !== 'generic') setBroker(detected)
          const trades = parseCSV(text, broker === 'generic' ? detected : broker)
          if (trades.length === 0) {
            setErrorMsg('ไม่พบ trade ที่ valid ในไฟล์นี้ ตรวจสอบ format ให้ถูกต้อง')
            setStatus('error')
            return
          }
          setPreview(trades)
          setStatus('preview')
        } catch {
          setErrorMsg('อ่านไฟล์ไม่ได้ กรุณาตรวจสอบ format')
          setStatus('error')
        }
      }
      reader.readAsText(file)
    },
    [broker]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  function confirm() {
    addTrades(preview)
    setPreview([])
    setStatus('done')
  }

  function reset() {
    setPreview([])
    setStatus('idle')
    setFileName('')
    setErrorMsg('')
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-white text-2xl font-bold">Import Trades</h1>

      {/* Broker selector */}
      <div>
        <p className="text-gray-400 text-sm mb-2">Broker Format</p>
        <div className="flex flex-wrap gap-2">
          {BROKERS.map((b) => (
            <button
              key={b.id}
              onClick={() => setBroker(b.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                broker === b.id
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
              }`}
            >
              {b.label}
              <span className="ml-1 text-xs opacity-60">({b.hint})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      {status === 'idle' || status === 'error' ? (
        <label
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-xl p-12 cursor-pointer hover:border-blue-500 transition bg-gray-800/50"
        >
          <div className="text-4xl mb-3">📂</div>
          <p className="text-white font-medium mb-1">Drop CSV file here or click to browse</p>
          <p className="text-gray-500 text-sm">Supported: .csv</p>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      ) : null}

      {status === 'error' && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Preview */}
      {status === 'preview' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-white font-medium">
              พบ <span className="text-blue-400">{preview.length} trades</span> จาก {fileName}
            </p>
            <div className="flex gap-3">
              <button onClick={reset} className="text-gray-400 hover:text-white text-sm">ยกเลิก</button>
              <button
                onClick={confirm}
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition"
              >
                Import {preview.length} trades
              </button>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-400 text-xs uppercase border-b border-gray-700 sticky top-0 bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Symbol</th>
                  <th className="px-3 py-2 text-left">Side</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Commission</th>
                  <th className="px-3 py-2 text-left">Broker</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((t) => (
                  <tr key={t.id} className="border-t border-gray-700">
                    <td className="px-3 py-1.5 text-gray-300">{t.date}</td>
                    <td className="px-3 py-1.5 text-white font-medium">{t.symbol}</td>
                    <td className="px-3 py-1.5">
                      <span className={`text-xs font-medium ${t.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                        {t.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-300">{t.quantity}</td>
                    <td className="px-3 py-1.5 text-right text-gray-300">${t.price.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{t.commission.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-gray-500 text-xs">{t.broker}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {status === 'done' && (
        <div className="bg-green-900/40 border border-green-700 rounded-lg p-4 flex justify-between items-center">
          <p className="text-green-300 font-medium">Import สำเร็จ! P&L คำนวณเสร็จแล้ว</p>
          <button onClick={reset} className="text-green-400 hover:text-green-300 text-sm">
            Import เพิ่ม
          </button>
        </div>
      )}

      {/* Existing data info */}
      {rawTrades.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex justify-between items-center">
          <p className="text-gray-300 text-sm">
            มี <span className="text-white font-medium">{rawTrades.length} raw trades</span> ในระบบแล้ว
          </p>
          <button
            onClick={() => { if (confirm('ลบข้อมูลทั้งหมด?')) clearAll() }}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Generic CSV format hint */}
      {broker === 'generic' && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-gray-300 text-sm font-medium mb-2">Generic CSV Format ตัวอย่าง:</p>
          <pre className="text-gray-500 text-xs font-mono">
{`date,symbol,side,quantity,price,commission
2024-01-15,AAPL,buy,100,185.50,1.00
2024-01-20,AAPL,sell,100,190.25,1.00
2024-02-01,TSLA,buy,50,210.00,0.50`}
          </pre>
        </div>
      )}
    </div>
  )
}
