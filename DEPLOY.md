# Deploy — Supabase + Vercel

แอปทำงานได้ทันทีแบบ **localStorage** (ไม่ต้องตั้งค่าอะไร) เมื่อใส่คีย์ Supabase แล้วจะอัปเกรดเป็น **cloud sync + login** อัตโนมัติ

---

## 1) สร้าง Supabase project (ฟรี)

1. ไปที่ https://supabase.com → New project (เลือก region ใกล้ที่สุด เช่น Singapore)
2. รอ provision เสร็จ → เมนู **SQL Editor** → New query → วางทั้งไฟล์ [`supabase/schema.sql`](supabase/schema.sql) → **Run**
   (สร้างตาราง `portfolios` + เปิด Row Level Security ให้แต่ละ user เห็นเฉพาะข้อมูลตัวเอง)
3. เมนู **Project Settings → API** คัดลอก 2 ค่า:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

> ค่า anon key เปิดเผยฝั่ง client ได้ตามปกติ — ความปลอดภัยมาจาก RLS ใน schema

### (ตัวเลือก) ปิดการยืนยันอีเมล เพื่อทดสอบเร็วขึ้น
Authentication → Providers → Email → ปิด **Confirm email** (ถ้าเปิดไว้ ต้องกดลิงก์ในอีเมลก่อนเข้าระบบครั้งแรก)

---

## 2) รันในเครื่อง (dev)

```powershell
copy .env.local.example .env.local
# แก้ .env.local ใส่ค่าจริงจากขั้นตอนที่ 1
npm run dev
```

เปิดเว็บ → มุมขวาบนจะเปลี่ยนจาก "💾 บันทึกในเครื่อง" เป็นปุ่ม **เข้าสู่ระบบ / สมัคร**

---

## 3) Push ขึ้น GitHub

```powershell
git add -A
git commit -m "Add Supabase persistence + Vercel deploy config"
git push
```

---

## 4) Deploy ขึ้น Vercel

1. ไปที่ https://vercel.com → **Add New → Project** → import repo `topgainer-hq`
2. Vercel จะอ่าน [`vercel.json`](vercel.json) เอง (framework Vite, build `npm run build`, output `dist`)
3. **Environment Variables** → เพิ่ม 2 ตัว (ค่าเดียวกับ `.env.local`):
   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | https://xxxx.supabase.co |
   | `VITE_SUPABASE_ANON_KEY` | eyJ... |
4. **Deploy** → ได้ URL เช่น `https://topgainer-hq.vercel.app`

### ตั้งค่า redirect ของ Supabase (กันปัญหายืนยันอีเมล)
Supabase → Authentication → URL Configuration → ใส่โดเมน Vercel ใน **Site URL** และ **Redirect URLs**

---

## หมายเหตุ
- `base` ใน `vite.config.ts` ตั้งเป็น `/` แล้ว (สำหรับ Vercel) — ถ้าจะกลับไปใช้ GitHub Pages ให้เปลี่ยนเป็น `/topgainer-hq/`
- `.env.local` ถูก gitignore ไว้แล้ว — คีย์จะไม่ขึ้น repo
- ไม่ใส่คีย์ = แอปยังใช้ได้ (localStorage) แต่ไม่มี login/sync ข้ามเครื่อง
