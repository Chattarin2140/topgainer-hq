import { useEffect, useState } from 'react';
import TransactionForm from '../components/TransactionForm';
import TransactionsList from '../components/TransactionsList';
import WebullImport from '../components/WebullImport';
import { useTransactionStore } from '../utils/store';

export default function Transactions() {
  const fetchTransactions = useTransactionStore((state) => state.fetchTransactions);
  const loading = useTransactionStore((state) => state.loading);
  const error = useTransactionStore((state) => state.error);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">รายการทั้งหมด</h1>
          <p className="text-gray-600">บันทึกและจัดการรายการซื้อขาย</p>
        </div>
        <button
          onClick={() => setShowImport((v) => !v)}
          className={`btn flex items-center gap-2 ${showImport ? 'btn-secondary' : 'btn-primary'}`}
        >
          {showImport ? '✕ ปิด Import' : '📥 Import จาก Webull'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          ⚠️ {error}
        </div>
      )}

      {showImport && (
        <WebullImport
          onSuccess={() => {
            fetchTransactions();
            setShowImport(false);
          }}
        />
      )}

      <TransactionForm onSuccess={() => fetchTransactions()} />

      {loading ? (
        <div className="card text-center py-8">
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      ) : (
        <TransactionsList />
      )}
    </div>
  );
}
