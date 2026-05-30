# 💳 Pinecart Integration Guide

วิธีเพิ่ม Payment Gateway ด้วย Pinecart

---

## 📋 Pinecart คืออะไร?

Pinecart = Payment gateway ของไทย
- ✅ รองรับ QR Code Payment
- ✅ Credit Card
- ✅ Mobile Banking
- ✅ Easy to integrate

---

## 🚀 ขั้นตอนการตั้งค่า

### **Step 1: สมัครสมาชิก Pinecart**

```
ไปที่: https://www.pinecart.ai/
สมัครสมาชิก (ฟรี)
รับ API Key
```

---

### **Step 2: Storage & Backend Setup**

**Backend - เพิ่ม Environment Variables**

```env
PINECART_API_KEY=your_api_key
PINECART_SECRET=your_secret_key
```

---

### **Step 3: สร้าง Payment Service**

**ไฟล์:** `backend/routes/payment.js`

```javascript
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('./auth');

const PINECART_API = 'https://api.pinecart.ai/v1';
const API_KEY = process.env.PINECART_API_KEY;

// Create payment intent
router.post('/create-payment', verifyToken, async (req, res) => {
  try {
    const { amount, description } = req.body;

    const response = await axios.post(
      `${PINECART_API}/payment-intents`,
      {
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'THB',
        description,
        metadata: {
          userId: req.userId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify payment
router.get('/verify-payment/:intentId', async (req, res) => {
  try {
    const response = await axios.get(
      `${PINECART_API}/payment-intents/${req.params.intentId}`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

### **Step 4: Frontend - Payment Component**

**ไฟล์:** `src/components/PaymentModal.tsx`

```typescript
import { useState } from 'react';
import axios from 'axios';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
}

export default function PaymentModal({ isOpen, onClose, amount }: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      // สร้าง payment intent
      const response = await axios.post(
        'http://localhost:3000/api/payment/create-payment',
        {
          amount,
          description: 'Stock Tracker Premium',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const { payment_url } = response.data;

      // เปิด Pinecart payment page ในหน้าต่างใหม่
      window.open(payment_url, '_blank');

      // ปิด modal หลังจาก 30 วินาที
      setTimeout(() => {
        onClose();
      }, 30000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="card max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">💳 ชำระเงิน</h2>

        <div className="mb-6 p-4 bg-gray-100 rounded-lg">
          <p className="text-gray-600 text-sm">จำนวนเงินที่ต้องชำระ</p>
          <p className="text-3xl font-bold text-blue-600">฿{amount.toFixed(2)}</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button onClick={onClose} className="btn-secondary w-full">
            ยกเลิก
          </button>
          <button
            onClick={handlePayment}
            className="btn-primary w-full disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'กำลังโหลด...' : 'ชำระเงิน'}
          </button>
        </div>

        <p className="text-gray-500 text-xs text-center mt-4">
          ✅ ปลอดภัย 100% - ใช้ Pinecart
        </p>
      </div>
    </div>
  );
}
```

---

### **Step 5: อัพเดท Backend Server**

```javascript
// server.js
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);
```

---

### **Step 6: อัพเดท Settings Page**

```typescript
// src/pages/Settings.tsx
const [isPaymentOpen, setIsPaymentOpen] = useState(false);

// เพิ่มใน JSX
<button 
  onClick={() => setIsPaymentOpen(true)}
  className="btn-primary w-full"
>
  💳 Pinecart - ชำระเงิน
</button>

<PaymentModal
  isOpen={isPaymentOpen}
  onClose={() => setIsPaymentOpen(false)}
  amount={29.99}
/>
```

---

## 🔧 Setup ขั้นสุดท้าย

### **1. ติดตั้ง axios ใน backend**

```bash
cd backend
npm install axios
```

### **2. อัพเดท backend .env**

```env
PINECART_API_KEY=your_key_from_pinecart
PINECART_SECRET=your_secret
```

### **3. Refresh Frontend**

```bash
npm run dev
```

---

## 🎯 ทดสอบ Payment

1. ไปที่ **Settings**
2. คลิก **Pinecart - ชำระเงิน**
3. ระบบจะเปิด Pinecart payment page
4. สแกน QR หรือใส่บัตรเครดิต
5. ตรวจสอบ status

---

## 📊 Pinecart Dashboard

ดูรายการชำระเงิน:
```
https://dashboard.pinecart.ai/
Login → ค้นหา transactions
```

---

## ❓ คำถามบ่อย

**Q: ราคาเท่าไหร่?**  
A: Pinecart คิด commission ตามจำนวนและประเภทการชำระ (2-3%)

**Q: ใช้ได้ทั้งไทย?**  
A: ใช่ - รองรับ QR, Mobile Banking, Card

**Q: ข้อมูลปลอดภัยหรือไม่?**  
A: ใช่ - PCI DSS compliant

---

**ตอนนี้พร้อม payment settlement แล้ว! 🎉**
