import { useState, useCallback, useRef } from 'react';
import { useTransactionStore } from '../utils/store';

type RawRow = Record<string, string>;

interface ParsedTransaction {
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  date: string;
  commission: number;
  assetType: 'stock' | 'option';
  error?: string;
}

// ── Delimiter detection ────────────────────────────────────────────────────
function detectDelimiter(firstLine: string): string {
  const tabs   = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g)  || []).length;
  return tabs > commas ? '\t' : ',';
}

// ── Column finder: exact match first, then partial ─────────────────────────
function findCol(headers: string[], ...aliases: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const a of aliases) {
    const i = lower.indexOf(a.toLowerCase());
    if (i !== -1) return headers[i];
  }
  for (const a of aliases) {
    const i = lower.findIndex((h) => h.includes(a.toLowerCase()));
    if (i !== -1) return headers[i];
  }
  return null;
}

// ── Exact column lookup (no fuzzy — for known formats) ─────────────────────
function exactCol(headers: string[], name: string): string | null {
  return headers.find((h) => h.toLowerCase().trim() === name.toLowerCase()) ?? null;
}

// ── Detect if this is the Webull Options export format ─────────────────────
function isWebullOptionsFormat(headers: string[]): boolean {
  const lower = headers.map((h) => h.toLowerCase().trim());
  return lower.includes('symbol & name') && lower.includes('traded price') && lower.includes('buy/sell');
}

// ── Side detection ─────────────────────────────────────────────────────────
function detectSide(value: string): 'buy' | 'sell' | null {
  const v = value.toLowerCase().trim();
  if (!v) return null;
  if (['buy', 'bought', 'long', 'purchase', 'buy to open', 'buy to close'].some((k) => v.includes(k))) return 'buy';
  if (['sell', 'sold', 'short', 'sale', 'sell to open', 'sell to close'].some((k) => v.includes(k))) return 'sell';
  // Single letter
  if (v === 'b') return 'buy';
  if (v === 's') return 'sell';
  return null;
}

