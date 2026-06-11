import ChatConversation from '#models/chat_conversation';
import ChatMessage from '#models/chat_message';
import WASocketManager from '#wa/whatsapp';
import { DateTime } from 'luxon';

export default class ChatMessageStore {
    static previewText(serialized) {
        if (serialized.msg?.rawText) {
            return serialized.msg.rawText.slice(0, 200);
        }
        if (serialized.flags?.isImage) {
            return serialized.msg?.rawText || '[Gambar]';
        }
        if (serialized.flags?.isVideo) {
            return serialized.msg?.rawText || '[Video]';
        }
        if (serialized.flags?.isAudio) {
            return '[Audio]';
        }
        if (serialized.flags?.isDocument) {
            return '[Dokumen]';
        }
        if (serialized.flags?.isSticker) {
            return '[Sticker]';
        }
        if (serialized.flags?.isMedia) {
            return `[${serialized.msg?.mtype || 'Media'}]`;
        }
        return '';
    }

    static contactLabel(serialized) {
        if (serialized.flags?.isGroup) {
            return serialized.chat?.split('@')[0] || 'Grup';
        }
        if (serialized.fromMe) {
            return serialized.chat?.split('@')[0] || 'Kontak';
        }
        const name = serialized.sender?.pushName;
        const phone = serialized.sender?.pn?.split('@')[0] || serialized.chat?.split('@')[0];
        return name || phone || 'Kontak';
    }

    static toSocketPayload(message, conversation) {
        return {
            id: message.id,
            conversationId: conversation.id,
            chatJid: message.chatJid,
            fromMe: message.fromMe,
            senderName: message.senderName,
            bodyText: message.bodyText,
            isMedia: message.isMedia,
            messageType: message.messageType,
            messageAt: message.messageAt?.toISO?.() || message.messageAt,
            conversation: {
                id: conversation.id,
                name: conversation.name,
                chatJid: conversation.chatJid,
                lastMessagePreview: conversation.lastMessagePreview,
                lastMessageAt: conversation.lastMessageAt?.toISO?.() || conversation.lastMessageAt,
                unreadCount: conversation.unreadCount,
            },
        };
    }

    static async saveFromSerialized(sessionId, rawMessage, serialized) {
        if (!serialized?.key?.id || !serialized.chat) {
            return null;
        }

        const deviceId = Number.parseInt(sessionId.split('-')[0], 10);
        if (!deviceId) {
            return null;
        }

        const waMessageId = serialized.key.id;
        const exists = await ChatMessage.query()
            .where('device_id', deviceId)
            .andWhere('wa_message_id', waMessageId)
            .first();
        if (exists) {
            return exists;
        }

        const messageAt = rawMessage.messageTimestamp
            ? DateTime.fromSeconds(Number(rawMessage.messageTimestamp))
            : DateTime.now();

        const preview = this.previewText(serialized);
        const contactName = this.contactLabel(serialized);

        let conversation = await ChatConversation.query()
            .where('device_id', deviceId)
            .andWhere('chat_jid', serialized.chat)
            .first();

        if (!conversation) {
            conversation = await ChatConversation.create({
                deviceId,
                chatJid: serialized.chat,
                isGroup: serialized.flags?.isGroup || false,
                name: contactName,
                lastMessagePreview: preview,
                lastMessageAt: messageAt,
                unreadCount: serialized.fromMe ? 0 : 1,
            });
        }
        else {
            conversation.name = contactName || conversation.name;
            conversation.lastMessagePreview = preview;
            conversation.lastMessageAt = messageAt;
            if (!serialized.fromMe) {
                conversation.unreadCount += 1;
            }
            await conversation.save();
        }

        const message = await ChatMessage.create({
            deviceId,
            conversationId: conversation.id,
            waMessageId,
            fromMe: serialized.fromMe || false,
            chatJid: serialized.chat,
            senderJid: serialized.sender?.pn || serialized.sender?.id || null,
            senderName: serialized.sender?.pushName || null,
            messageType: serialized.msg?.mtype || null,
            bodyText: preview,
            isMedia: serialized.flags?.isMedia || false,
            messageAt,
        });

        WASocketManager.WebSocketEmit(sessionId, 'chat:message', this.toSocketPayload(message, conversation));

        return message;
    }
}
