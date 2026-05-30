# 🚀 MongoDB + Backend Setup Guide

เชื่อม MongoDB กับ Stock Tracker - ขั้นตอนทั้งหมด

---

## ⚠️ สถานการณ์ปัจจุบัน

```
❌ ปัจจุบัน:        Frontend เก็บ localStorage เท่านั้น
✅ หลังจากนี้:      Frontend ↔ Backend API ↔ MongoDB
```

---

## 📋 ขั้นตอนที่ 1: ติดตั้ง MongoDB

### ตัวเลือก A: Local MongoDB (ใช้กับ MongoDB Compass เหมือนรูปของคุณ)

```bash
# 1. Download MongoDB Community Edition
# ไปที่: https://www.mongodb.com/try/download/community
# เลือก: Windows, msi file

# 2. ติดตั้ง (ถัดไป ถัดไป จบ)

# 3. ตรวจสอบติดตั้ง
mongod --version
```

**หลังติดตั้ง:** MongoDB service จะรันใน background อัตโนมัติ

---

### ตัวเลือก B: MongoDB Atlas (Cloud - ไม่ต้องติดตั้ง)

```
1. ไปที่ https://www.mongodb.com/cloud/atlas
2. สมัครสมาชิก (ฟรี)
3. สร้าง Cluster
4. ไป Security → Database Access → สร้าง user
5. ไป Network Access → Add IP address (0.0.0.0)
6. ไปที่ Connect → Get connection string
7. Copy string ลงใน .env ของ backend
```

---

## 📋 ขั้นตอนที่ 2: ติดตั้ง Backend

```bash
# 1. เปิด PowerShell/Command Prompt
cd "c:\CODE\Stock Options Tracker\backend"

# 2. ติดตั้ง dependencies
npm install

# ผลลัพธ์: ประมาณ 2-3 นาที
```

---

## 📋 ขั้นตอนที่ 3: ตั้งค่า .env

**ไฟล์:** `c:\CODE\Stock Options Tracker\backend\.env`

### ถ้าใช้ Local MongoDB:
```env
MONGODB_URI=mongodb://localhost:27017/stock-tracker
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### ถ้าใช้ MongoDB Atlas:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/stock-tracker
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

---

## 📋 ขั้นตอนที่ 4: รัน Backend

### Terminal 1 - Backend Server

```bash
cd "c:\CODE\Stock Options Tracker\backend"
npm run dev
```

**ผลลัพธ์:**
```
✅ Connected to MongoDB
🚀 Server running on http://localhost:3000
```

### Terminal 2 - Frontend (ยังคงใช้เดิม)

```bash
cd "c:\CODE\Stock Options Tracker"
npm run dev
```

---

## ✅ ขั้นตอนที่ 5: ตรวจสอบการเชื่อม

### Test 1: API Health Check
```bash
# ในเบราว์เซอร์ไปที่:
http://localhost:3000/api/health

# ผลลัพธ์:
{"status":"OK","message":"Server is running"}
```

### Test 2: เข้าเว็บไซต์ + บันทึกรายการ
```
1. ไปที่ http://localhost:5173
2. ไปที่ Transactions → บันทึกรายการใหม่
3. ตรวจสอบ MongoDB Compass ว่าข้อมูลปรากฏหรือไม่
```

### Test 3: ดู Data ใน MongoDB Compass

```
1. เปิด MongoDB Compass
2. Connection: mongodb://localhost:27017
3. ไปที่ Database: stock-tracker
4. ไปที่ Collection: transactions
5. ควรเห็นรายการที่บันทึก
```

---

## 🎯 Workflow เมื่อใช้งาน

### ทุกครั้งที่ต้องการหารรายการ:

**Terminal 1:**
```bash
cd "c:\CODE\Stock Options Tracker\backend"
npm run dev
```
(รอจนเห็น `✅ Connected to MongoDB`)

**Terminal 2:**
```bash
cd "c:\CODE\Stock Options Tracker"
npm run dev
```
(รอจนเห็น `Local: http://localhost:5173/`)

**เบราว์เซอร์:**
```
http://localhost:5173
```

---

## 📊 ไฟล์โครงสร้าง

```
Stock Options Tracker/
├── backend/                    ← ← ← NEW
│   ├── server.js              (Main API)
│   ├── .env                   (Config)
│   ├── package.json
│   ├── models/
│   │   └── Transaction.js    (Database schema)
│   └── routes/
│       └── transactions.js   (API endpoints)
│
└── src/                        (Frontend)
    ├── utils/
    │   ├── api.ts            (Updated - ใช้ API)
    │   └── store.ts          (Updated - ใช้ API)
    └── ...
```

---

## 🔑 สิ่งสำคัญ

✅ Backend ต้องราน port 3000  
✅ Frontend ต้องราน port 5173  
✅ MongoDB ต้องเปิดอยู่ (ไม่ว่า local หรือ cloud)  
✅ ทั้ง 2 terminal ต้องรันพร้อมกัน  

---

## ❎ หากมีข้อผิดพลาด

### Error: "MongoDB connection failed"
```bash
# ตรวจสอบ:
# 1. MongoDB service กำลังรัน?
# 2. .env file มี MONGODB_URI ถูก?
# 3. Username/Password ถูก? (ถ้าใช้ Atlas)
```

### Error: "Port 3000 already in use"
```bash
# Port ถูกใช้โดยโปรแกรมอื่น
# เปลี่ยน .env เป็น PORT=3001
```

### Error: "Cannot connect to localhost:3000"
```bash
# ตรวจสอบว่า backend กำลังรัน
# ไปที่ Terminal ที่รัน backend แล้วเช็ค
```

---

## 🎉 เสร็จสิ้น!

ตอนนี้ระบบของคุณ:
- ✅ เก็บข้อมูลใน MongoDB
- ✅ ใช้ Backend API
- ✅ Frontend React
- ✅ สามารถเข้าจากคอมพิวเตอร์อื่นได้ (ถ้า deploy)

**ท่านอยากเพิ่มอะไรเพิ่มเติมไหม?**
- User Authentication?
- Export to Excel?
- Real-time price updates?

สอบถามเลย! 💬
