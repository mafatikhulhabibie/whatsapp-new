export function detectMessageType(body) {
    if (body?.message) {
        return 'text';
    }
    if (body?.image) {
        return 'image';
    }
    if (body?.video) {
        return 'video';
    }
    if (body?.document) {
        return 'document';
    }
    if (body?.latitude !== undefined && body?.longitude !== undefined) {
        return 'location';
    }
    return null;
}

export function buildMessagePayload(messageType, body) {
    switch (messageType) {
        case 'text':
            return { message: body.message };
        case 'image':
            return {
                image: body.image,
                ...(body.caption ? { caption: body.caption } : {}),
            };
        case 'video':
            return {
                video: body.video,
                ...(body.caption ? { caption: body.caption } : {}),
            };
        case 'document':
            return {
                document: body.document,
                ...(body.filename ? { filename: body.filename } : {}),
            };
        case 'location':
            return {
                latitude: Number(body.latitude),
                longitude: Number(body.longitude),
            };
        default:
            return null;
    }
}

export function messagePreview(messageType, payload) {
    switch (messageType) {
        case 'text':
            return payload.message;
        case 'image':
            return payload.caption || payload.image;
        case 'video':
            return payload.caption || payload.video;
        case 'document':
            return payload.filename || payload.document;
        case 'location':
            return `${payload.latitude}, ${payload.longitude}`;
        default:
            return '-';
    }
}
