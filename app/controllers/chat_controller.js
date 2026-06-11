import Device from '#models/device';
import ChatConversation from '#models/chat_conversation';
import ChatMessage from '#models/chat_message';
import WASocketManager from '#wa/whatsapp';
import MessageSender from '#services/message_sender';
import vine, { errors } from '@vinejs/vine';

export default class ChatController {
    async index({ view, auth }) {
        const devices = await Device.query()
            .where('user_id', auth.use('web').user.id)
            .orderBy('id', 'asc');

        const items = devices.map((device) => ({
            ...device.serialize(),
            status: WASocketManager.SESSION_STATUS.get(`${device.id}-${device.number}`) || 'disconnected',
        }));

        return view.render('chat/index', { devices: items });
    }

    async show({ params, view, auth, response }) {
        const device = await this.getUserDevice(params.deviceId, auth);
        if (!device) {
            return response.notFound('Device not found.');
        }

        const status = WASocketManager.SESSION_STATUS.get(`${device.id}-${device.number}`) || 'disconnected';
        const token = (await device.related('accessTokens').query().first())?.token || null;

        return view.render('chat/show', {
            device,
            token,
            status,
        });
    }

    async conversations({ params, auth, response }) {
        const device = await this.getUserDevice(params.deviceId, auth);
        if (!device) {
            return response.notFound({ message: 'Device not found.' });
        }

        const conversations = await ChatConversation.query()
            .where('device_id', device.id)
            .orderBy('last_message_at', 'desc')
            .limit(100);

        return response.ok({
            data: conversations.map((c) => ({
                id: c.id,
                chatJid: c.chatJid,
                name: c.name,
                isGroup: c.isGroup,
                lastMessagePreview: c.lastMessagePreview,
                lastMessageAt: c.lastMessageAt?.toISO(),
                unreadCount: c.unreadCount,
            })),
        });
    }

    async messages({ params, request, auth, response }) {
        const device = await this.getUserDevice(params.deviceId, auth);
        if (!device) {
            return response.notFound({ message: 'Device not found.' });
        }

        const chatJid = request.input('chat');
        if (!chatJid) {
            return response.badRequest({ message: 'Parameter chat wajib diisi.' });
        }

        const conversation = await ChatConversation.query()
            .where('device_id', device.id)
            .andWhere('chat_jid', chatJid)
            .first();

        if (conversation) {
            conversation.unreadCount = 0;
            await conversation.save();
        }

        const query = ChatMessage.query()
            .where('device_id', device.id)
            .andWhere('chat_jid', chatJid)
            .orderBy('message_at', 'desc')
            .limit(80);

        const messages = await query;
        messages.reverse();

        return response.ok({
            data: messages.map((m) => ({
                id: m.id,
                fromMe: m.fromMe,
                senderName: m.senderName,
                bodyText: m.bodyText,
                isMedia: m.isMedia,
                messageType: m.messageType,
                messageAt: m.messageAt?.toISO(),
            })),
        });
    }

    async send({ params, request, response, auth }) {
        if (!request.ajax()) {
            return response.badRequest('Invalid request.');
        }

        const device = await this.getUserDevice(params.deviceId, auth);
        if (!device) {
            return response.notFound({ message: 'Device not found.' });
        }

        try {
            const { chat, message } = await request.validateUsing(vine.compile(vine.object({
                chat: vine.string().trim().minLength(5),
                message: vine.string().trim().minLength(1).maxLength(4096),
            })));

            const result = await MessageSender.send(device, chat, 'text', { message });
            if (!result.ok) {
                return response.unprocessableEntity({ message: result.error });
            }

            return response.ok({ message: 'Pesan terkirim', data: { to: result.to } });
        }
        catch (error) {
            if (error instanceof errors.E_VALIDATION_ERROR) {
                return response.unprocessableEntity({
                    message: error.messages[0]?.message,
                });
            }
            return response.internalServerError({ message: 'Gagal mengirim pesan.' });
        }
    }

    async getUserDevice(deviceId, auth) {
        return Device.query()
            .where('id', deviceId)
            .andWhere('user_id', auth.use('web').user.id)
            .first();
    }
}
