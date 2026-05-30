import { useMemo, useState } from 'react';
import { useTransactionStore } from '../utils/store';

type SortField = 'date' | 'symbol' | 'type' | 'quantity' | 'price' | 'total' | 'commission';
type SortDir = 'asc' | 'desc';
type FilterType = 'all' | 'buy' | 'sell';

export default function TransactionsList() {
  const transactions = useTransactionStore((state) => state.transactions);
  const deleteTransaction = useTransactionStore((state) => state.deleteTransaction);
  const loading = useTransactionStore((state) => state.loading);

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const handleDelete = (id: string | undefined) => {
    if (!id) return;
    if (window.confirm('ยืนยันการลบ?')) {
      deleteTransaction(id);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1 text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const displayed = useMemo(() => {
    return [...transactions]
      .filter((t) => filterType === 'all' || t.type === filterType)
      .sort((a, b) => {
        let aVal: number | string;
        let bVal: number | string;
        switch (sortField) {
          case 'date':
            aVal = new Date(a.date).getTime();
            bVal = new Date(b.date).getTime();
            break;
          case 'symbol':
            aVal = a.symbol;
            bVal = b.symbol;
            break;
          case 'type':
            aVal = a.type;
            bVal = b.type;
            break;
          case 'quantity':
            aVal = a.quantity;
            bVal = b.quantity;
            break;
          case 'price':
            aVal = a.price;
            bVal = b.price;
            break;
          case 'total':
            aVal = a.quantity * a.price;
            bVal = b.quantity * b.price;
            break;
          case 'commission':
            aVal = a.commission;
            bVal = b.commission;
            break;
          default:
            return 0;
        }
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [transactions, sortField, sortDir, filterType]);

  const buyCount = transactions.filter((t) => t.type === 'buy').length;
  const sellCount = transactions.filter((t) => t.type === 'sell').length;

  const thClass = 'px-4 py-3 font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors';

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-bold">รายการทั้งหมด</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filterType === 'all'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ทั้งหมด ({transactions.length})
          </button>
          <button
            onClick={() => setFilterType('buy')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filterType === 'buy'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ซื้อ ({buyCount})
          </button>
          <button
            onClick={() => setFilterType('sell')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filterType === 'sell'
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ขาย ({sellCount})
          </button>
        </div>
      </div>

      {displayed.length === 0 ? (
        <p className="text-gray-500 text-center py-8">ยังไม่มีรายการ</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <tr>
                  <th className={thClass} onClick={() => handleSort('symbol')}>
                    สัญลักษณ์<SortIcon field="symbol" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('type')}>
                    ประเภท<SortIcon field="type" />
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-500">สินทรัพย์</th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('quantity')}>
                    จำนวน<SortIcon field="quantity" />
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('price')}>
                    ราคา<SortIcon field="price" />
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('total')}>
                    รวม<SortIcon field="total" />
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('commission')}>
                    ค่าธรรมเนียม<SortIcon field="commission" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('date')}>
                    วันที่<SortIcon field="date" />
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-500">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((transaction) => (
                  <tr
                    key={transaction._id || transaction.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-bold text-gray-900">{transaction.symbol}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-white text-xs font-semibold ${
                          transaction.type === 'buy' ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      >
                        {transaction.type === 'buy' ? 'ซื้อ' : 'ขาย'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        {transaction.assetType === 'option' ? 'Option' : 'Stock'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{transaction.quantity}</td>
                    <td className="px-4 py-3 text-right">${transaction.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      ${(transaction.quantity * transaction.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      ${transaction.commission.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(transaction.date).toLocaleDateString('th-TH')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(transaction._id || transaction.id)}
                        className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-medium transition"
                        disabled={loading}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 text-right mt-3">
            แสดง {displayed.length} จาก {transactions.length} รายการ
          </p>
        </>
      )}
    </div>
  );
}
