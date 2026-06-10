import { normalizeMessageContent, jidNormalizedUser, isJidGroup, getContentType, isPnUser, isLidUser, } from 'baileys';
import CacheService from '#services/cache';
import Device from '#models/device';
const MEDIA_TYPE = [
    'imageMessage',
    'videoMessage',
    'audioMessage',
    'documentMessage',
    'stickerMessage',
];
export default async function ({ id, sock, WAMessage }) {
    const normalizedMessages = {
        ...WAMessage,
        message: normalizeMessageContent(WAMessage.message),
    };
    const { key, message, broadcast, ...messages } = normalizedMessages;
    const chat = jidNormalizedUser(key.remoteJid || key.remoteJidAlt);
    const botPn = jidNormalizedUser(isPnUser(sock.user.id) ? sock.user.id : sock.user.phoneNumber);
    const botLid = jidNormalizedUser(isLidUser(sock.user.id) ? sock.user.id : sock.user.lid);
    const isGroup = isJidGroup(chat) || false;
    const groupMetadata = isGroup ? await sock.getGroupCache(chat) : null;
    const senderLid = decodeSender(key, 'lid');
    const senderPn = decodeSender(key, 'pn');
    const sender = key.addressingMode === 'lid' ? senderLid : senderPn;
    const mtype = getContentType(message);
    const text = getTextMessage(message);
    const quoted = getQuoted({ key, mtype, message, sock });
    let cacheDevice = await CacheService.get(id.split('-')[0]);
    if (!cacheDevice) {
        const device = await Device.query()
            .preload('accessTokens')
            .where('id', id.split('-')[0])
            .first();
        await CacheService.set(id.split('-')[0], device?.toJSON());
        cacheDevice = device?.toJSON();
    }
    if (typeof cacheDevice === 'string') {
        cacheDevice = JSON.parse(cacheDevice);
    }
    const ctx = {
        key,
        chat,
        fromMe: key.fromMe,
        token: cacheDevice?.accessTokens[0]?.token || null,
        webhook: cacheDevice?.webhook || null,
        flags: {
            fromMe: key.fromMe,
            isGroup,
            isText: mtype === 'conversation' || mtype === 'extendedTextMessage',
            isSticker: mtype === 'stickerMessage',
            isImage: mtype === 'imageMessage',
            isVideo: mtype === 'videoMessage',
            isAudio: mtype === 'audioMessage',
            isDocument: mtype === 'documentMessage',
            isMedia: MEDIA_TYPE.includes(mtype),
        },
        bot: {
            session: id,
            id: botLid || botPn,
            lid: botLid,
            pn: botPn,
        },
        sender: {
            pushName: messages?.pushName || messages?.verifiedBizName || undefined,
            id: senderLid || senderPn,
            lid: senderLid,
            pn: senderPn,
        },
        permissions: {
            sender: {
                superAdmin: isGroup ? IsSender(sender, groupMetadata.participants, ['superadmin']) : false,
                admin: isGroup
                    ? IsSender(sender, groupMetadata.participants, ['superadmin', 'admin'])
                    : false,
            },
            bot: {
                superAdmin: isGroup
                    ? IsSender(groupMetadata.addressingMode === 'lid' ? botLid : botPn, groupMetadata.participants, ['superadmin'])
                    : false,
                botAdmin: isGroup
                    ? IsSender(groupMetadata.addressingMode === 'lid' ? botLid : botPn, groupMetadata.participants, ['superadmin', 'admin'])
                    : false,
            },
        },
        msg: {
            mtype,
            rawText: text,
            command: text.split(' ')[0].trim(),
            argsText: text.replace(text.split(' ')[0].trim(), '').trim(),
            args: text.replace(text.split(' ')[0].trim(), '').trim().split(' '),
            mentionedJid: message[mtype]?.contextInfo?.mentionedJid || [],
            expiration: message[mtype]?.contextInfo?.expiration || 0,
        },
        message,
        quoted,
    };
    return ctx;
}
const decodeSender = (key, type) => {
    let sender;
    if (isJidGroup(key.remoteJid)) {
        if (type === 'lid') {
            sender = key.addressingMode === 'lid' ? key.participant : key.participantAlt;
        }
        else if (type === 'pn') {
            sender = key.addressingMode === 'pn' ? key.participant : key.participantAlt;
        }
    }
    else {
        if (type === 'lid') {
            sender = key.addressingMode === 'lid' ? key.remoteJid : key.remoteJidAlt;
        }
        else if (type === 'pn') {
            sender = key.addressingMode === 'pn' ? key.remoteJid : key.remoteJidAlt;
        }
    }
    return sender ? jidNormalizedUser(sender) : undefined;
};
const IsSender = (pnOrLid, participants, admin) => {
    return participants.some((participant) => {
        return ((pnOrLid === jidNormalizedUser(participant.id) ||
            pnOrLid === jidNormalizedUser(participant.lid) ||
            pnOrLid === jidNormalizedUser(participant.phoneNumber)) &&
            admin.includes(participant.admin));
    });
};
const getTextMessage = (message) => {
    return (message?.conversation ||
        message?.extendedTextMessage?.text ||
        message?.imageMessage?.caption ||
        message?.videoMessage?.caption ||
        message?.documentMessage?.caption ||
        message?.documentWithCaptionMessage?.message?.documentMessage?.caption ||
        message?.ephemeralMessage?.message?.conversation ||
        message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
        message?.ephemeralMessage?.message?.imageMessage?.caption ||
        message?.ephemeralMessage?.message?.videoMessage?.caption ||
        message?.ephemeralMessage?.message?.documentWithCaptionMessage?.message?.documentMessage
            ?.caption ||
        message?.editedMessage?.message?.protocolMessage?.editedMessage?.conversation ||
        message?.editedMessage?.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text ||
        '');
};
const getQuoted = ({ key, mtype, message, sock, }) => {
    const Quoted = message[mtype]?.contextInfo?.quotedMessage;
    if (!Quoted)
        return undefined;
    const contextInfo = message[mtype]?.contextInfo;
    const quotedMessage = normalizeMessageContent(Quoted);
    const type = getContentType(quotedMessage);
    if (!type)
        return undefined;
    const text = getTextMessage(quotedMessage);
    const isGroup = isJidGroup(key.remoteJid);
    const keyQuoted = {
        remoteJid: isGroup ? key.remoteJid : contextInfo.participant,
        remoteJidAlt: isGroup ? key.remoteJidAlt : undefined,
        fromMe: contextInfo.participant === jidNormalizedUser(sock?.user?.id) ||
            contextInfo.participant === jidNormalizedUser(sock?.user?.lid),
        id: contextInfo.stanzaId,
        participant: isGroup ? contextInfo.participant : undefined,
        participantAlt: undefined,
        addressingMode: key.addressingMode,
    };
    return {
        key: keyQuoted,
        chat: keyQuoted.remoteJid,
        fromMe: keyQuoted.fromMe,
        flags: {
            fromMe: keyQuoted.fromMe,
            isGroup,
            isText: type === 'conversation' || type === 'extendedTextMessage',
            isSticker: type === 'stickerMessage',
            isImage: type === 'imageMessage',
            isVideo: type === 'videoMessage',
            isAudio: type === 'audioMessage',
            isDocument: type === 'documentMessage',
            isMedia: MEDIA_TYPE.includes(type),
        },
        sender: {
            lid: decodeSender(keyQuoted, 'lid'),
            pn: decodeSender(keyQuoted, 'pn'),
        },
        msg: {
            mtype: type,
            rawText: text,
            command: text.split(' ')[0].trim(),
            argsText: text.replace(text.split(' ')[0].trim(), '').trim(),
            args: text.replace(text.split(' ')[0].trim(), '').trim().split(' '),
            mentionedJid: contextInfo.mentionedJid,
            expiration: contextInfo?.expiration || 0,
        },
        message: quotedMessage,
    };
};
//# sourceMappingURL=serialize.js.map