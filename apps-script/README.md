# Apps Script Setup (for Nick)

รันทีเดียวจบ ใช้เวลา ~5 นาที

## 1. สร้าง Google Sheet

1. ไปที่ https://sheets.google.com → สร้าง Sheet ใหม่
2. ตั้งชื่อ เช่น `Reward Kid — Nile`
3. **Copy Sheet ID** จาก URL:
   ```
   https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit
   ```
   เอา `THIS_IS_THE_ID` มาใส่ใน `Code.gs` ตรงบรรทัด:
   ```javascript
   const SHEET_ID = 'PUT_YOUR_GOOGLE_SHEET_ID_HERE';
   ```

## 2. วาง Apps Script

1. ใน Google Sheet → เมนู **Extensions** → **Apps Script**
2. ลบโค้ดตัวอย่างออกให้หมด
3. Copy เนื้อหาทั้งหมดจาก `Code.gs` มาวาง
4. **Save** (Ctrl+S / ⌘+S)
5. กด **Run setup** (เลือกฟังก์ชัน `setup` แล้วกด ▶)
6. จะมี popup ขอ Permission → **Review permissions** → เลือก account → **Advanced** → **Go to ... (unsafe)** → **Allow**
7. ดู Sheet จะเห็น 3 tabs ถูกสร้าง: `tasks`, `rewards`, `logs` + ข้อมูล default

## 3. Deploy เป็น Web App

1. **Deploy** (ขวาบน) → **New deployment**
2. เลือก type: **Web app**
3. ตั้งค่า:
   - **Description:** `Reward Kid v1`
   - **Execute as:** `Me (your-email@gmail.com)`
   - **Who has access:** `Anyone` ⚠️ (เพราะ Nova app เรียกจาก client; rate-limit ด้วยชื่อ tab ที่ obscure)
4. กด **Deploy** → **Authorize access** อีกรอบ
5. **Copy Web app URL** ออกมา จะหน้าตอประมาณ:
   ```
   https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxx/exec
   ```

## 4. ใส่ URL ในแอป

แก้ `.env.local` ในโปรเจกต์ `reward-kid-app`:
```
NEXT_PUBLIC_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbxx/exec
```

แล้ว restart dev server / rebuild

## 5. ทดสอบ

เปิด URL ใน browser:
```
https://script.google.com/macros/s/AKfycbxx/exec?action=list_all
```

ถ้าเห็น JSON กลับมา = สำเร็จ 🎉

## 6. แก้ข้อมูล

- เปิด Google Sheet → แก้ title/cost/points ตรง ๆ ได้เลย
- กด refresh ที่แอป จะดึงข้อมูลใหม่
- ลบ task ที่ไม่ใช้แล้ว = ตั้ง `active = FALSE` (ไม่ลบทิ้ง กัน log เก่าหาย)