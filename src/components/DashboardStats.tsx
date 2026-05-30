import { useMemo } from 'react';
import { useTransactionStore } from '../utils/store';
import { calculateTotalPL } from '../utils/calculations';

export default function DashboardStats() {
  const transactions = useTransactionStore((state) => state.transactions);

  const stats = useMemo(() => {
    const buys = transactions.filter((t) => t.type === 'buy');
    const sells = transactions.filter((t) => t.type === 'sell');
    return calculateTotalPL(buys, sells);
  }, [transactions]);

  const buyCount = transactions.filter((t) => t.type === 'buy').length;
  const sellCount = transactions.filter((t) => t.type === 'sell').length;

  const statCards = [
    {
      label: 'Net P&L',
      value: (stats.totalNetPL >= 0 ? '+' : '') + '$' + stats.totalNetPL.toFixed(2),
      subtitle: 'กำไร/ขาดทุนสุทธิ',
      isPositive: stats.totalNetPL >= 0,
      icon: '💰',
      borderClass: stats.totalNetPL >= 0 ? 'border-t-emerald-500' : 'border-t-red-500',
      iconBgClass: stats.totalNetPL >= 0 ? 'bg-emerald-50' : 'bg-red-50',
      valueClass: stats.totalNetPL >= 0 ? 'text-profit' : 'text-loss',
    },
    {
      label: 'รายการซื้อขาย',
      value: transactions.length.toString(),
      subtitle: `ซื้อ ${buyCount} / ขาย ${sellCount}`,
      isPositive: true,
      icon: '📋',
      borderClass: 'border-t-blue-500',
      iconBgClass: 'bg-blue-50',
      valueClass: 'text-blue-600',
    },
    {
      label: 'Win Rate',
      value: `${stats.winRate.toFixed(1)}%`,
      subtitle: `ชนะ ${stats.winCount} / แพ้ ${stats.lossCount}`,
      isPositive: stats.winRate >= 50,
      icon: '🎯',
      borderClass: stats.winRate >= 50 ? 'border-t-emerald-500' : 'border-t-red-500',
      iconBgClass: stats.winRate >= 50 ? 'bg-emerald-50' : 'bg-red-50',
      valueClass: stats.winRate >= 50 ? 'text-profit' : 'text-loss',
    },
    {
      label: 'ROI',
      value: (stats.returnOnInvestment >= 0 ? '+' : '') + stats.returnOnInvestment.toFixed(2) + '%',
      subtitle: 'ผลตอบแทนการลงทุน',
      isPositive: stats.returnOnInvestment >= 0,
      icon: '📈',
      borderClass: stats.returnOnInvestment >= 0 ? 'border-t-emerald-500' : 'border-t-red-500',
      iconBgClass: stats.returnOnInvestment >= 0 ? 'bg-emerald-50' : 'bg-red-50',
      valueClass: stats.returnOnInvestment >= 0 ? 'text-profit' : 'text-loss',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((card, idx) => (
        <div key={idx} className={`card border-t-4 ${card.borderClass}`}>
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                {card.label}
              </p>
              <p className={`text-2xl font-bold mt-1 truncate ${card.valueClass}`}>
                {card.value}
              </p>
              <p className="text-gray-400 text-xs mt-1">{card.subtitle}</p>
            </div>
            <div className={`w-11 h-11 ${card.iconBgClass} rounded-xl flex items-center justify-center flex-shrink-0 ml-3`}>
              <span className="text-xl">{card.icon}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
