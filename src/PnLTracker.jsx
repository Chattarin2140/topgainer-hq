import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  supabaseEnabled,
  getSession,
  onAuthChange,
  signIn,
  signUp,
  signOut,
  loadPortfolio,
  savePortfolio,
} from './lib/supabase';
import { C, FONT, STRATEGIES, STRATEGY_COLORS, DONUT_PALETTE, inputStyle } from './constants';
import { AuthBar, AuthModal } from './components/Auth';

const LS_KEY = 'pnl-tracker-v1';
const SNAPSHOT_VERSION = 1;

/* ============================================================================
   HELPERS
   ========================================================================== */
const usdFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return usdFmt.format(n);
};

const newId = () => crypto.randomUUID();

// Robust numeric parse: strips currency symbols, commas, %, whitespace,
// and converts parenthesised negatives e.g. "(1,234.50)" -> -1234.5
const parseNum = (raw) => {
  if (raw === null || raw === undefined) return 0;
  let s = String(raw).trim();
  if (s === '' || s === '--' || s === '—' || s.toLowerCase() === 'n/a') return 0;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,%\s]/g, '');
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  const v = parseFloat(s);
  if (isNaN(v)) return 0;
  return neg ? -v : v;
};

const isEmpty = (v) => v === '' || v === null || v === undefined;

/* ----------------------------------------------------------------------------
   CSV PARSING — handles quoted fields, escaped quotes ("") and trimming
   -------------------------------------------------------------------------- */
const parseCSVLine = (line) => {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
};

const parseCSV = (text) => {
  const clean = text.replace(/^\uFEFF/, ''); // strip BOM
  const lines = clean
    .split(/\r\n|\n|\r/)
    .map((l) => l)
    .filter((l) => l.trim() !== '');
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(parseCSVLine);
  return { headers, rows };
};

// build a case/space-insensitive header -> index lookup
const headerIndex = (headers) => {
  const map = {};
  headers.forEach((h, i) => {
    const key = h.toLowerCase().replace(/[\s_./%&()]+/g, '');
    if (!(key in map)) map[key] = i;
  });
  return (...names) => {
    for (const n of names) {
      const key = n.toLowerCase().replace(/[\s_./%&()]+/g, '');
      if (key in map) return map[key];
    }
    return -1;
  };
};

// Detect whether a parsed CSV is the Options export or the Positions export.
const detectFormat = (headers) => {
  const idx = headerIndex(headers);
  const hasStrike = idx('strike', 'strikeprice') !== -1;
  const hasExpiry = idx('expirationdate', 'expiration', 'expiry') !== -1;
  const hasType = idx('type') !== -1;
  if (hasStrike && (hasExpiry || hasType)) return 'option';
  return 'stock';
};

const parseStockCSV = (headers, rows) => {
  const idx = headerIndex(headers);
  const iSym = idx('symbol', 'symbolname');
  const iQty = idx('quantity', 'qty');
  const iMkt = idx('marketprice', 'lastprice', 'price');
  const iAvg = idx('averagecost', 'avgcost', 'avgprice', 'cost');
  const iCostBasis = idx('costbasis');
  if (iSym === -1 || iQty === -1) throw new Error('Missing stock columns');
  const out = [];
  for (const r of rows) {
    const symRaw = (r[iSym] || '').trim();
    if (!symRaw) continue;
    // keep the leading ticker token only (Webull sometimes appends a name)
    const symbol = symRaw.split(/\s+/)[0].toUpperCase();
    const qty = parseNum(r[iQty]);
    const avg = iAvg !== -1 ? parseNum(r[iAvg]) : 0;
    const mkt = iMkt !== -1 ? parseNum(r[iMkt]) : 0;
    // Commission = Cost Basis − (Quantity × Average Cost), default 0 if missing
    let commission = 0;
    if (iCostBasis !== -1) {
      const cb = parseNum(r[iCostBasis]);
      commission = cb - qty * avg;
      if (isNaN(commission)) commission = 0;
      // round away floating noise
      commission = Math.round(commission * 100) / 100;
    }
    out.push({
      id: newId(),
      symbol,
      quantity: qty ? String(qty) : '',
      buyPrice: avg ? String(avg) : '',
      currentPrice: mkt ? String(mkt) : '',
      commission: String(commission),
    });
  }
  return out;
};

const deriveStrategy = (type, qty) => {
  const t = (type || '').toLowerCase();
  const isPut = t.includes('put') || /\bp\b/.test(t) || t.includes('-p');
  const isCall = t.includes('call') || /\bc\b/.test(t) || t.includes('-c');
  const long = qty >= 0;
  if (isPut) return long ? 'Long Put' : 'Short Put';
  if (isCall) return long ? 'Long Call' : 'Short Call';
  // default to call if we cannot tell
  return long ? 'Long Call' : 'Short Call';
};

const parseOptionCSV = (headers, rows) => {
  const idx = headerIndex(headers);
  const iSym = idx('symbol', 'symbolname');
  const iType = idx('type', 'callput', 'optiontype');
  const iExp = idx('expirationdate', 'expiration', 'expiry');
  const iStrike = idx('strike', 'strikeprice');
  const iQty = idx('qty', 'quantity');
  const iAvg = idx('avgprice', 'averageprice', 'averagecost', 'premiumpaid');
  const iLast = idx('lastprice', 'currentpremium', 'marketprice');
  if (iSym === -1 || iStrike === -1) throw new Error('Missing option columns');
  const out = [];
  for (const r of rows) {
    const symRaw = (r[iSym] || '').trim();
    if (!symRaw) continue;
    // strip option-chain suffix: "AAPL 01/17/2025 C150" -> "AAPL"
    const symbol = symRaw.split(/\s+/)[0].toUpperCase();
    const qty = parseNum(r[iQty]);
    const type = iType !== -1 ? r[iType] : symRaw;
    const strategy = deriveStrategy(type, qty);
    const strike = iStrike !== -1 ? parseNum(r[iStrike]) : 0;
    const expiry = iExp !== -1 ? normalizeDate(r[iExp]) : '';
    const avg = iAvg !== -1 ? parseNum(r[iAvg]) : 0;
    const last = iLast !== -1 ? parseNum(r[iLast]) : 0;
    out.push({
      id: newId(),
      symbol,
      strategy,
      strike: strike ? String(strike) : '',
      expiry,
      contracts: String(Math.abs(qty) || 1),
      premiumPaid: avg ? String(avg) : '',
      currentPremium: last ? String(last) : '',
    });
  }
  return out;
};

