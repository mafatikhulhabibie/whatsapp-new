import vine, { errors } from '@vinejs/vine';
import WASocketManager from '#wa/whatsapp';
import Device from '#models/device';

const tokenValidator = vine.compile(vine.object({
    token: vine.union([
        vine.union.if((value) => Array.isArray(value), vine.array(vine.string())),
        vine.union.else(vine.string()),
    ]),
}));

const startValidator = vine.compile(vine.object({
    token: vine.union([
        vine.union.if((value) => Array.isArray(value), vine.array(vine.string())),
        vine.union.else(vine.string()),
    ]),
    usePairingCode: vine.boolean().optional(),
}));

export default class DeviceController {
    async status({ request, response }) {
        try {
            const { token } = await this.validateToken(request);
            const device = await this.getDeviceByToken(token);
            if (!device) {
                return response.notFound({ message: 'Device not found for the provided token.' });
            }
            return response.ok({
                message: 'Device status fetched successfully',
                data: this.buildStatusPayload(device),
            });
        }
        catch (error) {
            return this.handleError(error, response);
        }
    }
    async start({ request, response }) {
        try {
            const { token, usePairingCode } = await request.validateUsing(startValidator);
            const device = await this.getDeviceByToken(token);
            if (!device) {
                return response.notFound({ message: 'Device not found for the provided token.' });
            }
            const sessionId = this.getSessionId(device);
            const status = WASocketManager.SESSION_STATUS.get(sessionId) || 'disconnected';
            if (status === 'connected') {
                return response.ok({
                    message: 'Device is already connected',
                    data: this.buildStatusPayload(device),
                });
            }
            if (WASocketManager.SESSIONS.has(sessionId)) {
                return response.conflict({
                    message: 'Session already active. Stop or logout first before starting a new connection.',
                    data: this.buildStatusPayload(device),
                });
            }
            await WASocketManager.initSession({
                sessionId,
                usePairingCode: usePairingCode ?? false,
            });
            return response.ok({
                message: usePairingCode
                    ? 'Pairing session started. Poll /api/device/status for the pairing code.'
                    : 'QR session started. Poll /api/device/status for the QR code.',
                data: this.buildStatusPayload(device),
            });
        }
        catch (error) {
            return this.handleError(error, response);
        }
    }
    async stop({ request, response }) {
        try {
            const { token } = await request.validateUsing(tokenValidator);
            const device = await this.getDeviceByToken(token);
            if (!device) {
                return response.notFound({ message: 'Device not found for the provided token.' });
            }
            const sessionId = this.getSessionId(device);
            if (!WASocketManager.SESSIONS.has(sessionId)) {
                return response.unprocessableEntity({
                    message: 'No active session found for this device.',
                    data: this.buildStatusPayload(device),
                });
            }
            await WASocketManager.stopSession(sessionId);
            WASocketManager.emitDeviceStatus(sessionId, {
                id: sessionId,
                type: 'connection:stopped',
                message: 'Session stopped.',
            });
            return response.ok({
                message: 'Session stopped successfully',
                data: this.buildStatusPayload(device),
            });
        }
        catch (error) {
            return this.handleError(error, response);
        }
    }
    async logout({ request, response }) {
        try {
            const { token } = await request.validateUsing(tokenValidator);
            const device = await this.getDeviceByToken(token);
            if (!device) {
                return response.notFound({ message: 'Device not found for the provided token.' });
            }
            const sessionId = this.getSessionId(device);
            if (WASocketManager.SESSIONS.has(sessionId)) {
                await WASocketManager.removeSession(sessionId);
            }
            else {
                await WASocketManager.resetAuthState(sessionId);
            }
            return response.ok({
                message: 'Device logged out successfully',
                data: this.buildStatusPayload(device),
            });
        }
        catch (error) {
            return this.handleError(error, response);
        }
    }
    async validateToken(request) {
        return request.validateUsing(tokenValidator);
    }
    getSessionId(device) {
        return `${device.id}-${device.number}`;
    }
    buildStatusPayload(device) {
        const sessionId = this.getSessionId(device);
        const status = WASocketManager.SESSION_STATUS.get(sessionId) || 'disconnected';
        const connectData = WASocketManager.getConnectData(sessionId);
        const connection = connectData
            ? {
                type: connectData.type,
                message: connectData.message,
                qr: connectData.data?.qr ?? null,
                pairingCode: connectData.data?.code ?? null,
                timeout: connectData.data?.timeout ?? null,
                updatedAt: connectData.updatedAt ?? null,
            }
            : null;
        return {
            device: {
                id: device.id,
                name: device.name,
                number: device.number,
                token: device.accessTokens?.[0]?.token ?? null,
            },
            status,
            connection,
        };
    }
    async getDeviceByToken(token) {
        const tokenArray = typeof token === 'string' ? token.split(',') : token;
        return Device.query()
            .preload('accessTokens')
            .whereHas('accessTokens', (query) => {
            query.whereIn('token', tokenArray);
        })
            .first();
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
