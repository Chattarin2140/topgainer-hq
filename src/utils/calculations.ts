import { Transaction, Position, PLReport } from '../types';

/**
 * Get price multiplier based on asset type
 * Options: 100 (each contract = 100 shares)
 * Stock: 1
 */
const getPriceMultiplier = (assetType?: string): number => {
  return assetType === 'option' ? 100 : 1;
};

/**
 * คำนวณกำไร/ขาดทุนสำหรับรายการเดียว
 */
export const calculatePLForTransaction = (
  buyTransactions: Transaction[],
  sellTransactions: Transaction[],
  symbol: string
): { pl: number; netPL: number; avgCost: number } => {
  const buys = buyTransactions.filter(t => t.symbol === symbol);
  const sells = sellTransactions.filter(t => t.symbol === symbol);

  // Get multiplier from first transaction (all should be same asset type)
  const multiplier = getPriceMultiplier(buys[0]?.assetType || sells[0]?.assetType);

  let totalBuyQuantity = 0;
  let totalBuyCost = 0;
  let totalCommission = 0;

  // คำนวณต้นทุนเฉลี่ยและต้นทุนรวม
  buys.forEach(buy => {
    totalBuyQuantity += buy.quantity;
    totalBuyCost += buy.quantity * buy.price * multiplier;
    totalCommission += buy.commission;
  });

  const avgCost = totalBuyQuantity > 0 ? totalBuyCost / totalBuyQuantity : 0;

  let totalSellRevenue = 0;
  let totalSellCommission = 0;

  // คำนวณรายได้จากการขายและค่าธรรมเนียม
  sells.forEach(sell => {
    totalSellRevenue += sell.quantity * sell.price * multiplier;
    totalSellCommission += sell.commission;
  });

  const pl = totalSellRevenue - totalBuyCost;
  const netPL = pl - (totalCommission + totalSellCommission);

  return { pl, netPL, avgCost };
};

/**
 * คำนวณ P&L รวมทั้งหมด
 */
export const calculateTotalPL = (
  buyTransactions: Transaction[],
  sellTransactions: Transaction[]
): PLReport => {
  const symbols = new Set([
    ...buyTransactions.map(t => t.symbol),
    ...sellTransactions.map(t => t.symbol),
  ]);

  let totalGrossPL = 0;
  let totalNetPL = 0;
  let winCount = 0;
  let lossCount = 0;
  let largestWin = 0;
  let largestLoss = 0;
  let totalCapitalInvested = 0;

  symbols.forEach(symbol => {
    const { pl, netPL } = calculatePLForTransaction(
      buyTransactions,
      sellTransactions,
      symbol
    );

    totalGrossPL += pl;
    totalNetPL += netPL;

    if (netPL > 0) {
      winCount++;
      largestWin = Math.max(largestWin, netPL);
    } else if (netPL < 0) {
      lossCount++;
      largestLoss = Math.min(largestLoss, netPL);
    }
  });

  // คำนวณทุนลงทุนทั้งหมด
  buyTransactions.forEach(buy => {
    const multiplier = getPriceMultiplier(buy.assetType);
    totalCapitalInvested += buy.quantity * buy.price * multiplier;
  });

  const winRate = (winCount + lossCount) > 0 ? (winCount / (winCount + lossCount)) * 100 : 0;
  const returnOnInvestment = totalCapitalInvested > 0 ? (totalNetPL / totalCapitalInvested) * 100 : 0;

  return {
    totalPL: totalNetPL,
    totalGrossPL,
    totalNetPL,
    winRate,
    winCount,
    lossCount,
    largestWin,
    largestLoss,
    returnOnInvestment,
  };
};

/**
 * P&L Summary สำหรับช่วงเวลา
 */
export interface TimePeriodPL {
  period: string;
  grossPL: number;
  netPL: number;
  transactions: number;
  profitTrades: number;
  lossTrades: number;
}

/**
 * ดึงเดือนและปีจาก Transaction date
 */
const getPeriodKey = (date: string | Date, format: 'day' | 'week' | 'month' | 'year') => {
  const d = new Date(date);
  
  if (format === 'day') {
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  } else if (format === 'week') {
    const week = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  } else if (format === 'month') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } else {
    return `${d.getFullYear()}`;
  }
};

/**
 * คำนวณ P&L ตามช่วงเวลา (day, week, month, year)
 */
export const calculatePLByTimePeriod = (
  transactions: Transaction[],
  format: 'day' | 'week' | 'month' | 'year'
): Map<string, TimePeriodPL> => {
  const groupedByPeriod = new Map<string, Transaction[]>();

  // จัดกลุ่มรายการตามช่วงเวลา
  transactions.forEach(tx => {
    const key = getPeriodKey(tx.date, format);
    if (!groupedByPeriod.has(key)) {
      groupedByPeriod.set(key, []);
    }
    groupedByPeriod.get(key)!.push(tx);
  });

  // คำนวณ P&L สำหรับแต่ละช่วงเวลา
  const results = new Map<string, TimePeriodPL>();

  groupedByPeriod.forEach((txs, period) => {
    const buys = txs.filter(t => t.type === 'buy');
    const sells = txs.filter(t => t.type === 'sell');

    let totalBuyCost = 0;
    let totalBuyCommission = 0;
    let totalSellRevenue = 0;
    let totalSellCommission = 0;

    buys.forEach(buy => {
      const multiplier = getPriceMultiplier(buy.assetType);
      totalBuyCost += buy.quantity * buy.price * multiplier;
      totalBuyCommission += buy.commission;
    });

    sells.forEach(sell => {
      const multiplier = getPriceMultiplier(sell.assetType);
      totalSellRevenue += sell.quantity * sell.price * multiplier;
      totalSellCommission += sell.commission;
    });

    const grossPL = totalSellRevenue - totalBuyCost;
    const netPL = grossPL - (totalBuyCommission + totalSellCommission);

    results.set(period, {
      period,
      grossPL,
      netPL,
      transactions: txs.length,
      profitTrades: sells.length > 0 && grossPL > 0 ? sells.length : 0,
      lossTrades: sells.length > 0 && grossPL < 0 ? sells.length : 0,
    });
  });

  return results;
};

