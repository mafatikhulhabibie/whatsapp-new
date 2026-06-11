import WASocketManager from '#wa/whatsapp';
import { normalizeToWhatsAppNumber } from '#services/phone';
import axios from 'axios';
import { LRUCache } from 'lru-cache';

const CACHE_ON_WHATSAPP = new LRUCache({
    max: 100,
    ttl: 1000 * 60 * 60,
});

export default class MessageSender {
    static getSessionKey(device) {
        return `${device.id}-${device.number}`;
    }

    static isDeviceConnected(device) {
        return WASocketManager.SESSION_STATUS.get(this.getSessionKey(device)) === 'connected';
    }

    static getSocket(device) {
        return WASocketManager.getSession(this.getSessionKey(device));
    }

    static toJid(jid) {
        if (jid.includes('@')) {
            return jid;
        }
        return `${normalizeToWhatsAppNumber(jid)}@s.whatsapp.net`;
    }

    static async validateAndGetJid(sock, to) {
        const jid = this.toJid(to);
        if (jid.includes('@g.us') || jid.includes('@lid')) {
            return jid;
        }
        if (CACHE_ON_WHATSAPP.has(jid)) {
            return CACHE_ON_WHATSAPP.get(jid);
        }
        const onWhatsApp = await sock.onWhatsApp(jid);
        if (!onWhatsApp?.length) {
            return null;
        }
        CACHE_ON_WHATSAPP.set(jid, onWhatsApp[0]?.jid || jid);
        return onWhatsApp[0]?.jid || jid;
    }

    static buildBaileysPayload(messageType, payload) {
        switch (messageType) {
            case 'text':
                return { text: payload.message };
            case 'image':
                return { image: { url: payload.image }, caption: payload.caption || undefined };
            case 'video':
                return { video: { url: payload.video }, caption: payload.caption || undefined, ptv: false };
            case 'document':
                return null;
            case 'location':
                return {
                    location: {
                        degreesLatitude: payload.latitude,
                        degreesLongitude: payload.longitude,
                    },
                };
            default:
                return null;
        }
    }

    static async send(device, to, messageType, payload) {
        if (!this.isDeviceConnected(device)) {
            return { ok: false, error: 'Device belum connected.' };
        }
        const sock = this.getSocket(device);
        if (!sock) {
            return { ok: false, error: 'Sesi WhatsApp tidak ditemukan.' };
        }
        const jid = await this.validateAndGetJid(sock, to);
        if (!jid) {
            return { ok: false, error: 'Nomor tidak terdaftar di WhatsApp.' };
        }
        try {
            if (messageType === 'document') {
                const MAX_SIZE = 100 * 1024 * 1024;
                const status = await axios.head(payload.document);
                const contentLength = Number.parseInt(status.headers['content-length'], 10);
                if (contentLength > MAX_SIZE) {
                    return { ok: false, error: 'Ukuran file terlalu besar.' };
                }
                const buffer = await axios.get(payload.document, { responseType: 'arraybuffer' });
                const type = status.headers['content-type'];
                const name = payload.document.split('/').pop();
                await sock.sendMessage(jid, {
                    document: buffer.data,
                    fileName: payload.filename
                        ? `${payload.filename}.${name.split('.').pop()}`
                        : name,
                    mimetype: type,
                });
            }
            else {
                const baileysPayload = this.buildBaileysPayload(messageType, payload);
                if (!baileysPayload) {
                    return { ok: false, error: 'Tipe pesan tidak valid.' };
                }
                await sock.sendMessage(jid, baileysPayload);
            }
            return { ok: true, to: jid.split('@')[0] };
        }
        catch (error) {
            return { ok: false, error: error.message || 'Gagal mengirim pesan.' };
        }
    }
}
