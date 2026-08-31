const express = require('express');
const cors = require('cors');
const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason 
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
// ระบบเชื่อมต่อ WhatsApp ด้วย Baileys
// ----------------------------------------------------
async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    
    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n======================================================');
        console.log('⚡ [BAILEYS] สแกน QR Code ด้านล่างนี้ใน WhatsApp มือถือ:');
        console.log('======================================================');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log('⚠️ [BAILEYS] หลุดการเชื่อมต่อ กำลังเชื่อมต่อใหม่...', shouldReconnect);
        isConnected = false;
        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 3000);
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
// 1. Health Check
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
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${SECRET_KEY}`) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized: Secret Key ไม่ถูกต้อง' 
      });
    }

    const { targetJid, actionType, repeatCount = 1 } = req.body;

    if (!targetJid) {
      return res.status(400).json({ 
        success: false, 
        error: 'กรุณาระบุ targetJid (เช่น 66941876682@s.whatsapp.net)' 
      });
    }

    if (!isConnected || !sock) {
      return res.status(503).json({ 
        success: false, 
        error: 'WhatsApp ยังไม่ได้เชื่อมต่อ กรุณาสแกน QR Code ใน Render Logs ก่อน' 
      });
    }

    console.log(`🚀 [EXECUTE] ยิงไปที่: ${targetJid} | ชนิด: ${actionType} | จำนวน: ${repeatCount} ครั้ง`);

    for (let i = 0; i < Number(repeatCount); i++) {
      if (actionType === 'vcard_gacor') {
        const phone = targetJid.split('@')[0];
        const vcard = 'BEGIN:VCARD\n'
          + 'VERSION:3.0\n'
          + 'FN:System Security Alert\n'
          + 'ORG:SC-Fire Controller;\n'
          + `TEL;type=CELL;type=VOICE;waid=${phone}:+${phone}\n`
          + 'END:VCARD';

        await sock.sendMessage(targetJid, {
          contacts: {
            displayName: 'System Security Alert',
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
