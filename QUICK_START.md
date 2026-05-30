# Quick Start Guide

## 🚀 เริ่มต้นใช้งานอย่างรวดเร็ว

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Run Development Server
```bash
npm run dev
```
จะเปิด http://localhost:5173

### Step 3: Explore the App
1. **Dashboard** - ดูสถิติรวม
2. **Transactions** - บันทึกรายการซื้อขาย
3. **Portfolio** - ดู Position ที่เปิดอยู่
4. **Reports** - วิเคราะห์ประสิทธิภาพ
5. **Settings** - ปรับปรุงตั้งค่า

## 📚 Core Functions Reference

### Initialize Transaction
```typescript
const addTransaction = useTransactionStore((state) => state.addTransaction);

addTransaction({
  id: '1',
  symbol: 'AAPL',
  type: 'buy',
  assetType: 'stock',
  quantity: 10,
  price: 150,
  date: '2024-01-01',
  commission: 5,
});
```

### Calculate P&L
```typescript
import { calculateTotalPL } from './utils/calculations';

const buys = transactions.filter(t => t.type === 'buy');
const sells = transactions.filter(t => t.type === 'sell');
const plReport = calculateTotalPL(buys, sells);
```

### Get Current Position
```typescript
import { calculatePosition } from './utils/calculations';

const position = calculatePosition(
  'AAPL',
  buyTransactions,
  sellTransactions,
  currentPrice
);
```

## 🎯 Key Features

| Feature | Description |
|---------|-------------|
| **📝 Transaction Log** | บันทึกรายการซื้อขายทั้งหมด |
| **💰 P&L Calculator** | คำนวณกำไร/ขาดทุนโดยอัตโนมัติ |
| **📊 Dashboard** | แสดงสถิติและ Position รวม |
| **📈 Reports** | วิเคราะห์ Win Rate และประสิทธิภาพ |
| **💾 Local Storage** | เก็บข้อมูลในเบราว์เซอร์ |

## 🔧 Configuration

### ตั้งค่าค่าธรรมเนียม
```typescript
const addTransaction = useTransactionStore((state) => state.addTransaction);

addTransaction({
  // ...
  commission: 5,  // $5 commission
});
```

### ตั้งค่าสกุลเงิน
ไปที่ Settings page และเลือกสกุลเงี๊ยนที่ต้องการ

## 📊 Calculation Examples

### Win Rate
```
Win Rate = (Winning Trades / Total Closed Trades) × 100
```

### ROI
```
ROI = (Net P&L / Capital Invested) × 100
```

### Average Cost
```
Average Cost = Total Cost / Total Quantity
```

## ❓ FAQ

**Q: ข้อมูลของฉันจะเก็บไว้ที่ไหน?**
A: LocalStorage ของเบราว์เซอร์ของคุณ

**Q: ฉันสามารถส่งออกข้อมูลได้หรือไม่?**
A: ใช่ ไปที่ Reports > Export to CSV/Excel

**Q: ฉันสามารถลบทุกอย่างได้หรือไม่?**
A: ใช่ ไปที่ Settings > Danger Zone

## 🐛 Troubleshooting

- Clear browser cache if data doesn't show correctly
- Check console (F12) for any errors
- Ensure JavaScript is enabled in your browser

## 📞 Support

For issues or feature requests, please check the documentation in FUNCTIONS_REQUIRED.md