// ── Date parsing ───────────────────────────────────────────────────────────
function parseDate(value: string): string {
  if (!value?.trim()) return new Date().toISOString().split('T')[0];
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) {
    const a = parseInt(slash[1], 10);
    const b = parseInt(slash[2], 10);
    const yr = slash[3];
    // If first number > 12 it must be D/M/Y (Webull international format e.g. 17/4/2026)
    if (a > 12) return `${yr}-${b.toString().padStart(2, '0')}-${a.toString().padStart(2, '0')}`;
    return `${yr}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  }
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
}

// ── Number parsing — strips $, commas, parentheses ─────────────────────────
function parseNumber(value: string): number {
  if (!value) return 0;
  return parseFloat(value.replace(/[$,\s()]/g, '')) || 0;
}

// ── Extract ticker from "AAPL Apple Inc" → "AAPL" ─────────────────────────
function extractTicker(symbolName: string): string {
  const m = symbolName.trim().match(/^([A-Z0-9.]+)/i);
  return m ? m[1].toUpperCase() : symbolName.trim().split(/\s+/)[0].toUpperCase();
}

// ── Asset type detection ───────────────────────────────────────────────────
function detectAssetType(
  symbol: string,
  instrType?: string,
  optionTypeVal?: string, // "Call" or "Put"
  multiplierVal?: string,
): 'stock' | 'option' {
  if (optionTypeVal) {
    const t = optionTypeVal.toLowerCase().trim();
    if (t === 'call' || t === 'put' || t === 'c' || t === 'p') return 'option';
  }
  if (multiplierVal && parseNumber(multiplierVal) === 100) return 'option';
  if (instrType) {
    const t = instrType.toLowerCase();
    if (t.includes('option') || t.includes('opt')) return 'option';
    if (t.includes('stock') || t.includes('equity')) return 'stock';
  }
  // Webull compact option symbol: "AAPL  240315C00170000"
  if (/^[A-Z]+\s+\d{6}[CP]\d+/.test(symbol)) return 'option';
  return 'stock';
}

// ── Build a unique option symbol e.g. "AAPL_C170" ─────────────────────────
function buildSymbol(
  ticker: string,
  optionTypeVal?: string,
  strikeVal?: string,
): string {
  if (!optionTypeVal || !strikeVal) return ticker;
  const typeChar = optionTypeVal.trim().charAt(0).toUpperCase(); // C or P
  const strike   = parseNumber(strikeVal);
  if (!typeChar || !strike) return ticker;
  return `${ticker}_${typeChar}${strike % 1 === 0 ? strike.toFixed(0) : strike.toFixed(2)}`;
}

// ── CSV / TSV parser — supports multi-section files (Stocks + Options) ────
function parseCSVText(text: string): {
  sections: Array<{ headers: string[]; rows: RawRow[] }>;
  delimiter: string;
} {
  const clean = text.replace(/^﻿/, ''); // strip BOM
  const lines = clean.split(/\r?\n/);
  if (lines.length < 2) return { sections: [], delimiter: ',' };

  const firstNonEmpty = lines.find((l) => l.trim()) ?? '';
  const delimiter = detectDelimiter(firstNonEmpty);

  const parseLine = (line: string): string[] => {
    if (delimiter === '\t') return line.split('\t').map((v) => v.trim());
    const result: string[] = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };

  // Find every line that looks like a column header
  const headerIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('symbol') && (lower.includes('buy/sell') || lower.includes('trade date'))) {
      headerIndices.push(i);
    }
  }

  if (headerIndices.length === 0) return { sections: [], delimiter };

  const sections: Array<{ headers: string[]; rows: RawRow[] }> = [];

  for (let s = 0; s < headerIndices.length; s++) {
    const hIdx = headerIndices[s];
    const endIdx = s + 1 < headerIndices.length ? headerIndices[s + 1] : lines.length;
    const headers = parseLine(lines[hIdx]);
    const rows: RawRow[] = [];

    for (let i = hIdx + 1; i < endIdx; i++) {
      if (!lines[i].trim()) continue;
      const vals = parseLine(lines[i]);
      const firstVal = vals[0]?.toLowerCase().trim() ?? '';
      if (['total', 'summary', 'subtotal'].includes(firstVal)) continue;
      // Skip section-title rows that don't have enough data columns
      const nonEmpty = vals.filter((v) => v.trim()).length;
      if (nonEmpty < Math.max(3, Math.ceil(headers.length / 2))) continue;
      const row: RawRow = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
      rows.push(row);
    }

    if (rows.length > 0) sections.push({ headers, rows });
  }

  return { sections, delimiter };
}

// ── Map raw rows → ParsedTransaction ─────────────────────────────────────
function mapRows(headers: string[], rows: RawRow[]): ParsedTransaction[] {
  // Use strict exact matching for the known Webull options format to avoid
  // fuzzy collisions (e.g. 'qty' partial-matching 'quantity' in wrong position)
  const webullOpt = isWebullOptionsFormat(headers);

  const symbolCol     = webullOpt ? exactCol(headers, 'symbol & name')  : findCol(headers, 'symbol & name', 'symbol', 'ticker', 'symb', 'underlying');
  const sideCol       = webullOpt ? exactCol(headers, 'buy/sell')       : findCol(headers, 'buy/sell', 'side', 'action', 'trans type');
  const qtyCol        = webullOpt ? exactCol(headers, 'quantity')       : findCol(headers, 'quantity', 'filled qty', 'qty', 'shares', 'executed qty');
  const priceCol      = webullOpt ? exactCol(headers, 'traded price')   : findCol(headers, 'traded price', 'trade price', 'avg price', 'avgprice', 'average price', 'price', 'fill price', 'exec price');
  const dateCol       = webullOpt ? exactCol(headers, 'trade date')     : findCol(headers, 'trade date', 'create time', 'time', 'date', 'execution time', 'settlement date');
  const commCol       = webullOpt ? exactCol(headers, 'comm/fee/tax')   : findCol(headers, 'comm/fee/tax', 'commission/fees', 'commission', 'fees', 'fee', 'total fees', 'comm');
  const vatCol        = webullOpt ? exactCol(headers, 'vat')            : findCol(headers, 'vat');
  const optionTypeCol = webullOpt ? exactCol(headers, 'type')           : findCol(headers, 'type');
  const strikeCol     = webullOpt ? exactCol(headers, 'strike price')   : findCol(headers, 'strike price', 'strike');
  const expiryCol     = webullOpt ? exactCol(headers, 'expiry date')    : findCol(headers, 'expiry date', 'expiration date', 'expiry');
  const multCol       = webullOpt ? exactCol(headers, 'multiplier')     : findCol(headers, 'multiplier');
  const instrCol      = findCol(headers, 'instrument type', 'asset type', 'product type', 'security type');
  const statusCol     = findCol(headers, 'status', 'order status');

  return rows
    .filter((row) => {
      // Skip duplicate header rows that Webull sometimes repeats mid-file
      const symVal = (symbolCol ? row[symbolCol] : '').toLowerCase().trim();
      if (['symbol & name', 'symbol', 'ticker'].includes(symVal)) return false;
      if (!statusCol) return true;
      const s = row[statusCol]?.toLowerCase().trim();
      if (!s) return true;
      return ['filled', 'executed', 'complete', 'completed'].includes(s);
    })
    .map((row): ParsedTransaction => {
      const rawSymbol  = symbolCol    ? row[symbolCol]    : '';
      const sideRaw    = sideCol      ? row[sideCol]      : '';
      const optTypeVal = optionTypeCol ? row[optionTypeCol] : '';
      const strikeVal  = strikeCol    ? row[strikeCol]    : '';
      const multVal    = multCol      ? row[multCol]      : '';
      const instrVal   = instrCol     ? row[instrCol]     : '';

      const ticker = extractTicker(rawSymbol);
      const side   = detectSide(sideRaw);
      // Use Math.abs — some brokers store sell quantity as negative
      const qty    = Math.abs(parseNumber(qtyCol  ? row[qtyCol]  : '0'));
      const price  = Math.abs(parseNumber(priceCol ? row[priceCol] : '0'));
      const dateRaw = dateCol ? row[dateCol] : '';
      const comm   = Math.abs(parseNumber(commCol ? row[commCol] : '0'));
      const vat    = Math.abs(parseNumber(vatCol  ? row[vatCol]  : '0'));
      const assetType = detectAssetType(rawSymbol, instrVal, optTypeVal, multVal);
      const symbol = assetType === 'option'
        ? buildSymbol(ticker, optTypeVal, strikeVal)
        : ticker;

      const rawQtyStr = qtyCol ? row[qtyCol] : '';

      if (!ticker)  return { symbol: '?',    type: 'buy', quantity: 0, price: 0, date: '', commission: 0, assetType: 'stock', error: 'ไม่พบสัญลักษณ์' };
      if (!side)    return { symbol: ticker, type: 'buy', quantity: 0, price: 0, date: '', commission: 0, assetType, error: `ไม่รู้จักประเภท: "${sideRaw}"` };
      if (qty <= 0) return { symbol,         type: side,  quantity: 0, price: 0, date: '', commission: 0, assetType, error: `จำนวนไม่ถูกต้อง (ค่า: "${rawQtyStr}")` };
      if (price <= 0) return { symbol,       type: side,  quantity: qty, price: 0, date: '', commission: comm + vat, assetType, error: 'ราคาไม่ถูกต้อง' };

      return {
        symbol,
        type: side,
        quantity: qty,
        price,
        date: parseDate(dateRaw),
        commission: comm + vat,
        assetType,
      };
    });
}

// ══════════════════════════════════════════════════════════════════════════════
export default function WebullImport({ onSuccess }: { onSuccess?: () => void }) {
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const [dragging, setDragging]   = useState(false);
  const [preview, setPreview]     = useState<ParsedTransaction[]>([]);
  const [fileName, setFileName]   = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState<{ success: number; failed: number } | null>(null);
  const [detectedDelimiter, setDetectedDelimiter] = useState<string>(',');
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.csv') && !ext.endsWith('.tsv') && !ext.endsWith('.txt')) {
      alert('กรุณาเลือกไฟล์ .csv หรือ .tsv จาก Webull');
      return;
    }
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { sections, delimiter } = parseCSVText(text);
      setDetectedDelimiter(delimiter);
      if (sections.length === 0) {
        alert(
          'ไม่พบข้อมูลในไฟล์ หรือรูปแบบไม่รองรับ\n\n' +
          'ตรวจสอบว่า export มาจาก Webull Trade History / Order History\n' +
          `(รูปแบบที่ตรวจพบ: ${delimiter === '\t' ? 'Tab-separated' : 'Comma-separated'})`
        );
        return;
      }
      // Parse each section (Stocks / Options) with its own header independently
      const allParsed = sections.flatMap(({ headers, rows }) => mapRows(headers, rows));
      setPreview(allParsed);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const validRows   = preview.filter((r) => !r.error);
  const invalidRows = preview.filter((r) => r.error);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    let success = 0, failed = 0;

    for (const row of validRows) {
      try {
        await addTransaction({
          symbol:     row.symbol,
          type:       row.type,
          quantity:   row.quantity,
          price:      row.price,
          date:       new Date(row.date + 'T00:00:00Z'),
          commission: row.commission,
          assetType:  row.assetType,
        });
        success++;
      } catch { failed++; }
    }

    setImporting(false);
    setResult({ success, failed });
    setPreview([]);
    setFileName('');
    if (success > 0) onSuccess?.();
  };

  const handleReset = () => {
    setPreview([]);
    setFileName('');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Result screen ────────────────────────────────────────────────────────
  if (result) return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">📥 Import จาก Webull</h2>
      <div className={`p-4 rounded-lg ${result.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        <p className="font-semibold text-green-700 text-lg">
          ✅ นำเข้าสำเร็จ {result.success} รายการ
          {result.failed > 0 && <span className="text-yellow-600 ml-2">(ล้มเหลว {result.failed} รายการ)</span>}
        </p>
      </div>
      <button onClick={handleReset} className="mt-4 btn btn-secondary text-sm">นำเข้าไฟล์ใหม่</button>
    </div>
  );

  // ── Upload screen ────────────────────────────────────────────────────────
  if (preview.length === 0) return (
    <div className="card">
      <h2 className="text-xl font-bold mb-1">📥 Import จาก Webull</h2>
      <p className="text-gray-500 text-sm mb-5">
        รองรับทั้ง Stock และ Option — CSV และ TSV (Tab-separated)
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          dragging ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <p className="text-5xl mb-3">📄</p>
        <p className="font-semibold text-gray-700 text-lg">ลากไฟล์มาวางที่นี่</p>
        <p className="text-gray-400 text-sm mt-1">หรือคลิกเพื่อเลือกไฟล์ .csv / .tsv</p>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFileChange} />

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <p className="font-semibold text-blue-800 mb-2">📈 Stock — วิธี Export</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700">
            <li>Orders → History</li>
            <li>กด Export / ไอคอน ⬇️</li>
            <li>เลือกช่วงวันที่ → Download .csv</li>
          </ol>
        </div>
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-sm">
          <p className="font-semibold text-purple-800 mb-2">🎯 Option — วิธี Export</p>
          <ol className="list-decimal list-inside space-y-1 text-purple-700">
            <li>Options → Trade History</li>
            <li>กด Export / Download</li>
            <li>เลือกช่วงวันที่ → Download .csv</li>
          </ol>
          <p className="text-purple-500 text-xs mt-2">
            ชื่อ option จะถูก format เป็น AAPL_C170 โดยอัตโนมัติ
          </p>
        </div>
      </div>
    </div>
  );

  // ── Preview screen ───────────────────────────────────────────────────────
  return (
    <div className="card">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="text-xl font-bold">📥 ตรวจสอบก่อนนำเข้า</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            📄 {fileName}
            <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500">
              {detectedDelimiter === '\t' ? 'Tab-separated' : 'Comma-separated'}
            </span>
          </p>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-emerald-600 font-semibold">✅ นำเข้าได้: {validRows.length} รายการ</span>
            {invalidRows.length > 0 && (
              <span className="text-red-500 font-semibold">❌ มีปัญหา: {invalidRows.length} รายการ</span>
            )}
          </div>
        </div>
        <button onClick={handleReset} className="btn btn-secondary text-sm">✕ ยกเลิก</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 mb-5">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-3 py-2.5 font-semibold">สถานะ</th>
              <th className="px-3 py-2.5 font-semibold">สัญลักษณ์</th>
              <th className="px-3 py-2.5 font-semibold">ประเภท</th>
              <th className="px-3 py-2.5 font-semibold">สินทรัพย์</th>
              <th className="px-3 py-2.5 font-semibold text-right">จำนวน</th>
              <th className="px-3 py-2.5 font-semibold text-right">ราคา</th>
              <th className="px-3 py-2.5 font-semibold text-right">ค่าธรรมเนียม</th>
              <th className="px-3 py-2.5 font-semibold">วันที่</th>
            </tr>
          </thead>
          <tbody>
            {preview.slice(0, 25).map((row, idx) => (
              <tr key={idx} className={`border-t ${row.error ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="px-3 py-2">
                  {row.error
                    ? <span className="text-red-500 text-xs font-medium">❌ {row.error}</span>
                    : <span className="text-emerald-600 text-xs font-medium">✅ โอเค</span>
                  }
                </td>
                <td className="px-3 py-2 font-bold text-gray-900">{row.symbol || '—'}</td>
                <td className="px-3 py-2">
                  {!row.error && (
                    <span className={`px-2 py-0.5 rounded-full text-white text-xs font-semibold ${row.type === 'buy' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                      {row.type === 'buy' ? 'ซื้อ' : 'ขาย'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${row.assetType === 'option' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {row.assetType === 'option' ? 'Option' : 'Stock'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-medium">{row.error ? '—' : row.quantity}</td>
                <td className="px-3 py-2 text-right">{row.price ? `$${row.price.toFixed(4)}` : '—'}</td>
                <td className="px-3 py-2 text-right text-gray-500">${row.commission.toFixed(2)}</td>
                <td className="px-3 py-2 text-gray-600">{row.date || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {preview.length > 25 && (
          <p className="text-xs text-gray-400 text-center py-2 border-t">
            แสดง 25 จาก {preview.length} รายการ
          </p>
        )}
      </div>

      {invalidRows.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          ⚠️ รายการที่มีปัญหาจะถูกข้ามไป ระบบจะนำเข้าเฉพาะ {validRows.length} รายการที่ถูกต้อง
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button onClick={handleReset} disabled={importing} className="btn btn-secondary">ยกเลิก</button>
        <button
          onClick={handleImport}
          disabled={validRows.length === 0 || importing}
          className="btn btn-primary disabled:opacity-50 min-w-36"
        >
          {importing ? '⏳ กำลังนำเข้า...' : `✅ นำเข้า ${validRows.length} รายการ`}
        </button>
      </div>
    </div>
  );
}
