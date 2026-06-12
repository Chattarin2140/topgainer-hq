
# Stock & Options P&L Tracker

เว็บแอปสำหรับจดบันทึกและคำนวณกำไร/ขาดทุน (P&L) จากการเทรดหุ้นและออปชั่น
รองรับการนำเข้าไฟล์ Webull และซิงค์ข้อมูลขึ้นคลาวด์

## 🚀 ฟีเจอร์หลัก

- **Stock P&L** — บันทึก/คำนวณกำไรขาดทุนของหุ้น (ต้นทุนเฉลี่ย, Net P&L, ROI)
- **Option P&L** — บันทึก/คำนวณกำไรขาดทุนของออปชั่น
- **Realized P&L** — จับคู่รายการแบบ FIFO จาก Webull Monthly Statement (TRADE RECORDS)
- **P&L Calendar** — ปฏิทิน heat-map แสดงกำไรขาดทุนรายวัน
- **Charts** — กราฟ SVG (วาดเองไม่พึ่งไลบรารี chart)
- **Webull Import** — รองรับ 3 รูปแบบ: Positions export, Options export และ Monthly Statement
- **Cloud sync + Login** — ผ่าน Supabase (ถ้าไม่ตั้งค่าคีย์ จะ fallback ไปใช้ localStorage อัตโนมัติ)

## 🛠️ Technology Stack

- **Frontend**: React 18 (single-file component, inline styles, ธีม dark JetBrains Mono)
- **Build Tool**: Vite
- **Persistence / Auth**: Supabase (`@supabase/supabase-js`) — fallback เป็น localStorage
- **Deploy**: Vercel

## 📦 การใช้งาน

```bash
npm install      # ติดตั้ง dependencies
npm run dev      # รัน dev server
npm run build    # build สำหรับ production
npm run preview  # พรีวิว production build
npm run lint     # ตรวจ lint
```

## 📁 โครงสร้างโปรเจกต์

```
index.html              # HTML entry — โหลด src/main.tsx
src/
├── main.tsx            # React entry — เรนเดอร์ <PnLTracker />
├── PnLTracker.jsx      # ทั้งแอปอยู่ในไฟล์เดียวนี้ (UI + ตรรกะ + CSV parser)
├── lib/
│   └── supabase.js     # Supabase client + auth + โหลด/บันทึกพอร์ต (มี localStorage fallback)
└── index.css           # base styles + Tailwind directives
supabase/
└── schema.sql          # schema ตาราง portfolios
```

## 🔑 การตั้งค่า Supabase (ไม่บังคับ)

คัดลอก `.env.local.example` เป็น `.env.local` แล้วใส่คีย์:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

ไม่ใส่คีย์ก็ใช้งานได้ทันที (เก็บข้อมูลใน localStorage ของเบราว์เซอร์)

## 🚢 Deploy

ดูขั้นตอน Supabase + Vercel แบบละเอียดใน [DEPLOY.md](./DEPLOY.md)

## 📝 License

MIT License