/**
 * คำนวณ P&L รวมตามสัญลักษณ์
 */
export const calculatePLBySymbol = (
  transactions: Transaction[]
): Map<string, TimePeriodPL> => {
  const groupedBySymbol = new Map<string, Transaction[]>();

  transactions.forEach(tx => {
    if (!groupedBySymbol.has(tx.symbol)) {
      groupedBySymbol.set(tx.symbol, []);
    }
    groupedBySymbol.get(tx.symbol)!.push(tx);
  });

  const results = new Map<string, TimePeriodPL>();

  groupedBySymbol.forEach((txs, symbol) => {
    const buys = txs.filter(t => t.type === 'buy');
    const sells = txs.filter(t => t.type === 'sell');

    let totalBuyCost = 0;
    let totalBuyCommission = 0;
    let totalSellRevenue = 0;
    let totalSellCommission = 0;

    buys.forEach(buy => {
      const multiplier = getPriceMultiplier(buy.assetType);
      totalBuyCost += buy.quantity * buy.price * multiplier;
      totalBuyCommission += buy.commission;
    });

    sells.forEach(sell => {
      const multiplier = getPriceMultiplier(sell.assetType);
      totalSellRevenue += sell.quantity * sell.price * multiplier;
      totalSellCommission += sell.commission;
    });

    const grossPL = totalSellRevenue - totalBuyCost;
    const netPL = grossPL - (totalBuyCommission + totalSellCommission);

    results.set(symbol, {
      period: symbol,
      grossPL,
      netPL,
      transactions: txs.length,
      profitTrades: grossPL > 0 ? 1 : 0,
      lossTrades: grossPL < 0 ? 1 : 0,
    });
  });

  return results;
};

/**
 * คำนวณ Position ปัจจุบัน
 */
export const calculatePosition = (
  symbol: string,
  buyTransactions: Transaction[],
  sellTransactions: Transaction[],
  currentPrice: number
): Position | null => {
  const buys = buyTransactions.filter(t => t.symbol === symbol);
  const sells = sellTransactions.filter(t => t.symbol === symbol);

  // Get multiplier from first transaction
  const multiplier = getPriceMultiplier(buys[0]?.assetType || sells[0]?.assetType);

  let totalBuyQuantity = 0;
  let totalBuyCost = 0;
  let totalBuyCommission = 0;

  buys.forEach(buy => {
    totalBuyQuantity += buy.quantity;
    totalBuyCost += buy.quantity * buy.price * multiplier;
    totalBuyCommission += buy.commission;
  });

  let totalSellQuantity = 0;
  let totalSellCommission = 0;

  sells.forEach(sell => {
    totalSellQuantity += sell.quantity;
    totalSellCommission += sell.commission;
  });

  const quantity = totalBuyQuantity - totalSellQuantity;
  if (quantity === 0) return null;

  const averageCost = totalBuyQuantity > 0 ? totalBuyCost / totalBuyQuantity : 0;
  const totalCost = quantity * averageCost;
  const currentValue = quantity * currentPrice * multiplier;
  const grossPL = currentValue - totalCost;
  const netPL = grossPL - (totalBuyCommission + totalSellCommission);
  const plPercentage = totalCost > 0 ? (netPL / totalCost) * 100 : 0;

  return {
    symbol,
    assetType: buys[0]?.assetType || 'stock',
    quantity,
    averageCost,
    currentPrice,
    totalCost,
    currentValue,
    grossPL,
    netPL,
    plPercentage,
  };
};

/**
 * คำนวณต้นทุนเฉลี่ย
 */
export const calculateAverageCost = (
  buyTransactions: Transaction[],
  symbol: string
): number => {
  const buys = buyTransactions.filter(t => t.symbol === symbol);
  
  // Get multiplier from first transaction
  const multiplier = getPriceMultiplier(buys[0]?.assetType);

  let totalQuantity = 0;
  let totalCost = 0;

  buys.forEach(buy => {
    totalQuantity += buy.quantity;
    totalCost += buy.quantity * buy.price * multiplier;
  });

  return totalQuantity > 0 ? totalCost / totalQuantity : 0;
};

/**
 * คำนวณ ROI
 */
export const calculateROI = (
  netPL: number,
  capitalInvested: number
): number => {
  return capitalInvested > 0 ? (netPL / capitalInvested) * 100 : 0;
};

/**
 * กรองตามช่วงเวลา
 */
export const filterByDateRange = (
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): Transaction[] => {
  return transactions.filter(t => {
    const date = new Date(t.date);
    return date >= startDate && date <= endDate;
  });
};

/**
 * คำนวณ Win Rate
 */
export const calculateWinRate = (
  closedTrades: Array<{ pl: number }>
): number => {
  if (closedTrades.length === 0) return 0;
  const wins = closedTrades.filter(t => t.pl > 0).length;
  return (wins / closedTrades.length) * 100;
};
