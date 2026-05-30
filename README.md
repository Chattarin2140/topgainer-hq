# Stock & Options P&L Tracker

เว็บไซต์สำหรับจดบันทึกกำไร/ขาดทุนจากการซื้อขายหุ้นและออปชั่น

## 🚀 ฟีเจอร์หลัก

### 1. **Transaction Management**
- ✅ บันทึกรายการซื้อ (Buy) และขาย (Sell)
- ✅ จัดการหุ้น (Stocks) และออปชั่น (Options)
- ✅ ลบ/แก้ไขรายการ
- ✅ ตั้งค่าค่าธรรมเนียม

### 2. **P&L Calculations**
- ✅ คำนวณ Gross P&L และ Net P&L
- ✅ คำนวณต้นทุนเฉลี่ย (Average Cost)
- ✅ คำนวณ ROI (Return on Investment)
- ✅ คำนวณ P&L ตามสัญลักษณ์

### 3. **Portfolio Management**
- ✅ ดูรายการ Position ที่เปิดอยู่
- ✅ คำนวณมูลค่ารวมของพอร์ตโฟลิโอ
- ✅ ตรวจสอบความเสี่ยง
- ✅ ประเมินประสิทธิภาพ

### 4. **Reports & Analytics**
- ✅ Win Rate Analysis
- ✅ Trade Statistics
- ✅ Largest Win/Loss
- ✅ Performance Trends
- ✅ Export to CSV/Excel

### 5. **Dashboard**
- ✅ สรุปสถิติแบบ Real-time
- ✅ ดูกำไรขาดทุนรวม
- ✅ แสดง Win Rate
- ✅ ดูทั้งหมด Position ที่เปิดอยู่

## 📋 Required Functions

ดูรายละเอียดทั้งหมดใน [FUNCTIONS_REQUIRED.md](./FUNCTIONS_REQUIRED.md)

### Core Features:
1. **User Management** - สมัครสมาชิก เข้าสู่ระบบ
2. **Transaction Management** - เพิ่ม/แก้ไข/ลบรายการ
3. **P&L Calculation** - คำนวณกำไร/ขาดทุน
4. **Portfolio Management** - จัดการพอร์ตโฟลิโอ
5. **Search & Filter** - ค้นหาและกรองข้อมูล
6. **Reports & Analytics** - สร้างรายงาน
7. **Data Export** - ส่งออกข้อมูล
8. **Dashboard & Visualization** - แสดงกราฟและสถิติ

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Charts**: Recharts
- **Router**: React Router v6
- **Build Tool**: Vite

## 📦 Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
src/
├── components/          # Reusable components
│   ├── Navbar.tsx
│   ├── DashboardStats.tsx
│   ├── PositionsList.tsx
│   ├── TransactionForm.tsx
│   └── TransactionsList.tsx
├── pages/              # Page components
│   ├── Dashboard.tsx
│   ├── Transactions.tsx
│   ├── Portfolio.tsx
│   ├── Reports.tsx
│   └── Settings.tsx
├── utils/              # Utility functions
│   ├── calculations.ts  # P&L calculation functions
│   └── store.ts        # Zustand store
├── types.ts            # TypeScript interfaces
├── App.tsx             # Main app component
└── main.tsx            # Entry point
```

## 🎯 Usage

### 1. Add Transaction
- ไปที่ "Transactions" page
- กรอกข้อมูล: Symbol, Type (Buy/Sell), Quantity, Price
- คลิก "บันทึก"

### 2. View Portfolio
- ไปที่ "Portfolio" page
- ดู Position ที่เปิดอยู่
- ดู Gross P&L และ Net P&L

### 3. Check Reports
- ไปที่ "Reports" page
- ดู Win Rate, Trade Statistics
- ส่งออกข้อมูลเป็น CSV/Excel

### 4. Settings
- ไปที่ "Settings"
- ตั้งค่าสกุลเงิน
- ตั้งค่าอัตราค่าธรรมเนียม

## 💾 Data Storage

ข้อมูลทั้งหมดถูกเก็บใน **LocalStorage** ของเบราว์เซอร์
- ข้อมูลจะถูกเก็บไว้ในอุปกรณ์ของคุณ
- ไม่จำเป็นต้องพึ่งพาเซิร์ฟเวอร์

## 🔐 Future Features

- [ ] User Authentication (Firebase)
- [ ] Multi-currency support
- [ ] Real-time stock prices integration
- [ ] Options Greeks calculation
- [ ] Email notifications
- [ ] Mobile app
- [ ] Advanced charting
- [ ] Backtesting capabilities

## 📝 License

MIT License

## 👨‍💻 Author

Created for stock & options traders