// normalise common date encodings to YYYY-MM-DD where possible.
// preferDMY: when both parts are <= 12 (ambiguous), treat as DD/MM/YYYY.
const smartDate = (raw, preferDMY) => {
  const s = (raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already ISO
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!m) return '';
  let a = parseInt(m[1], 10);
  let b = parseInt(m[2], 10);
  const y = m[3];
  let day, month;
  if (a > 12) {
    day = a;
    month = b;
  } else if (b > 12) {
    month = a;
    day = b;
  } else if (preferDMY) {
    day = a;
    month = b;
  } else {
    month = a;
    day = b;
  }
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// Standard Webull export uses MM/DD/YYYY
const normalizeDate = (raw) => smartDate(raw, false);

const strategyFromBuySell = (type, buySell) => {
  const t = (type || '').toLowerCase();
  const isPut = t.includes('put');
  const long = !/sell|short/i.test(buySell || '');
  if (isPut) return long ? 'Long Put' : 'Short Put';
  return long ? 'Long Call' : 'Short Call';
};

/* ----------------------------------------------------------------------------
   WEBULL MONTHLY STATEMENT — multi-section file.
   We import the PORTFOLIO SUMMARY holdings (current positions), which map to
   the tracker's row model. Falls back to TRADE RECORDS aggregation only if no
   summary is present is NOT done here — summary is the source of truth.
   -------------------------------------------------------------------------- */
const isMonthlyStatement = (text) =>
  /monthly statement|portfolio summary|trade records/i.test(text);

const parseMonthlyStatement = (text) => {
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r\n|\n|\r/).map(parseCSVLine);

  const stocks = [];
  const options = [];

  const isStockSummaryHeader = (h) => {
    const k = h.map((c) => c.toLowerCase());
    const has = (s) => k.some((c) => c.includes(s));
    return has('cost basis') && has('closing price') && !has('strike');
  };
  const isOptionSummaryHeader = (h) => {
    const k = h.map((c) => c.toLowerCase());
    const has = (s) => k.some((c) => c.includes(s));
    return has('strike') && has('closing price') && has('expiry');
  };

  // a data row ends a block when its first cell is empty or it is a section label
  const isStopRow = (row) => {
    const first = (row[0] || '').trim();
    if (first === '') return true;
    if (/^(stocks|options|portfolio advisory|portfolio summary|trade records)$/i.test(first))
      return true;
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (isStockSummaryHeader(row)) {
      const idx = headerIndex(row);
      const iSym = idx('symbol & name', 'symbolname', 'symbol');
      const iQty = idx('quantity', 'qty');
      const iAvg = idx('average price', 'averageprice', 'avgprice');
      const iCost = idx('cost basis', 'costbasis');
      const iClose = idx('closing price', 'closingprice', 'marketprice');
      for (let j = i + 1; j < lines.length; j++) {
        const r = lines[j];
        if (isStopRow(r)) {
          i = j - 1;
          break;
        }
        const symbol = (r[iSym] || '').trim().split(/\s+/)[0].toUpperCase();
        if (!symbol) continue;
        const qty = parseNum(r[iQty]);
        const avg = iAvg !== -1 ? parseNum(r[iAvg]) : 0;
        const close = iClose !== -1 ? parseNum(r[iClose]) : 0;
        let commission = 0;
        if (iCost !== -1) {
          commission = Math.round((parseNum(r[iCost]) - qty * avg) * 100) / 100;
          if (isNaN(commission)) commission = 0;
        }
        stocks.push({
          id: newId(),
          symbol,
          quantity: qty ? String(qty) : '',
          buyPrice: avg ? String(avg) : '',
          currentPrice: close ? String(close) : '',
          commission: String(commission),
        });
      }
    } else if (isOptionSummaryHeader(row)) {
      const idx = headerIndex(row);
      const iSym = idx('symbol & name', 'symbolname', 'symbol');
      const iBS = idx('buy/sell', 'buysell');
      const iType = idx('type');
      const iStrike = idx('strike price', 'strikeprice', 'strike');
      const iExp = idx('expiry date', 'expirydate', 'expiration', 'expiry');
      const iQty = idx('quantity', 'qty');
      const iAvg = idx('average price', 'averageprice', 'avgprice');
      const iClose = idx('closing price', 'closingprice', 'lastprice');
      for (let j = i + 1; j < lines.length; j++) {
        const r = lines[j];
        if (isStopRow(r)) {
          i = j - 1;
          break;
        }
        const symbol = (r[iSym] || '').trim().split(/\s+/)[0].toUpperCase();
        if (!symbol) continue;
        const qty = parseNum(r[iQty]);
        const strike = iStrike !== -1 ? parseNum(r[iStrike]) : 0;
        const expiry = iExp !== -1 ? smartDate(r[iExp], true) : '';
        const avg = iAvg !== -1 ? parseNum(r[iAvg]) : 0;
        const close = iClose !== -1 ? parseNum(r[iClose]) : 0;
        const bs = iBS !== -1 ? r[iBS] : '';
        const type = iType !== -1 ? r[iType] : '';
        options.push({
          id: newId(),
          symbol,
          strategy: strategyFromBuySell(type, bs),
          strike: strike ? String(strike) : '',
          expiry,
          contracts: String(Math.abs(qty) || 1),
          premiumPaid: avg ? String(avg) : '',
          currentPremium: close ? String(close) : '',
        });
      }
    }
  }

  return { stocks, options };
};

/* ----------------------------------------------------------------------------
   FIFO REALIZED P&L — matches opposing trades oldest-first, supports both
   long-first and short-first (sell-to-open) sequences and fractional qty.
   -------------------------------------------------------------------------- */
const EPS = 1e-9;

const fifoRealized = (trades, multiplier) => {
  // chronological order is essential for FIFO
  const sorted = [...trades].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const lots = []; // open lots: { qty (signed), price }
  const closed = []; // { qty, buyPrice, sellPrice, pnl }
  let feeTotal = 0;

  for (const t of sorted) {
    feeTotal += t.fee; // fees are stored negative
    let q = t.side === 'BUY' ? t.qty : -t.qty; // signed remaining qty of this trade
    const price = t.price;
    while (Math.abs(q) > EPS && lots.length && lots[0].qty * q < 0) {
      const lot = lots[0];
      const matched = Math.min(Math.abs(lot.qty), Math.abs(q));
      let pnl;
      if (lot.qty > 0) {
        // long lot closed by a sell
        pnl = (price - lot.price) * matched * multiplier;
        closed.push({ qty: matched, buyPrice: lot.price, sellPrice: price, pnl, date: t.date });
      } else {
        // short lot closed by a buy
        pnl = (lot.price - price) * matched * multiplier;
        closed.push({ qty: matched, buyPrice: price, sellPrice: lot.price, pnl, date: t.date });
      }
      lot.qty += lot.qty > 0 ? -matched : matched;
      q += q > 0 ? -matched : matched;
      if (Math.abs(lot.qty) < EPS) lots.shift();
    }
    if (Math.abs(q) > EPS) lots.push({ qty: q, price });
  }
  return { closed, feeTotal };
};

/* ----------------------------------------------------------------------------
   Parse the TRADE RECORDS sections (Stocks + Options) into realized P&L rows.
   -------------------------------------------------------------------------- */
