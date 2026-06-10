import vine, { errors } from '@vinejs/vine';
import WASocketManager from '#wa/whatsapp';
import Device from '#models/device';
import axios from 'axios';
import { LRUCache } from 'lru-cache';
const CACHE_ON_WHATSAPP = new LRUCache({
    max: 100,
    ttl: 1000 * 60 * 60,
});
const tokenValidator = vine.compile(vine.object({
    token: vine.union([
        vine.union.if((value) => Array.isArray(value), vine.array(vine.string())),
        vine.union.else(vine.string()),
    ]),
    to: vine.string(),
}));
const textMessageValidator = vine.compile(vine.object({
    message: vine.string().minLength(1),
}));
const imageMessageValidator = vine.compile(vine.object({
    image: vine.string().url(),
    caption: vine.string().nullable().optional(),
}));
const videoMessageValidator = vine.compile(vine.object({
    video: vine.string().url(),
    caption: vine.string().nullable().optional(),
}));
const audioMessageValidator = vine.compile(vine.object({
    audio: vine.string().url(),
}));
const documentMessageValidator = vine.compile(vine.object({
    document: vine.string().url(),
    filename: vine.string().nullable().optional(),
}));
const locationMessageValidator = vine.compile(vine.object({
    latitude: vine.number(),
    longitude: vine.number(),
}));
export default class MessageController {
    async index({ request, response }) {
        const body = request.method() === 'POST' ? request.body() : request.qs();
        try {
            const { token, to } = await request.validateUsing(tokenValidator);
            const selectedDevice = await this.getActiveDevice(token);
            if (!selectedDevice) {
                return response.unprocessableEntity({
                    message: 'No active devices found for the provided tokens.',
                });
            }
            const sock = this.getSocket(selectedDevice);
            if (body?.message) {
                return await this.sendTextMessage(request, response, sock, to, token, selectedDevice);
            }
            if (body?.image) {
                return await this.sendImageMessage(request, response, sock, to, token, selectedDevice);
            }
            if (body?.video) {
                return await this.sendVideoMessage(request, response, sock, to, token, selectedDevice);
            }
            if (body?.audio) {
                return await this.sendAudioMessage(request, response, sock, to, token, selectedDevice);
            }
            if (body?.document) {
                return await this.sendDocumentMessage(request, response, sock, to, token, selectedDevice);
            }
            if (body?.latitude && body?.longitude) {
                return await this.sendLocationMessage(request, response, sock, to, token, selectedDevice);
            }
            return response.unprocessableEntity({
                message: 'No valid message type provided.',
            });
        }
        catch (error) {
            return this.handleError(error, response);
        }
    }
    async query({ request, response }) {
        try {
            const { token, to } = await request.validateUsing(tokenValidator);
            const selectedDevice = await this.getActiveDevice(token);
            if (!selectedDevice) {
                return response.unprocessableEntity({
                    message: 'No active devices found for the provided tokens.',
                });
            }
            const sock = this.getSocket(selectedDevice);
            return await this.sendQueryMessage(request, response, sock, to, token, selectedDevice);
        }
        catch (error) {
            return this.handleError(error, response);
        }
    }
    async sendTextMessage(request, response, sock, to, token, device) {
        const { message } = await request.validateUsing(textMessageValidator);
        const jid = await this.validateAndGetJid(sock, to);
        if (!jid) {
            return response.unprocessableEntity({
                message: 'The phone number is not on WhatsApp.',
            });
        }
        try {
            await sock.sendMessage(jid, { text: message });
            return response.ok({
                message: 'Message sent successfully',
                data: {
                    device: { number: device.number, token },
                    to: jid.split('@')[0],
                },
            });
        }
        catch (error) {
            return response.internalServerError({
                message: error.message || 'Failed to send message.',
            });
        }
    }
    async sendImageMessage(request, response, sock, to, token, device) {
        const { image, caption } = await request.validateUsing(imageMessageValidator);
        const jid = await this.validateAndGetJid(sock, to);
        if (!jid) {
            return response.unprocessableEntity({
                message: 'The phone number is not on WhatsApp.',
            });
        }
        try {
            await sock.sendMessage(jid, { image: { url: image }, caption });
            return response.ok({
                message: 'Message sent successfully',
                data: {
                    device: { number: device.number, token },
                    to: jid.split('@')[0],
                },
            });
        }
        catch (error) {
            return response.internalServerError({
                message: error.message || 'Failed to send message.',
            });
        }
    }
    async sendVideoMessage(request, response, sock, to, token, device) {
        const { video, caption } = await request.validateUsing(videoMessageValidator);
        const jid = await this.validateAndGetJid(sock, to);
        if (!jid) {
            return response.unprocessableEntity({
                message: 'The phone number is not on WhatsApp.',
            });
        }
        try {
            await sock.sendMessage(jid, { video: { url: video }, caption, ptv: false });
            return response.ok({
                message: 'Message sent successfully',
                data: {
                    device: { number: device.number, token },
                    to: jid.split('@')[0],
                },
            });
        }
        catch (error) {
            return response.internalServerError({
                message: error.message || 'Failed to send message.',
            });
        }
    }
    async sendAudioMessage(request, response, sock, to, token, device) {
        const { audio } = await request.validateUsing(audioMessageValidator);
        const jid = await this.validateAndGetJid(sock, to);
        if (!jid) {
            return response.unprocessableEntity({
                message: 'The phone number is not on WhatsApp.',
            });
        }
        try {
            await sock.sendMessage(jid, { audio: { url: audio }, mimetype: 'audio/mp4' });
            return response.ok({
                message: 'Message sent successfully',
                data: {
                    device: { number: device.number, token },
                    to: jid.split('@')[0],
                },
            });
        }
        catch (error) {
            return response.internalServerError({
                message: error.message || 'Failed to send message.',
            });
        }
    }
    async sendDocumentMessage(request, response, sock, to, token, device) {
        const { document, filename } = await request.validateUsing(documentMessageValidator);
        const jid = await this.validateAndGetJid(sock, to);
        if (!jid) {
            return response.unprocessableEntity({
                message: 'The phone number is not on WhatsApp.',
            });
        }
        try {
            const MAX_SIZE = 100 * 1024 * 1024;
            const status = await axios.head(document);
            const contentLength = Number.parseInt(status.headers['content-length'], 10);
            if (contentLength > MAX_SIZE) {
                return response.unprocessableEntity({
                    message: 'File size is too large.',
                });
            }
            const buffer = await axios.get(document, { responseType: 'arraybuffer' });
            const type = status.headers['content-type'];
            const name = document.split('/').pop();
            await sock.sendMessage(jid, {
                document: buffer.data,
                fileName: filename + '.' + name.split('.').pop() || name,
                mimetype: type,
            });
            return response.ok({
                message: 'Message sent successfully',
                data: {
                    device: { number: device.number, token },
                    to: jid.split('@')[0],
                },
            });
        }
        catch (error) {
            return response.internalServerError({
                message: error.message || 'Failed to send message.',
            });
        }
    }
    async sendLocationMessage(request, response, sock, to, token, device) {
        const { latitude, longitude } = await request.validateUsing(locationMessageValidator);
        const jid = await this.validateAndGetJid(sock, to);
        if (!jid) {
            return response.unprocessableEntity({
                message: 'The phone number is not on WhatsApp.',
            });
        }
        try {
            await sock.sendMessage(jid, {
                location: { degreesLatitude: latitude, degreesLongitude: longitude },
            });
            return response.ok({
                message: 'Message sent successfully',
                data: {
                    device: { number: device.number, token },
                    to: jid.split('@')[0],
                },
            });
        }
        catch (error) {
            return response.internalServerError({
                message: error.message || 'Failed to send message.',
            });
        }
    }
    async sendQueryMessage(request, response, sock, to, token, device) {
        const { content, options } = request.body();
        if (!(content && typeof content === 'object') || !(options && typeof options === 'object')) {
            return response.unprocessableEntity({
                message: 'Content and options are required.',
            });
        }
        const jid = await this.validateAndGetJid(sock, to);
        if (!jid) {
            return response.unprocessableEntity({
                message: 'The phone number is not on WhatsApp.',
            });
        }
        try {
            await sock.sendMessage(jid, content, options);
            return response.ok({
                message: 'Message sent successfully',
                data: {
                    device: { number: device.number, token },
                    to: jid.split('@')[0],
                },
            });
        }
        catch (error) {
            return response.internalServerError({
                message: error.message || 'Failed to send message.',
            });
        }
    }
    getSocket(device) {
        const sessionKey = `${device.id}-${device.number}`;
        return WASocketManager.getSession(sessionKey);
    }
    async getActiveDevice(token) {
        const tokenArray = typeof token === 'string' ? token.split(',') : token;
        const devices = await Device.query()
            .preload('accessTokens')
            .whereHas('accessTokens', (query) => {
            query.whereIn('token', tokenArray);
        });
        const activeDevices = devices.filter((device) => {
            const sessionKey = `${device.id}-${device.number}`;
            const status = WASocketManager.SESSION_STATUS.get(sessionKey);
            return status === 'connected';
        });
        if (activeDevices.length === 0) {
            return null;
        }
        return activeDevices[Math.floor(Math.random() * activeDevices.length)];
    }
    async validateAndGetJid(sock, to) {
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
    toJid(jid) {
        return jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
    }
    handleError(error, response) {
        if (error instanceof errors.E_VALIDATION_ERROR) {
            return response.unprocessableEntity({
                message: error.messages[0]?.message,
                errors: error.messages,
            });
        }
        return response.internalServerError({
            message: error.message || 'An unexpected error occurred.',
        });
    }
}
//# sourceMappingURL=message_controller.js.map