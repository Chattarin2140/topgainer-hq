# Stock & Options P&L Tracker - Required Functions

## Core Features & Functions

### 1. **User Management**
- `registerUser()` - สมัครสมาชิกใหม่
- `loginUser()` - เข้าสู่ระบบ
- `logoutUser()` - ออกจากระบบ
- `updateUserProfile()` - อัพเดทข้อมูลผู้ใช้

### 2. **Transaction Management**
- `addBuyTransaction()` - บันทึกการซื้อ/เปิด position
- `addSellTransaction()` - บันทึกการขาย/ปิด position
- `editTransaction()` - แก้ไขรายการ
- `deleteTransaction()` - ลบรายการ
- `getAllTransactions()` - ดึงรายการทั้งหมด
- `getTransactionsBySymbol()` - ค้นหาทรานแซคชัน ตามสัญลักษณ์

### 3. **P&L Calculation**
- `calculatePL()` - คำนวณกำไร/ขาดทุน สำหรับแต่ละรายการ
- `calculateTotalPL()` - คำนวณ P&L รวมทั้งหมด
- `calculatePLBySymbol()` - คำนวณ P&L แบ่งตามหุ้น/ตัวเลือก
- `calculateROI()` - คำนวณ Return on Investment
- `calculateAverageCost()` - คำนวณต้นทุนเฉลี่ย

### 4. **Portfolio Management**
- `calculateCurrentPosition()` - คำนวณ position ใหญ่ที่สุดในปัจจุบัน
- `getPortfolioSummary()` - สรุปพอร์ตโฟลิโอทั้งหมด
- `calculateTotalCapitalInvested()` - คำนวณทุนลงทุนทั้งหมด
- `calculateProfitTargets()` - คำนวณเป้าหมายกำไร
- `getRiskAssessment()` - ประเมินความเสี่ยง

### 5. **Search & Filter**
- `searchTransactions()` - ค้นหารายการตามเงื่อนไขต่างๆ
- `filterByDateRange()` - กรองตามช่วงเวลา
- `filterByTransactionType()` - กรองตามประเภท (Buy/Sell)
- `filterByAssetType()` - กรองตามประเภทสินทรัพย์ (Stock/Option)

### 6. **Reports & Analytics**
- `generateMonthlyReport()` - สร้างรายงานรายเดือน
- `generateYearlyReport()` - สร้างรายงานรายปี
- `calculateWinRate()` - คำนวณอัตราการชนะ
- `getMostProfitableSymbol()` - หาสัญลักษณ์ที่กำไรมากที่สุด
- `getLargestLoss()` - หาการขาดทุนที่ใหญ่ที่สุด
- `getPerformanceTrend()` - แนวโน้มประสิทธิภาพ

### 7. **Data Export**
- `exportToCSV()` - ส่งออกข้อมูลเป็น CSV
- `exportToExcel()` - ส่งออกข้อมูลเป็น Excel
- `printReport()` - พิมพ์รายงาน

### 8. **Dashboard & Visualization**
- `getDashboardStats()` - ดึงสถิติสำหรับหน้าแรก
- `getChartData()` - เตรียมข้อมูลสำหรับกราฟ
- `calculateEquityCurve()` - คำนวณเส้นโค้งอิควิตี้

### 9. **Notifications & Alerts**
- `setStopLossAlert()` - ตั้งค่าแจ้งเตือน Stop Loss
- `setProfitTargetAlert()` - ตั้งค่าแจ้งเตือนเป้าหมายกำไร
- `getAlerts()` - ดึงข้อมูลแจ้งเตือน

### 10. **Settings & Preferences**
- `setCurrency()` - ตั้งค่าสกุลเงิน
- `setCommissionRate()` - ตั้งค่าค่าธรรมเนียม
- `setTaxRate()` - ตั้งค่าอัตราภาษี

## Database Schema

### Users Table
- id, username, email, password_hash, created_at, updated_at

### Transactions Table
- id, user_id, symbol, transaction_type (buy/sell), quantity, price, date, transaction_cost, notes

### Position Table
- id, user_id, symbol, asset_type (stock/option), current_quantity, average_cost, current_price

### Option Contracts Table
- id, user_id, symbol, option_type (call/put), strike_price, expiration_date, contracts, premium_paid

### Alerts Table
- id, user_id, symbol, alert_type (stop_loss/profit_target), trigger_price, is_active