const parseTradeRecords = (text) => {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/).map(parseCSVLine);
  const has = (h, s) => h.map((c) => c.toLowerCase()).some((c) => c.includes(s));
  const isTradeStockH = (h) => has(h, 'traded price') && has(h, 'net amount') && !has(h, 'strike');
  const isTradeOptionH = (h) => has(h, 'traded price') && has(h, 'strike') && has(h, 'expiry');
  const isStop = (row) => {
    const f = (row[0] || '').trim();
    if (f === '') return true;
    if (/^(stocks|options|portfolio advisory|portfolio summary|trade records|currency|multi portfolio)/i.test(f))
      return true;
    return false;
  };

  const groups = new Map();
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    const isOpt = isTradeOptionH(row);
    const isStk = !isOpt && isTradeStockH(row);
    if (!isOpt && !isStk) continue;
    const idx = headerIndex(row);
    const iSym = idx('symbol & name', 'symbolname', 'symbol');
    const iDate = idx('trade date', 'tradedate');
    const iBS = idx('buy/sell', 'buysell');
    const iQty = idx('quantity', 'qty');
    const iPrice = idx('traded price', 'tradedprice');
    const iComm = idx('comm/fee/tax', 'commission', 'commfeetax');
    const iVat = idx('vat');
    const iType = idx('type');
    const iStrike = idx('strike price', 'strikeprice');
    const iExp = idx('expiry date', 'expirydate');
    const iMult = idx('multiplier', 'multi');

    for (let j = i + 1; j < lines.length; j++) {
      const r = lines[j];
      if (isStop(r)) {
        i = j - 1;
        break;
      }
      const symRaw = (r[iSym] || '').trim();
      if (!symRaw) continue;
      const symbol = symRaw.split(/\s+/)[0].toUpperCase();
      const qty = Math.abs(parseNum(r[iQty]));
      if (qty <= 0) continue;
      const side = /sell/i.test(r[iBS] || '') ? 'SELL' : 'BUY';
      const price = parseNum(r[iPrice]);
      const fee =
        (iComm !== -1 ? parseNum(r[iComm]) : 0) + (iVat !== -1 ? parseNum(r[iVat]) : 0);
      const date = iDate !== -1 ? smartDate(r[iDate], true) : '';

      let key, meta, mult;
      if (isOpt) {
        const type = (iType !== -1 ? r[iType] : '').toUpperCase();
        const strike = iStrike !== -1 ? parseNum(r[iStrike]) : 0;
        const expiry = iExp !== -1 ? smartDate(r[iExp], true) : '';
        mult = iMult !== -1 && parseNum(r[iMult]) ? parseNum(r[iMult]) : 100;
        key = `O|${symbol}|${type}|${strike}|${expiry}`;
        meta = { isOption: true, symbol, type, strike, expiry };
      } else {
        mult = 1;
        key = `S|${symbol}`;
        meta = { isOption: false, symbol };
      }
      if (!groups.has(key)) groups.set(key, { ...meta, multiplier: mult, trades: [] });
      groups.get(key).trades.push({ side, qty, price, fee, date });
    }
  }

  const out = [];
  const dayMap = new Map(); // date -> { gross, fee, count, wins }
  const bumpDay = (date) => {
    if (!dayMap.has(date)) dayMap.set(date, { gross: 0, fee: 0, count: 0, wins: 0 });
    return dayMap.get(date);
  };

  groups.forEach((g) => {
    const { closed, feeTotal } = fifoRealized(g.trades, g.multiplier);
    // daily realized (keyed by the date of the closing trade)
    closed.forEach((c) => {
      const d = bumpDay(c.date || '—');
      d.gross += c.pnl;
      d.count += 1;
      if (c.pnl > 0) d.wins += 1;
    });
    // fees attributed to the day each trade occurred
    g.trades.forEach((t) => {
      bumpDay(t.date || '—').fee += t.fee;
    });

    if (!closed.length) return;
    let qtySum = 0;
    let buyNot = 0;
    let sellNot = 0;
    let gross = 0;
    closed.forEach((c) => {
      qtySum += c.qty;
      buyNot += c.buyPrice * c.qty;
      sellNot += c.sellPrice * c.qty;
      gross += c.pnl;
    });
    out.push({
      id: newId(),
      symbol: g.symbol,
      kind: g.isOption ? (g.type.includes('PUT') ? 'Put' : 'Call') : 'Stock',
      strike: g.isOption ? g.strike : null,
      expiry: g.isOption ? g.expiry : null,
      qty: qtySum,
      avgBuy: qtySum ? buyNot / qtySum : 0,
      avgSell: qtySum ? sellNot / qtySum : 0,
      pnl: gross + feeTotal, // net of fees
    });
  });
  out.sort((a, b) => b.pnl - a.pnl);

  const daily = [];
  dayMap.forEach((v, date) => {
    if (v.count === 0) return; // only days that actually closed something
    daily.push({
      id: newId(),
      date,
      pnl: v.gross + v.fee,
      count: v.count,
      wins: v.wins,
    });
  });
  daily.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return { instruments: out, daily };
};

// merge daily rows by date when importing more than one statement
const mergeDaily = (prev, incoming) => {
  const map = new Map();
  [...prev, ...incoming].forEach((d) => {
    if (map.has(d.date)) {
      const e = map.get(d.date);
      e.pnl += d.pnl;
      e.count += d.count;
      e.wins += d.wins;
    } else {
      map.set(d.date, { ...d });
    }
  });
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
};

const fmtQty = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return String(Number(Number(n).toFixed(4)));
};

/* deduplication keys — used to skip exact duplicate rows on import */
const stockKey = (r) => `${r.symbol}|${r.quantity}|${r.buyPrice}`;
const optionKey = (r) => `${r.symbol}|${r.strategy}|${r.strike}|${r.expiry}|${r.contracts}|${r.premiumPaid}`;

const dedupeAppend = (existing, incoming, keyFn) => {
  const seen = new Set(existing.map(keyFn));
  return incoming.filter((r) => !seen.has(keyFn(r)));
};

/* ============================================================================
   SHARED UI PIECES
   ========================================================================== */
function Field({ value, onChange, type = 'text', placeholder, style }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      step="any"
      style={{
        ...inputStyle,
        borderColor: focused ? C.accent : C.border,
        ...style,
      }}
    />
  );
}

