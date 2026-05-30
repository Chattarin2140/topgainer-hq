# 🔐 Login/Logout Feature - Setup Guide

ผมเพิ่ม Authentication ให้เสร็จแล้ว 🎉

---

## 📋 ที่เพิ่ม

### Backend
- ✅ User Model (MongoDB)
- ✅ Auth Routes (Register, Login, Logout)
- ✅ JWT Authentication
- ✅ Password Hashing (bcrypt)

### Frontend
- ✅ Login Page
- ✅ Register Page
- ✅ Auth Context (State Management)
- ✅ Protected Routes
- ✅ Logout Button ใน Navbar

---

## 🚀 Setup - ทำ 1 ครั้งแรก

### **Step 1: ติดตั้ง Backend Dependencies**

```powershell
cd "C:\CODE\Stock Options Tracker\backend"
npm install bcryptjs jsonwebtoken
```

---

### **Step 2: ติดตั้ง Frontend Dependencies**

```powershell
# ย้อนกลับไปโฟลเดอร์หลัก
cd "C:\CODE\Stock Options Tracker"
npm install
```

---

## ▶️ Run - ทุกครั้ง

### **Terminal 1 - Backend**

```powershell
cd "C:\CODE\Stock Options Tracker\backend"
npm start
```

ควรเห็น:
```
✅ Connected to MongoDB
🚀 Server running on http://localhost:3000
```

---

### **Terminal 2 - Frontend**

```powershell
cd "C:\CODE\Stock Options Tracker"
npm run dev
```

ควรเห็น:
```
Local: http://localhost:5173/
```

---

## 🎯 ลองใช้

1. **ไปที่** `http://localhost:5173`
2. **คลิก "สมัครสมาชิก"**
   - ใส่ username, email, password
   - คลิก "สมัครสมาชิก"

3. **เข้าสู่ระบบอัตโนมัติ**
   - ถ้าสำเร็จ จะไป Dashboard ทันที

4. **ลองใช้งาน Dashboard**
   - บันทึกรายการ
   - ดูพอร์ตโฟลิโอ
   - ดูรายงาน

5. **ออกจากระบบ**
   - Navbar → คลิก "ออกจากระบบ"
   - ถ้ากลับไปยัง Login ก็สำเร็จ ✅

---

## 🔑 Test Credentials

**User ที่สมัครสำเร็จ:**
```
Email: test@example.com
Password: 123456
```

(สร้างด้วยการสมัครสมาชิก)

---

## 📂 ไฟล์ที่เพิ่ม

### Backend
- `models/User.js` - User schema
- `routes/auth.js` - Auth endpoints

### Frontend
- `pages/Login.tsx` - Login page
- `pages/Register.tsx` - Register page
- `contexts/AuthContext.tsx` - Auth state
- `hooks/useAuth.ts` - Auth hook
- `components/ProtectedRoute.tsx` - Route protection

---

## 🔒 Security Notes

- ✅ Passwords hashed with bcrypt
- ✅ JWT tokens for authentication
- ✅ Protected routes require login
- ✅ Transactions only for logged-in users

---

## ⚙️ ถ้าต้องเปลี่ยน JWT Secret

**ไฟล์:** `backend/.env`

```env
JWT_SECRET=your-custom-secret-key-here
```

**สิ่งสำคัญ:** ต้องเปลี่ยนใน Production!

---

## ❓ Troubleshooting

### Error: "Cannot find module 'bcryptjs'"
```bash
npm install bcryptjs jsonwebtoken
```

### Error: "Invalid token"
```bash
# Clear localStorage และ login ใหม่
# DevTools → Application → localStorage → clear
```

### Port 3000/5173 already in use
```bash
# ใช้ port อื่น
# .env: PORT=3001
```

---

**พร้อมใช้แล้ว! 🚀** ลองเลย!
