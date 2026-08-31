# SC-Fire Test Server

Node.js WhatsApp Baileys & Dispatch API Controller

## API Endpoint
- **POST** `/api/execute`
- **Headers:** `Authorization: Bearer SEC_AUTH_KEY_99X`

### ตัวอย่างคำสั่ง cURL:
```bash
curl -X POST https://sc-fire-test-4hk1.onrender.com/api/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEC_AUTH_KEY_99X" \
  -d '{
    "targetJid": "66941876682@s.whatsapp.net",
    "actionType": "vcard_gacor",
    "repeatCount": 1
  }'