function Cell({ children, color, align = 'right', bold }) {
  return (
    <td
      style={{
        padding: '6px 10px',
        textAlign: align,
        color: color || C.text,
        fontWeight: bold ? 700 : 400,
        fontSize: 13,
        whiteSpace: 'nowrap',
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {children}
    </td>
  );
}

function Th({ children, align = 'right' }) {
  return (
    <th
      style={{
        padding: '8px 10px',
        textAlign: align,
        color: C.muted,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {children}
    </th>
  );
}

function RemoveBtn({ onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Remove row"
      style={{
        background: 'transparent',
        border: `1px solid ${hover ? C.red : C.border}`,
        color: hover ? C.red : C.muted,
        borderRadius: 6,
        width: 28,
        height: 28,
        cursor: 'pointer',
        fontSize: 13,
        lineHeight: 1,
        fontFamily: FONT,
        transition: 'all 0.15s ease',
      }}
    >
      ✕
    </button>
  );
}

function AddBtn({ onClick, label }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'transparent',
        border: `1px dashed ${hover ? C.accent : C.border}`,
        color: hover ? C.accent : C.muted,
        borderRadius: 8,
        padding: '10px 16px',
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: FONT,
        marginTop: 14,
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div
      style={{
        flex: 1,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '16px 18px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: C.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || C.text }}>
        {value}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   UPLOAD ZONE (drag & drop + click)
   -------------------------------------------------------------------------- */
function UploadZone({ onFile, onPasteClick }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        onClick={() => inputRef.current && inputRef.current.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${drag ? C.accent : C.border}`,
          borderRadius: 12,
          padding: '22px 18px',
          textAlign: 'center',
          cursor: 'pointer',
          background: drag ? 'rgba(0,212,255,0.05)' : C.surface,
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ fontSize: 26, marginBottom: 6 }}>☁️</div>
        <div style={{ color: C.text, fontSize: 14 }}>
          Drop Webull CSV here or click to browse
        </div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
          Positions or Options export — both supported
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files && e.target.files[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />
      </div>
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <button
          onClick={onPasteClick}
          style={{
            background: 'transparent',
            border: `1px solid ${C.border}`,
            color: C.muted,
            borderRadius: 8,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: FONT,
          }}
        >
          📋 Paste CSV
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   PASTE CSV MODAL
   -------------------------------------------------------------------------- */
function PasteModal({ open, onClose, onImport }) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!open) setText('');
  }, [open]);
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 22,
          width: 'min(620px, 92vw)',
        }}
      >
        <div style={{ fontSize: 15, color: C.text, marginBottom: 12, fontWeight: 600 }}>
          Paste Webull CSV
        </div>
        <textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste raw CSV text here…"
          style={{
            ...inputStyle,
            width: '100%',
            resize: 'vertical',
            fontFamily: FONT,
            lineHeight: 1.5,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              color: C.muted,
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: FONT,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onImport(text)}
            style={{
              background: C.accent,
              border: 'none',
              color: '#04222b',
              borderRadius: 8,
              padding: '8px 18px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: FONT,
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   TOASTS
   -------------------------------------------------------------------------- */
function Toasts({ toasts }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 2000,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pnl-toast"
          style={{
            background: C.card,
            border: `1px solid ${t.type === 'success' ? C.green : C.red}`,
            color: t.type === 'success' ? C.green : C.red,
            borderRadius: 10,
            padding: '12px 18px',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            minWidth: 220,
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   CHARTS (hand-drawn SVG, no external libs)
   -------------------------------------------------------------------------- */
function ChartCard({ title, children, empty }) {
  return (
    <div
      style={{
        flex: '1 1 340px',
        minWidth: 300,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '16px 18px',
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: C.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 14,
        }}
      >
        {title}
      </div>
      {empty ? (
        <div style={{ color: C.muted, fontSize: 13, padding: '28px 0', textAlign: 'center' }}>
          — กรอกราคาให้ครบเพื่อแสดงกราฟ —
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// diverging horizontal bar chart for per-position P&L
function PnlBarChart({ data }) {
  if (!data.length) return null;
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const rowH = 26;
  const gap = 10;
  const W = 620;
  const labelW = 78;
  const valueW = 96;
  const plotX = labelW;
  const plotW = W - labelW - valueW;
  const centerX = plotX + plotW / 2;
  const H = data.length * (rowH + gap);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <line x1={centerX} y1={0} x2={centerX} y2={H} stroke={C.border} strokeWidth="1" />
      {data.map((d, i) => {
        const y = i * (rowH + gap);
        const w = Math.max((Math.abs(d.value) / maxAbs) * (plotW / 2), 2);
        const pos = d.value >= 0;
        const color = pos ? C.green : C.red;
        const x = pos ? centerX : centerX - w;
        return (
          <g key={i}>
            <text
              x={plotX - 10}
              y={y + rowH / 2}
              fill={C.text}
              fontSize="12"
              textAnchor="end"
              dominantBaseline="central"
              fontFamily={FONT}
            >
              {d.label}
            </text>
            <rect x={x} y={y} width={w} height={rowH} rx="3" fill={color} opacity="0.9" />
            <text
              x={pos ? x + w + 8 : x - 8}
              y={y + rowH / 2}
              fill={color}
              fontSize="11"
              textAnchor={pos ? 'start' : 'end'}
              dominantBaseline="central"
              fontFamily={FONT}
            >
              {(pos ? '+' : '') + formatUSD(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// donut allocation chart with legend
function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return null;
  const size = 168;
  const stroke = 28;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={stroke} opacity="0.4" />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * circ;
            const el = (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-acc * circ}
              />
            );
            acc += frac;
            return el;
          })}
        </g>
        <text x={cx} y={cy - 7} fill={C.muted} fontSize="9" textAnchor="middle" fontFamily={FONT}>
          TOTAL
        </text>
        <text x={cx} y={cy + 8} fill={C.text} fontSize="12" textAnchor="middle" fontFamily={FONT}>
          {formatUSD(total)}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 130 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <span style={{ color: C.text, flex: 1 }}>{d.label}</span>
            <span style={{ color: C.muted }}>{((d.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// explains why a tab may look empty after importing a monthly statement
function HoldingNote({ kind }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: C.muted,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '9px 12px',
        marginBottom: 16,
        lineHeight: 1.7,
      }}
    >
      ℹ️ แท็บนี้แสดงเฉพาะ{kind}ที่ <b style={{ color: C.text }}>ยังถืออยู่</b> (จาก Webull PORTFOLIO SUMMARY) ·
      รายการที่ <b style={{ color: C.text }}>ขาย/ปิดไปแล้ว</b> ดูกำไร/ขาดทุนจริงที่แท็บ{' '}
      <b style={{ color: C.green }}>💰 Realized</b>
    </div>
  );
}

/* ============================================================================
   STOCK TAB
   ========================================================================== */
const emptyStockRow = () => ({
  id: newId(),
  symbol: '',
  quantity: '',
  buyPrice: '',
  currentPrice: '',
  commission: '0',
});

function calcStock(row) {
  const qty = parseNum(row.quantity);
  const buy = parseNum(row.buyPrice);
  const cur = parseNum(row.currentPrice);
  const comm = parseNum(row.commission);
  const hasInputs = !isEmpty(row.quantity) && !isEmpty(row.buyPrice);
  const costBasis = qty * buy + comm;
  const currentValue = qty * cur;
  const pnl = currentValue - costBasis;
  const pct = costBasis !== 0 ? (pnl / costBasis) * 100 : 0;
  const hasCurrent = !isEmpty(row.currentPrice);
  return { qty, buy, cur, comm, costBasis, currentValue, pnl, pct, hasInputs, hasCurrent };
}

function StockTab({ rows, setRows, onFile, onPasteClick }) {
  const update = useCallback(
    (id, field, value) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    },
    [setRows]
  );
  const remove = useCallback(
    (id) => setRows((prev) => prev.filter((r) => r.id !== id)),
    [setRows]
  );
  const add = useCallback(() => setRows((prev) => [...prev, emptyStockRow()]), [setRows]);

  let totalCost = 0;
  let totalValue = 0;
  const barData = [];
  const donutData = [];
  rows.forEach((r) => {
    const c = calcStock(r);
    if (c.hasInputs) {
      totalCost += c.costBasis;
      if (c.hasCurrent) {
        totalValue += c.currentValue;
        barData.push({ label: r.symbol || '—', value: c.pnl });
        if (c.currentValue > 0)
          donutData.push({ label: r.symbol || '—', value: c.currentValue });
      }
    }
  });
  const netPnl = totalValue - totalCost;
  barData.sort((a, b) => b.value - a.value);
  donutData
    .sort((a, b) => b.value - a.value)
    .forEach((d, i) => {
      d.color = DONUT_PALETTE[i % DONUT_PALETTE.length];
    });

  return (
    <div>
      <UploadZone onFile={onFile} onPasteClick={onPasteClick} />
      <HoldingNote kind="หุ้น" />
      <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            <tr>
              <Th align="left">Symbol</Th>
              <Th>Qty</Th>
              <Th>Buy Price</Th>
              <Th>Current Price</Th>
              <Th>Commission</Th>
              <Th>Cost Basis</Th>
              <Th>Current Value</Th>
              <Th>Unrealized P&L</Th>
              <Th>% Return</Th>
              <Th align="center"></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = calcStock(r);
              const pnlColor = c.pnl >= 0 ? C.green : C.red;
              const show = c.hasInputs && c.hasCurrent;
              return (
                <tr key={r.id}>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, minWidth: 110 }}>
                    <Field
                      value={r.symbol}
                      onChange={(v) => update(r.id, 'symbol', v.toUpperCase())}
                      placeholder="AAPL"
                      style={{ textAlign: 'left' }}
                    />
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, minWidth: 90 }}>
                    <Field type="number" value={r.quantity} onChange={(v) => update(r.id, 'quantity', v)} placeholder="0" style={{ textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, minWidth: 100 }}>
                    <Field type="number" value={r.buyPrice} onChange={(v) => update(r.id, 'buyPrice', v)} placeholder="0.00" style={{ textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, minWidth: 100 }}>
                    <Field type="number" value={r.currentPrice} onChange={(v) => update(r.id, 'currentPrice', v)} placeholder="0.00" style={{ textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, minWidth: 100 }}>
                    <Field type="number" value={r.commission} onChange={(v) => update(r.id, 'commission', v)} placeholder="0" style={{ textAlign: 'right' }} />
                  </td>
                  <Cell>{c.hasInputs ? formatUSD(c.costBasis) : '—'}</Cell>
                  <Cell>{show ? formatUSD(c.currentValue) : '—'}</Cell>
                  <Cell color={pnlColor} bold>
                    {show ? `${c.pnl >= 0 ? '+' : ''}${formatUSD(c.pnl)}` : '—'}
                  </Cell>
                  <Cell color={pnlColor} bold>
                    {show ? `${c.pct >= 0 ? '+' : ''}${c.pct.toFixed(2)}%` : '—'}
                  </Cell>
                  <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>
                    <RemoveBtn onClick={() => remove(r.id)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AddBtn onClick={add} label="+ Add Position" />

      <div style={{ display: 'flex', gap: 14, marginTop: 22 }}>
        <SummaryCard label="Total Cost" value={formatUSD(totalCost)} />
        <SummaryCard label="Total Value" value={formatUSD(totalValue)} />
        <SummaryCard
          label="Net P&L"
          value={`${netPnl >= 0 ? '+' : ''}${formatUSD(netPnl)}`}
          color={netPnl >= 0 ? C.green : C.red}
        />
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
        <ChartCard title="P&L by Position" empty={!barData.length}>
          <PnlBarChart data={barData} />
        </ChartCard>
        <ChartCard title="Allocation by Value" empty={!donutData.length}>
          <DonutChart data={donutData} />
        </ChartCard>
      </div>
    </div>
  );
}

/* ============================================================================
   OPTION TAB
   ========================================================================== */
const emptyOptionRow = () => ({
  id: newId(),
  symbol: '',
  strategy: 'Long Call',
  strike: '',
  expiry: '',
  contracts: '1',
  premiumPaid: '',
  currentPremium: '',
});

const isShort = (strategy) =>
  strategy === 'Short Call' ||
  strategy === 'Short Put' ||
  strategy === 'Iron Condor';
// Bear Put Spread is a long debit spread (buy higher put, sell lower put) — not short

function calcOption(row) {
  const contracts = parseNum(row.contracts) || 0;
  const paid = parseNum(row.premiumPaid);
  const cur = parseNum(row.currentPremium);
  const hasInputs = !isEmpty(row.premiumPaid) && !isEmpty(row.contracts);
  const hasCurrent = !isEmpty(row.currentPremium);
  const short = isShort(row.strategy);
  const totalPaid = paid * contracts * 100;
  const pnl = short
    ? (paid - cur) * contracts * 100
    : (cur - paid) * contracts * 100;
  const pct = totalPaid !== 0 ? (pnl / totalPaid) * 100 : 0;
  const maxLoss = short ? 'Unlimited' : formatUSD(totalPaid);
  const maxGain = short ? formatUSD(totalPaid) : 'Unlimited';
  return { contracts, paid, cur, hasInputs, hasCurrent, short, pnl, pct, maxLoss, maxGain };
}

function OptionTab({ rows, setRows, onFile, onPasteClick }) {
  const update = useCallback(
    (id, field, value) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    },
    [setRows]
  );
  const remove = useCallback(
    (id) => setRows((prev) => prev.filter((r) => r.id !== id)),
    [setRows]
  );
  const add = useCallback(() => setRows((prev) => [...prev, emptyOptionRow()]), [setRows]);

  let netPnl = 0;
  let counted = 0;
  const barData = [];
  const donutData = [];
  rows.forEach((r) => {
    const c = calcOption(r);
    if (c.hasInputs && c.hasCurrent) {
      netPnl += c.pnl;
      counted += 1;
      barData.push({ label: r.symbol || '—', value: c.pnl });
      const mv = c.cur * c.contracts * 100;
      if (mv > 0)
        donutData.push({
          label: r.symbol || '—',
          value: mv,
          color: STRATEGY_COLORS[r.strategy] || C.accent,
        });
    }
  });
  barData.sort((a, b) => b.value - a.value);
  donutData.sort((a, b) => b.value - a.value);

  return (
    <div>
      <UploadZone onFile={onFile} onPasteClick={onPasteClick} />
      <HoldingNote kind="ออปชั่น" />
      <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040 }}>
          <thead>
            <tr>
              <Th align="left">Symbol</Th>
              <Th align="left">Strategy</Th>
              <Th>Strike</Th>
              <Th align="left">Expiry</Th>
              <Th>Contracts</Th>
              <Th>Premium Paid</Th>
              <Th>Current Premium</Th>
              <Th>P&L</Th>
              <Th>% Return</Th>
              <Th>Max Loss</Th>
              <Th>Max Gain</Th>
              <Th align="center"></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = calcOption(r);
              const pnlColor = c.pnl >= 0 ? C.green : C.red;
              const show = c.hasInputs && c.hasCurrent;
              const stratColor = STRATEGY_COLORS[r.strategy] || C.text;
              return (
                <tr key={r.id}>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, minWidth: 100 }}>
                    <Field value={r.symbol} onChange={(v) => update(r.id, 'symbol', v.toUpperCase())} placeholder="AAPL" style={{ textAlign: 'left' }} />
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, minWidth: 150 }}>
                    <select
                      value={r.strategy}
                      onChange={(e) => update(r.id, 'strategy', e.target.value)}
                      style={{
                        ...inputStyle,
                        color: stratColor,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {STRATEGIES.map((s) => (
                        <option key={s} value={s} style={{ color: C.text, background: C.inputBg }}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, minWidth: 90 }}>
                    <Field type="number" value={r.strike} onChange={(v) => update(r.id, 'strike', v)} placeholder="0" style={{ textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, minWidth: 130 }}>
                    <Field value={r.expiry} onChange={(v) => update(r.id, 'expiry', v)} placeholder="YYYY-MM-DD" style={{ textAlign: 'left' }} />
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, minWidth: 90 }}>
                    <Field type="number" value={r.contracts} onChange={(v) => update(r.id, 'contracts', v)} placeholder="1" style={{ textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, minWidth: 100 }}>
                    <Field type="number" value={r.premiumPaid} onChange={(v) => update(r.id, 'premiumPaid', v)} placeholder="0.00" style={{ textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, minWidth: 100 }}>
                    <Field type="number" value={r.currentPremium} onChange={(v) => update(r.id, 'currentPremium', v)} placeholder="0.00" style={{ textAlign: 'right' }} />
                  </td>
                  <Cell color={pnlColor} bold>
                    {show ? `${c.pnl >= 0 ? '+' : ''}${formatUSD(c.pnl)}` : '—'}
                  </Cell>
                  <Cell color={pnlColor} bold>
                    {show ? `${c.pct >= 0 ? '+' : ''}${c.pct.toFixed(2)}%` : '—'}
                  </Cell>
                  <Cell color={c.maxLoss === 'Unlimited' ? C.red : C.text}>
                    {c.hasInputs ? c.maxLoss : '—'}
                  </Cell>
                  <Cell color={c.maxGain === 'Unlimited' ? C.green : C.text}>
                    {c.hasInputs ? c.maxGain : '—'}
                  </Cell>
                  <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>
                    <RemoveBtn onClick={() => remove(r.id)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AddBtn onClick={add} label="+ Add Position" />

      <div style={{ display: 'flex', gap: 14, marginTop: 22 }}>
        <SummaryCard label="Total Positions" value={String(counted)} />
        <SummaryCard
          label="Net Options P&L"
          value={`${netPnl >= 0 ? '+' : ''}${formatUSD(netPnl)}`}
          color={netPnl >= 0 ? C.green : C.red}
        />
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
        <ChartCard title="P&L by Leg" empty={!barData.length}>
          <PnlBarChart data={barData} />
        </ChartCard>
        <ChartCard title="Allocation by Market Value" empty={!donutData.length}>
          <DonutChart data={donutData} />
        </ChartCard>
      </div>

      {/* strategy legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
        {STRATEGIES.map((s) => (
          <span
            key={s}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              padding: '4px 12px',
              fontSize: 11,
              color: C.text,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: STRATEGY_COLORS[s],
                display: 'inline-block',
              }}
            />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   P&L CALENDAR — month grid heat-map of daily realized P&L
   -------------------------------------------------------------------------- */
const monthKey = (iso) => (iso || '').slice(0, 7);
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function PnlCalendar({ daily }) {
  const byDate = {};
  let maxAbs = 1;
  daily.forEach((d) => {
    byDate[d.date] = d;
    maxAbs = Math.max(maxAbs, Math.abs(d.pnl));
  });
  const monthsAvail = [...new Set(daily.map((d) => monthKey(d.date)))].sort();

  const [ym, setYm] = useState('');
  useEffect(() => {
    setYm((cur) => {
      if (cur && (!monthsAvail.length || monthsAvail.includes(cur))) return cur;
      return monthsAvail.length ? monthsAvail[monthsAvail.length - 1] : new Date().toISOString().slice(0, 7);
    });
  }, [monthsAvail.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ym) return null;
  const [y, m] = ym.split('-').map(Number);
  const startDow = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();

  const shift = (delta) => {
    const d = new Date(y, m - 1 + delta, 1);
    setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  let monthTotal = 0;
  let monthTrades = 0;
  daily.forEach((d) => {
    if (monthKey(d.date) === ym) {
      monthTotal += d.pnl;
      monthTrades += d.count;
    }
  });

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${ym}-${String(day).padStart(2, '0')}`;
    cells.push({ day, info: byDate[iso] });
  }

  const fmt = (n) =>
    `${n >= 0 ? '+' : ''}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const navBtn = (label, onClick) => (
    <button
      onClick={onClick}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        color: C.text,
        borderRadius: 8,
        width: 30,
        height: 30,
        cursor: 'pointer',
        fontSize: 14,
        fontFamily: FONT,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>P&L Calendar</span>
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 10 }}>
            {monthTrades} trades · เดือนนี้{' '}
            <span style={{ color: monthTotal >= 0 ? C.green : C.red, fontWeight: 700 }}>{fmt(monthTotal)}</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {navBtn('‹', () => shift(-1))}
          <span style={{ fontSize: 13, color: C.text, minWidth: 72, textAlign: 'center' }}>{ym}</span>
          {navBtn('›', () => shift(1))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {DOW.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: C.muted, padding: '2px 0', textTransform: 'uppercase' }}>
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e${i}`} />;
          const info = cell.info;
          const has = info && info.count > 0;
          const pos = has && info.pnl >= 0;
          const alpha = has ? (0.1 + 0.32 * Math.min(Math.abs(info.pnl) / maxAbs, 1)).toFixed(2) : 0;
          const bg = !has ? 'transparent' : pos ? `rgba(0,230,118,${alpha})` : `rgba(255,71,87,${alpha})`;
          return (
            <div
              key={cell.day}
              style={{
                minHeight: 62,
                borderRadius: 8,
                border: `1px solid ${has ? (pos ? C.green : C.red) : C.border}`,
                background: bg,
                padding: '5px 7px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ fontSize: 11, color: C.muted }}>{cell.day}</div>
              {has && (
                <div style={{ marginTop: 'auto', fontSize: 11.5, fontWeight: 700, color: pos ? C.green : C.red, textAlign: 'right' }}>
                  {fmt(info.pnl)}
                </div>
              )}
              {has && (
                <div style={{ fontSize: 9, color: C.muted, textAlign: 'right' }}>{info.count} ✕</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
   REALIZED P&L TAB (computed from TRADE RECORDS — read only)
   ========================================================================== */
const dmShort = (iso) => {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso || '—';
  return `${m[3]}/${m[2]}`;
};

const kindColor = (kind) =>
  kind === 'Stock' ? C.accent : kind === 'Put' ? C.red : C.green;

function RealizedTab({ rows, daily, onFile, onPasteClick, onClear }) {
  let total = 0;
  rows.forEach((r) => {
    total += r.pnl;
  });
  let totalClosed = 0;
  let wins = 0;
  daily.forEach((d) => {
    totalClosed += d.count;
    wins += d.wins;
  });
  const winRate = totalClosed ? (wins / totalClosed) * 100 : 0;
  const symbolBar = rows.map((r) => ({ label: r.symbol, value: r.pnl })).sort((a, b) => b.value - a.value);
  const dailyBar = daily.map((d) => ({ label: dmShort(d.date), value: d.pnl })); // keep chronological

  const empty = rows.length === 0;

  return (
    <div>
      <UploadZone onFile={onFile} onPasteClick={onPasteClick} />

      {empty ? (
        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '40px 20px',
            textAlign: 'center',
            color: C.muted,
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          ยังไม่มีข้อมูล Realized P&L
          <br />
          นำเข้าไฟล์ Webull Monthly Statement ที่มีส่วน TRADE RECORDS
          <br />
          ระบบจะจับคู่ซื้อ-ขายแบบ FIFO แล้วคำนวณกำไร/ขาดทุนที่เกิดขึ้นจริงให้อัตโนมัติ
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button
              onClick={onClear}
              style={{
                background: 'transparent',
                border: `1px solid ${C.border}`,
                color: C.muted,
                borderRadius: 8,
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: FONT,
              }}
            >
              ล้างข้อมูล Realized
            </button>
          </div>

          {/* summary cards */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
            <SummaryCard label="Closed Trades" value={String(totalClosed)} />
            <SummaryCard label="Win Rate" value={`${winRate.toFixed(1)}%`} color={winRate >= 50 ? C.green : C.yellow} />
            <SummaryCard
              label="Total Realized P&L"
              value={`${total >= 0 ? '+' : ''}${formatUSD(total)}`}
              color={total >= 0 ? C.green : C.red}
            />
          </div>

          {/* DAILY CALENDAR */}
          <div style={{ fontSize: 13, color: C.text, fontWeight: 600, margin: '6px 0 10px' }}>
            สรุปรายวัน (Daily Realized P&L)
          </div>
          <PnlCalendar daily={daily} />
          <div style={{ marginBottom: 24 }}>
            <ChartCard title="P&L by Day" empty={!dailyBar.length}>
              <PnlBarChart data={dailyBar} />
            </ChartCard>
          </div>

          {/* CLOSED TRADES BY INSTRUMENT */}
          <div style={{ fontSize: 13, color: C.text, fontWeight: 600, margin: '6px 0 10px' }}>
            รายการที่ปิดแล้ว (Closed Positions)
          </div>
          <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr>
                  <Th align="left">Symbol</Th>
                  <Th align="left">Type</Th>
                  <Th>Strike</Th>
                  <Th align="left">Expiry</Th>
                  <Th>Qty</Th>
                  <Th>Avg Buy</Th>
                  <Th>Avg Sell</Th>
                  <Th>Realized P&L</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Cell align="left" bold>{r.symbol}</Cell>
                    <Cell align="left" color={kindColor(r.kind)}>{r.kind}</Cell>
                    <Cell>{r.strike != null ? formatUSD(r.strike) : '—'}</Cell>
                    <Cell align="left" color={C.muted}>{r.expiry || '—'}</Cell>
                    <Cell>{fmtQty(r.qty)}</Cell>
                    <Cell>{formatUSD(r.avgBuy)}</Cell>
                    <Cell>{formatUSD(r.avgSell)}</Cell>
                    <Cell color={r.pnl >= 0 ? C.green : C.red} bold>
                      {`${r.pnl >= 0 ? '+' : ''}${formatUSD(r.pnl)}`}
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
            <ChartCard title="Realized P&L by Symbol" empty={!symbolBar.length}>
              <PnlBarChart data={symbolBar} />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================================
   ROOT APP
   ========================================================================== */
export default function PnLTracker() {
  const [tab, setTab] = useState('stock');
  const [stockRows, setStockRows] = useState([emptyStockRow()]);
  const [optionRows, setOptionRows] = useState([emptyOptionRow()]);
  const [realizedRows, setRealizedRows] = useState([]);
  const [dailyRows, setDailyRows] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [pasteOpen, setPasteOpen] = useState(false);

  // persistence / auth
  const mode = supabaseEnabled ? 'cloud' : 'local';
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sync, setSync] = useState('idle'); // idle | saving | saved | error
  const [authModal, setAuthModal] = useState(false);
  const saveTimer = useRef(null);

  const applySnapshot = useCallback((data) => {
    if (!data) return;
    if (Array.isArray(data.stockRows))
      setStockRows(data.stockRows.length ? data.stockRows : [emptyStockRow()]);
    if (Array.isArray(data.optionRows))
      setOptionRows(data.optionRows.length ? data.optionRows : [emptyOptionRow()]);
    if (Array.isArray(data.realizedRows)) setRealizedRows(data.realizedRows);
    if (Array.isArray(data.dailyRows)) setDailyRows(data.dailyRows);
  }, []);

  const resetAll = useCallback(() => {
    setStockRows([emptyStockRow()]);
    setOptionRows([emptyOptionRow()]);
    setRealizedRows([]);
    setDailyRows([]);
  }, []);

  // initial load (local mode)
  useEffect(() => {
    if (mode !== 'local') return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) applySnapshot(JSON.parse(raw));
    } catch {
      /* ignore corrupt storage */
    }
    setAuthReady(true);
    setLoaded(true);
  }, [mode, applySnapshot]);

  // initial load + auth subscription (cloud mode)
  useEffect(() => {
    if (mode !== 'cloud') return;
    let unsub = () => {};
    const hydrate = async (s) => {
      setLoaded(false);
      try {
        applySnapshot(await loadPortfolio(s.user.id));
      } catch {
        /* ignore */
      }
      setLoaded(true);
    };
    (async () => {
      const s = await getSession();
      setSession(s);
      setAuthReady(true);
      if (s) await hydrate(s);
      else setLoaded(true); // usable without login, just won't sync
    })();
    unsub = onAuthChange(async (s) => {
      setSession(s);
      if (s) await hydrate(s);
      else {
        resetAll();
        setLoaded(true);
      }
    });
    return () => unsub();
  }, [mode, applySnapshot, resetAll]);

  // persist on change (debounced for cloud)
  useEffect(() => {
    if (!loaded) return;
    const snapshot = { _v: SNAPSHOT_VERSION, stockRows, optionRows, realizedRows, dailyRows };
    if (mode === 'local') {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
      } catch {
        /* ignore quota */
      }
      return;
    }
    if (mode === 'cloud' && session) {
      setSync('saving');
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await savePortfolio(session.user.id, snapshot);
          setSync('saved');
        } catch {
          setSync('error');
        }
      }, 800);
    }
  }, [stockRows, optionRows, realizedRows, dailyRows, loaded, mode, session]);

  // inject toast keyframes once
  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-pnl-toast', 'true');
    style.innerHTML = `
      @keyframes pnlToastIn {
        0%   { opacity: 0; transform: translateX(40px); }
        12%  { opacity: 1; transform: translateX(0); }
        88%  { opacity: 1; transform: translateX(0); }
        100% { opacity: 0; transform: translateX(40px); }
      }
      .pnl-toast { animation: pnlToastIn 3s ease forwards; }
      .pnl-app select option { background: ${C.inputBg}; color: ${C.text}; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const pushToast = useCallback((type, message) => {
    const id = newId();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const importText = useCallback(
    (text) => {
      try {
        // Webull Monthly Statement (multi-section) — import PORTFOLIO SUMMARY
        if (isMonthlyStatement(text)) {
          const { stocks, options } = parseMonthlyStatement(text);
          const { instruments: realized, daily } = parseTradeRecords(text);
          const total = stocks.length + options.length + realized.length;
          if (!total) throw new Error('No positions in statement');
          let added = 0;
          let skipped = 0;
          if (stocks.length)
            setStockRows((prev) => {
              const fresh = dedupeAppend(prev, stocks, stockKey);
              added += fresh.length;
              skipped += stocks.length - fresh.length;
              return fresh.length ? [...prev, ...fresh] : prev;
            });
          if (options.length)
            setOptionRows((prev) => {
              const fresh = dedupeAppend(prev, options, optionKey);
              added += fresh.length;
              skipped += options.length - fresh.length;
              return fresh.length ? [...prev, ...fresh] : prev;
            });
          if (realized.length) setRealizedRows((prev) => [...prev, ...realized]);
          if (daily.length) setDailyRows((prev) => mergeDaily(prev, daily));
          setTab(realized.length ? 'realized' : stocks.length >= options.length ? 'stock' : 'option');
          const skipNote = skipped > 0 ? ` (${skipped} ซ้ำ ข้าม)` : '';
          pushToast('success', `✓ Imported ${added + realized.length} positions from Webull${skipNote}`);
          return true;
        }

        const { headers, rows } = parseCSV(text);
        if (!headers.length || !rows.length) throw new Error('Empty CSV');
        const fmt = detectFormat(headers);
        if (fmt === 'option') {
          const parsed = parseOptionCSV(headers, rows);
          if (!parsed.length) throw new Error('No option rows');
          setOptionRows((prev) => {
            const fresh = dedupeAppend(prev, parsed, optionKey);
            const skipped = parsed.length - fresh.length;
            const skipNote = skipped > 0 ? ` (${skipped} ซ้ำ ข้าม)` : '';
            setTimeout(() => pushToast('success', `✓ Imported ${fresh.length} positions from Webull${skipNote}`), 0);
            return fresh.length ? [...prev, ...fresh] : prev;
          });
          setTab('option');
        } else {
          const parsed = parseStockCSV(headers, rows);
          if (!parsed.length) throw new Error('No stock rows');
          setStockRows((prev) => {
            const fresh = dedupeAppend(prev, parsed, stockKey);
            const skipped = parsed.length - fresh.length;
            const skipNote = skipped > 0 ? ` (${skipped} ซ้ำ ข้าม)` : '';
            setTimeout(() => pushToast('success', `✓ Imported ${fresh.length} positions from Webull${skipNote}`), 0);
            return fresh.length ? [...prev, ...fresh] : prev;
          });
          setTab('stock');
        }
        return true;
      } catch (err) {
        pushToast('error', '✗ Could not parse file — check CSV format');
        return false;
      }
    },
    [pushToast]
  );

  const handleFile = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = (e) => importText(String(e.target.result || ''));
      reader.onerror = () => pushToast('error', '✗ Could not parse file — check CSV format');
      reader.readAsText(file);
    },
    [importText, pushToast]
  );

  const handlePasteImport = useCallback(
    (text) => {
      const ok = importText(text);
      if (ok) setPasteOpen(false);
    },
    [importText]
  );

  const handleAuth = useCallback(
    async (email, password, authMode) => {
      const fn = authMode === 'signup' ? signUp : signIn;
      const { data, error } = await fn(email, password);
      if (error) return { error: error.message };
      if (authMode === 'signup' && !data.session) {
        pushToast('success', '✓ สมัครแล้ว — ตรวจอีเมลเพื่อยืนยัน');
      } else {
        pushToast('success', '✓ เข้าสู่ระบบสำเร็จ');
      }
      setAuthModal(false);
      return {};
    },
    [pushToast]
  );

  const handleLogout = useCallback(async () => {
    await signOut();
    pushToast('success', '✓ ออกจากระบบแล้ว');
  }, [pushToast]);

  // combined P&L badge
  let stockNet = 0;
  stockRows.forEach((r) => {
    const c = calcStock(r);
    if (c.hasInputs && c.hasCurrent) stockNet += c.pnl;
  });
  let optionNet = 0;
  optionRows.forEach((r) => {
    const c = calcOption(r);
    if (c.hasInputs && c.hasCurrent) optionNet += c.pnl;
  });
  let realizedNet = 0;
  realizedRows.forEach((r) => {
    realizedNet += r.pnl;
  });
  const unrealized = stockNet + optionNet;
  const combined = unrealized + realizedNet;

  const tabBtn = (key, label) => {
    const active = tab === key;
    return (
      <button
        onClick={() => setTab(key)}
        style={{
          background: active ? C.card : 'transparent',
          color: active ? '#ffffff' : C.muted,
          border: `1px solid ${active ? C.border : 'transparent'}`,
          borderRadius: 8,
          padding: '8px 18px',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: FONT,
          transition: 'all 0.15s ease',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className="pnl-app"
      style={{
        background: C.bg,
        minHeight: '100vh',
        color: C.text,
        fontFamily: FONT,
        padding: '28px 22px 60px',
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* HEADER */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 26,
            flexWrap: 'wrap',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${C.accent}, #7c3aed)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              📈
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>
                P<span style={{ color: C.accent }}>&L</span> Tracker
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: C.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                }}
              >
                Stock &amp; Options Portfolio
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <AuthBar
              mode={mode}
              session={session}
              authReady={authReady}
              sync={sync}
              onLogin={() => setAuthModal(true)}
              onLogout={handleLogout}
            />
            <div
              style={{
                background: C.card,
                border: `1px solid ${combined >= 0 ? C.green : C.red}`,
                borderRadius: 12,
                padding: '10px 18px',
                textAlign: 'right',
              }}
            >
              <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Total P&L
              </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: combined >= 0 ? C.green : C.red }}>
              {combined >= 0 ? '+' : ''}
              {formatUSD(combined)}
            </div>
              {realizedNet !== 0 && (
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                  realized {realizedNet >= 0 ? '+' : ''}
                  {formatUSD(realizedNet)} · open {unrealized >= 0 ? '+' : ''}
                  {formatUSD(unrealized)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TAB BAR */}
        <div
          style={{
            display: 'inline-flex',
            gap: 6,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 6,
            marginBottom: 22,
          }}
        >
          {tabBtn('stock', '📊 Stock P&L')}
          {tabBtn('option', '⚡ Option P&L')}
          {tabBtn('realized', '💰 Realized')}
        </div>

        {/* TAB CONTENT */}
        {tab === 'stock' && (
          <StockTab
            rows={stockRows}
            setRows={setStockRows}
            onFile={handleFile}
            onPasteClick={() => setPasteOpen(true)}
          />
        )}
        {tab === 'option' && (
          <OptionTab
            rows={optionRows}
            setRows={setOptionRows}
            onFile={handleFile}
            onPasteClick={() => setPasteOpen(true)}
          />
        )}
        {tab === 'realized' && (
          <RealizedTab
            rows={realizedRows}
            daily={dailyRows}
            onFile={handleFile}
            onPasteClick={() => setPasteOpen(true)}
            onClear={() => {
              setRealizedRows([]);
              setDailyRows([]);
            }}
          />
        )}

        {/* FOOTER */}
        <div style={{ textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 48 }}>
          * ราคาเป็น USD · Options multiplier = 100 shares · ข้อมูลเพื่อการศึกษาเท่านั้น
        </div>
      </div>

      <PasteModal open={pasteOpen} onClose={() => setPasteOpen(false)} onImport={handlePasteImport} />
      <AuthModal open={authModal} onClose={() => setAuthModal(false)} onSubmit={handleAuth} />
      <Toasts toasts={toasts} />
    </div>
  );
}
