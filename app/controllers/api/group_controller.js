import vine, { errors } from '@vinejs/vine';
import WASocketManager from '#wa/whatsapp';
import Device from '#models/device';
const tokenValidator = vine.compile(vine.object({
    token: vine.union([
        vine.union.if((value) => Array.isArray(value), vine.array(vine.string())),
        vine.union.else(vine.string()),
    ]),
}));
export default class GroupController {
    async index({ request, response }) {
        try {
            const { token } = await request.validateUsing(tokenValidator);
            const selectedDevice = await this.getActiveDevice(token);
            if (!selectedDevice) {
                return response.unprocessableEntity({
                    message: 'No active devices found for the provided tokens.',
                });
            }
            const sock = this.getSocket(selectedDevice);
            const groups = await sock.groupFetchAllParticipating();
            return response.ok({
                message: 'Groups fetched successfully',
                data: Object.values(groups)?.map((group) => {
                    return {
                        id: group.id,
                        subject: group.subject,
                        ephemeralDuration: group.ephemeralDuration || 0,
                    };
                }) || [],
            });
        }
        catch (error) {
            return this.handleError(error, response);
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
//# sourceMappingURL=group_controller.js.map