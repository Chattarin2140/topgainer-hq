import { useMemo, useState } from 'react';
import { Transaction } from '../types';

/**
 * Get price multiplier based on asset type
 * Options: 100 (each contract = 100 shares)
 * Stock: 1
 */
const getPriceMultiplier = (assetType?: string): number => {
  return assetType === 'option' ? 100 : 1;
};

interface DayPL {
  date: number;
  dayOfWeek: number;
  pl: number;
  count: number;
}

interface CalendarData {
  month: number;
  year: number;
  days: DayPL[];
  totalMonthPL: number;
}

export default function PLCalendar({ transactions }: { transactions: Transaction[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const calendarData = useMemo(() => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();

    // Group by day
    const dayMap = new Map<string, Transaction[]>();
    transactions.forEach(tx => {
      const d = new Date(tx.date);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const key = d.toISOString().split('T')[0];
        if (!dayMap.has(key)) {
          dayMap.set(key, []);
        }
        dayMap.get(key)!.push(tx);
      }
    });

    // Calculate P&L per day
    const days: DayPL[] = [];
    let totalMonthPL = 0;

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    // Add days from previous month
    const prevMonth = new Date(year, month, 0);
    const daysInPrevMonth = prevMonth.getDate();
    for (let i = daysInPrevMonth - firstDayOfWeek + 1; i <= daysInPrevMonth; i++) {
      days.push({
        date: i,
        dayOfWeek: (daysInPrevMonth - firstDayOfWeek + i) % 7,
        pl: 0,
        count: 0,
      });
    }

    // Add current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayTransactions = dayMap.get(dateStr) || [];

      let dayPL = 0;
      dayTransactions.forEach(tx => {
        const buys = dayTransactions.filter(t => t.type === 'buy' && t.symbol === tx.symbol);
        const sells = dayTransactions.filter(t => t.type === 'sell' && t.symbol === tx.symbol);

        if (tx.type === 'sell') {
          const multiplier = getPriceMultiplier(tx.assetType);
          const avgBuyCost = buys.length > 0
            ? buys.reduce((sum, b) => sum + (b.quantity * b.price * multiplier), 0) / buys.reduce((sum, b) => sum + b.quantity, 0)
            : 0;
          const sellValue = tx.quantity * tx.price * multiplier;
          const buyCost = tx.quantity * avgBuyCost;
          const commission = (buys[0]?.commission || 0) + tx.commission;
          dayPL += (sellValue - buyCost - commission);
        }
      });

      totalMonthPL += dayPL;
      days.push({
        date: day,
        dayOfWeek: (firstDayOfWeek + day - 1) % 7,
        pl: dayPL,
        count: dayTransactions.length,
      });
    }

    // Add remaining days from next month
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: i,
        dayOfWeek: (firstDayOfWeek + daysInMonth + i - 1) % 7,
        pl: 0,
        count: 0,
      });
    }

    return { month, year, days, totalMonthPL };
  }, [transactions, currentDate]);

  const monthName = new Date(calendarData.year, calendarData.month).toLocaleString('th-TH', {
    month: 'long',
    year: 'numeric',
  });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(calendarData.year, calendarData.month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(calendarData.year, calendarData.month + 1, 1));
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">📅 P&L Calendar</h2>
          <p className="text-gray-600 text-sm mt-1">ดูกำไร/ขาดทุนรายวัน</p>
        </div>
        <div className={`text-2xl font-bold ${calendarData.totalMonthPL >= 0 ? 'text-profit' : 'text-loss'}`}>
          {calendarData.totalMonthPL >= 0 ? '+' : ''}${calendarData.totalMonthPL.toFixed(2)}
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <button
          onClick={handlePrevMonth}
          className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 font-medium"
        >
          ← ก่อนหน้า
        </button>
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">{monthName}</span>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-sm rounded bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium"
          >
            วันนี้
          </button>
        </div>
        <button
          onClick={handleNextMonth}
          className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 font-medium"
        >
          ถัดไป →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day names */}
        {dayNames.map(day => (
          <div key={day} className="text-center text-sm font-bold text-gray-600 py-2">
            {day}
          </div>
        ))}

        {/* Day cells */}
        {calendarData.days.map((day, idx) => {
          const isCurrentMonth =
            (idx < 7 && day.date > 20) || // Previous month days at top
            (idx >= 35 && day.date < 8) || // Next month days at bottom
            (day.date >= 1 && day.date <= 31);

          const isThisMonth = isCurrentMonth && day.date <= 31;

          let bgColor = 'bg-white';
          let textColor = 'text-gray-900';

          if (isThisMonth && day.pl !== 0) {
            if (day.pl > 0) {
              bgColor = 'bg-green-50 border-2 border-green-300';
              textColor = 'text-profit';
            } else {
              bgColor = 'bg-red-50 border-2 border-red-300';
              textColor = 'text-loss';
            }
          }

          if (!isThisMonth) {
            bgColor = 'bg-gray-50';
            textColor = 'text-gray-400';
          }

          return (
            <div
              key={idx}
              className={`${bgColor} ${textColor} rounded-lg p-2 min-h-20 flex flex-col justify-between text-xs border border-gray-200`}
            >
              <div className="font-bold text-sm">{day.date}</div>
              {isThisMonth && day.count > 0 && (
                <>
                  <div className={`font-bold text-sm ${day.pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {day.pl >= 0 ? '+' : ''}{day.pl.toFixed(2)}
                  </div>
                  <div className="text-gray-500 text-xs">({day.count} trade{day.count > 1 ? 's' : ''})</div>
                </>
              )}
              {isThisMonth && day.count === 0 && (
                <div className="text-gray-400 text-xs">--</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
          <span className="text-profit font-medium">กำไร (Profit)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded"></div>
          <span className="text-loss font-medium">ขาดทุน (Loss)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border-2 border-gray-200 rounded"></div>
          <span className="text-gray-600 font-medium">ไม่มีการซื้อขาย</span>
        </div>
      </div>
    </div>
  );
}
