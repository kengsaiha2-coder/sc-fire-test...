const express = require('express');
const cors = require('cors');
const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const SECRET_KEY = process.env.SECRET_KEY || 'SEC_AUTH_KEY_99X';

let sock = null;
let isConnected = false;

// ----------------------------------------------------
// ระบบเชื่อมต่อ WhatsApp ด้วย Baileys (ป้องกันหลุด)
// ----------------------------------------------------
async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));
    
    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      browser: ['Ubuntu', 'Chrome', '20.0.04'], // จำลองเป็น Browser ป้องกัน WhatsApp ดีด
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 15000,
      generateHighQualityLinkPreview: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // เมื่อมี QR Code ใหม่
      if (qr) {
        console.log('\n======================================================');
        console.log('⚡ [BAILEYS] สแกน QR Code ด้านล่างนี้ใน WhatsApp มือถือ:');
        console.log('======================================================');
        qrcode.generate(qr, { small: true });
      }

      // เมื่อหลุดการเชื่อมต่อ
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`⚠️ [BAILEYS] การเชื่อมต่อปิดตัว (Status: ${statusCode}) - กำลังต่อใหม่: ${shouldReconnect}`);
        isConnected = false;

        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 3000);
        } else {
          console.log('❌ [BAILEYS] เซสชันหมดอายุ กรุณาลบ auth_session แล้วสแกนใหม่');
        }
      } else if (connection === 'open') {
        console.log('\n======================================================');
        console.log('✅ [BAILEYS] เชื่อมต่อ WhatsApp สำเร็จ พร้อมรับคำสั่งแล้ว!');
        console.log('======================================================\n');
        isConnected = true;
      }
    });

  } catch (err) {
    console.error('❌ [BAILEYS INIT ERROR]:', err);
    setTimeout(connectToWhatsApp, 5000);
  }
}

connectToWhatsApp();

// ----------------------------------------------------
// 1. Health Check Endpoints
// ----------------------------------------------------
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    whatsappConnected: isConnected,
    service: 'SC-Fire Test Server' 
  });
});

app.get('/api/ping', (req, res) => {
  res.json({
    status: 'ok',
    whatsappConnected: isConnected,
    timestamp: new Date().toISOString()
  });
});

// ----------------------------------------------------
// 2. Route รับคำสั่งยิงไปเบอร์เป้าหมาย (/api/execute)
// ----------------------------------------------------
app.post('/api/execute', async (req, res) => {
  try {
    // 1. ตรวจสอบ Secret Key
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${SECRET_KEY}`) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized: Secret Key ไม่ถูกต้อง' 
      });
    }

    // 2. รับค่า Target & Payload
    const { targetJid, actionType = 'vcard_gacor', repeatCount = 1 } = req.body;

    if (!targetJid) {
      return res.status(400).json({ 
        success: false, 
        error: 'กรุณาระบุ targetJid (เช่น 66941876682@s.whatsapp.net)' 
      });
    }

    // 3. ตรวจสอบว่า WhatsApp เชื่อมต่ออยู่หรือไม่
    if (!isConnected || !sock) {
      return res.status(503).json({ 
        success: false, 
        error: 'WhatsApp ยังไม่ได้เชื่อมต่อ กรุณาสแกน QR Code ใน Render Logs ก่อน' 
      });
    }

    console.log(`🚀 [EXECUTE] ยิงไปที่: ${targetJid} | ชนิด: ${actionType} | จำนวน: ${repeatCount} ครั้ง`);

    // 4. ส่งข้อมูลไปยังเป้าหมาย
    for (let i = 0; i < Number(repeatCount); i++) {
      if (actionType === 'vcard_gacor') {
        const phone = targetJid.split('@')[0];
        const vcard = 'BEGIN:VCARD\n'
          + 'VERSION:3.0\n'
          + 'FN:System Security Verification\n'
          + 'ORG:SC-Fire Security Alert;\n'
          + `TEL;type=CELL;type=VOICE;waid=${phone}:+${phone}\n`
          + 'END:VCARD';

        await sock.sendMessage(targetJid, {
          contacts: {
            displayName: 'System Security Verification',
            contacts: [{ vcard }]
          }
        });
      } else {
        await sock.sendMessage(targetJid, { 
          text: `[SC-Fire Dispatch] Verification ping #${i + 1} for target: ${targetJid}` 
        });
      }
    }

    return res.json({
      success: true,
      message: `ส่งคำสั่งไปยัง ${targetJid} สำเร็จเรียบร้อยแล้ว (${repeatCount} ครั้ง)`,
      targetJid,
      actionType,
      repeatCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [EXECUTE ERROR]:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล' 
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ [SERVER] SC-Fire Server running on port ${PORT}`);
});
