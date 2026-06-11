import ScheduledMessage from '#models/scheduled_message';
import Device from '#models/device';
import vine, { errors } from '@vinejs/vine';
import { DateTime } from 'luxon';
import { buildMessagePayload, detectMessageType } from '#services/scheduled_message_helper';

const tokenValidator = vine.compile(vine.object({
    token: vine.union([
        vine.union.if((value) => Array.isArray(value), vine.array(vine.string())),
        vine.union.else(vine.string()),
    ]),
    to: vine.string(),
    scheduledAt: vine.string(),
    message: vine.string().minLength(1).optional(),
    image: vine.string().url().optional(),
    video: vine.string().url().optional(),
    document: vine.string().url().optional(),
    caption: vine.string().optional(),
    filename: vine.string().optional(),
    latitude: vine.number().optional(),
    longitude: vine.number().optional(),
}));

export default class ScheduledMessageApiController {
    async store({ request, response }) {
        try {
            const body = await request.validateUsing(tokenValidator);
            const messageType = detectMessageType(body);
            if (!messageType) {
                return response.unprocessableEntity({ message: 'No valid message type provided.' });
            }

            const scheduledAt = DateTime.fromISO(body.scheduledAt);
            if (!scheduledAt.isValid || scheduledAt <= DateTime.now()) {
                return response.unprocessableEntity({ message: 'scheduledAt must be a future datetime (ISO 8601).' });
            }

            const device = await this.getDeviceByToken(body.token);
            if (!device) {
                return response.notFound({ message: 'Device not found for the provided token.' });
            }

            const payload = buildMessagePayload(messageType, body);
            const scheduled = await ScheduledMessage.create({
                userId: device.userId,
                deviceId: device.id,
                to: body.to,
                messageType,
                payload,
                scheduledAt,
                status: 'pending',
            });

            return response.ok({
                message: 'Message scheduled successfully',
                data: {
                    id: scheduled.id,
                    scheduledAt: scheduled.scheduledAt.toISO(),
                    status: scheduled.status,
                },
            });
        }
        catch (error) {
            return this.handleError(error, response);
        }
    }

    async getDeviceByToken(token) {
        const tokenArray = typeof token === 'string' ? token.split(',') : token;
        return Device.query()
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
