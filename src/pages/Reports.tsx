import { useTransactionStore } from '../utils/store';
import { useMemo, useState } from 'react';
import { calculateTotalPL, calculatePLByTimePeriod, calculatePLBySymbol } from '../utils/calculations';
import PLCalendar from '../components/PLCalendar';

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob(['﻿' + content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function Reports() {
  const transactions = useTransactionStore((state) => state.transactions);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'year' | 'symbol'>('month');

  const handleExportCSV = () => {
    const headers = ['วันที่', 'สัญลักษณ์', 'ประเภท', 'สินทรัพย์', 'จำนวน', 'ราคา', 'รวม', 'ค่าธรรมเนียม', 'หมายเหตุ'];
    const rows = transactions.map((t) => [
      new Date(t.date).toLocaleDateString('en-CA'),
      t.symbol,
      t.type === 'buy' ? 'ซื้อ' : 'ขาย',
      t.assetType === 'stock' ? 'หุ้น' : 'ออปชั่น',
      t.quantity,
      t.price.toFixed(4),
      (t.quantity * t.price).toFixed(2),
      t.commission.toFixed(2),
      `"${t.notes || ''}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadFile(csv, `pl_report_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  };

  const handleExportExcel = () => {
    const headers = ['วันที่', 'สัญลักษณ์', 'ประเภท', 'สินทรัพย์', 'จำนวน', 'ราคา', 'รวม', 'ค่าธรรมเนียม', 'หมายเหตุ'];
    const rows = transactions.map((t) => [
      new Date(t.date).toLocaleDateString('en-CA'),
      t.symbol,
      t.type === 'buy' ? 'ซื้อ' : 'ขาย',
      t.assetType === 'stock' ? 'หุ้น' : 'ออปชั่น',
      t.quantity,
      t.price.toFixed(4),
      (t.quantity * t.price).toFixed(2),
      t.commission.toFixed(2),
      t.notes || '',
    ]);
    const tsv = [headers, ...rows].map((r) => r.join('\t')).join('\n');
    downloadFile(tsv, `pl_report_${new Date().toISOString().split('T')[0]}.xls`, 'application/vnd.ms-excel');
  };

  const handlePrint = () => {
    window.print();
  };

  const report = useMemo(() => {
    const buys = transactions.filter((t) => t.type === 'buy');
    const sells = transactions.filter((t) => t.type === 'sell');
    return calculateTotalPL(buys, sells);
  }, [transactions]);

  const periodData = useMemo(() => {
    if (viewMode === 'symbol') {
      return calculatePLBySymbol(transactions);
    }
    return calculatePLByTimePeriod(transactions, viewMode);
  }, [transactions, viewMode]);

  const sortedPeriods = useMemo(() => {
    return Array.from(periodData.entries())
      .sort((a, b) => {
        if (viewMode === 'symbol') return b[1].netPL - a[1].netPL;
        return b[0].localeCompare(a[0]);
      })
      .map(([, data]) => data);
  }, [periodData, viewMode]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Reports</h1>
        <p className="text-gray-600">ดูสถิติและรายงานประสิทธิภาพการซื้อขาย</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-bold mb-4">Overall Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Gross P&L:</span>
              <span className={`font-bold ${report.totalGrossPL >= 0 ? 'text-profit' : 'text-loss'}`}>
                {report.totalGrossPL >= 0 ? '+' : ''}${report.totalGrossPL.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Net P&L:</span>
              <span className={`font-bold ${report.totalNetPL >= 0 ? 'text-profit' : 'text-loss'}`}>
                {report.totalNetPL >= 0 ? '+' : ''}${report.totalNetPL.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">ROI:</span>
              <span className={`font-bold ${report.returnOnInvestment >= 0 ? 'text-profit' : 'text-loss'}`}>
                {report.returnOnInvestment >= 0 ? '+' : ''}
                {report.returnOnInvestment.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-4">Trade Statistics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Trades:</span>
              <span className="font-bold">{report.winCount + report.lossCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Winning Trades:</span>
              <span className="font-bold text-profit">{report.winCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Losing Trades:</span>
              <span className="font-bold text-loss">{report.lossCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Win Rate:</span>
              <span className={`font-bold ${report.winRate >= 50 ? 'text-profit' : 'text-loss'}`}>
                {report.winRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-4">Trade Analysis</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Largest Win:</span>
              <span className="font-bold text-profit">+${report.largestWin.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Largest Loss:</span>
              <span className="font-bold text-loss">${report.largestLoss.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg. Win/Loss Ratio:</span>
              <span className="font-bold">
                {report.winCount + report.lossCount > 0
                  ? report.largestWin > 0
                    ? (-report.largestLoss / report.largestWin).toFixed(2)
                    : 'N/A'
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-4">Data Export</h3>
          <div className="space-y-2">
            <button
              onClick={handleExportCSV}
              disabled={transactions.length === 0}
              className="btn-primary w-full disabled:opacity-50"
            >
              📥 Export to CSV
            </button>
            <button
              onClick={handleExportExcel}
              disabled={transactions.length === 0}
              className="btn-secondary w-full disabled:opacity-50"
            >
              📥 Export to Excel
            </button>
            <button onClick={handlePrint} className="btn-secondary w-full">
              🖨️ Print Report
            </button>
          </div>
        </div>
      </div>

      {/* P&L Calendar */}
      <PLCalendar transactions={transactions} />

      {/* Time Period Summary */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4">📊 สรุป P&L ตามช่วงเวลา</h2>
        
        {/* View Mode Selector */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setViewMode('day')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              viewMode === 'day'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📅 รายวัน
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              viewMode === 'week'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📆 รายสัปดาห์
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              viewMode === 'month'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📋 รายเดือน
          </button>
          <button
            onClick={() => setViewMode('year')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              viewMode === 'year'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📈 รายปี
          </button>
          <button
            onClick={() => setViewMode('symbol')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              viewMode === 'symbol'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            🏷️ ตามสัญลักษณ์
          </button>
        </div>

        {/* Data Display */}
        {sortedPeriods.length === 0 ? (
          <p className="text-gray-500 text-center py-8">ยังไม่มีข้อมูลการซื้อขาย</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">
                    {viewMode === 'symbol' ? '🏷️ สัญลักษณ์' : '📅 ช่วงเวลา'}
                  </th>
                  <th className="px-4 py-3 text-right font-bold">Gross P&L</th>
                  <th className="px-4 py-3 text-right font-bold">Net P&L</th>
                  <th className="px-4 py-3 text-right font-bold">การซื้อขาย</th>
                  <th className="px-4 py-3 text-right font-bold">📈 กำไร</th>
                  <th className="px-4 py-3 text-right font-bold">📉 ขาดทุน</th>
                </tr>
              </thead>
              <tbody>
                {sortedPeriods.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-blue-50 border-b`}
                  >
                    <td className="px-4 py-3 font-medium">{row.period}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      row.grossPL >= 0 ? 'text-profit' : 'text-loss'
                    }`}>
                      {row.grossPL >= 0 ? '+' : ''}${row.grossPL.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      row.netPL >= 0 ? 'text-profit' : 'text-loss'
                    }`}>
                      {row.netPL >= 0 ? '+' : ''}${row.netPL.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {row.transactions}
                    </td>
                    <td className="px-4 py-3 text-right text-profit font-semibold">
                      {row.profitTrades}
                    </td>
                    <td className="px-4 py-3 text-right text-loss font-semibold">
                      {row.lossTrades}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
