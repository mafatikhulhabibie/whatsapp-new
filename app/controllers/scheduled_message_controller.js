import ScheduledMessage from '#models/scheduled_message';
import Device from '#models/device';
import vine, { errors } from '@vinejs/vine';
import { DateTime } from 'luxon';
import { buildMessagePayload, detectMessageType, messagePreview } from '#services/scheduled_message_helper';

const scheduleValidator = vine.compile(vine.object({
    deviceId: vine.number(),
    to: vine.string().trim().minLength(5),
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

export default class ScheduledMessageController {
    async index({ view, auth }) {
        const messages = await ScheduledMessage.query()
            .where('user_id', auth.use('web').user.id)
            .preload('device')
            .orderBy('scheduled_at', 'desc')
            .limit(100);

        const items = messages.map((item) => ({
            ...item.serialize(),
            preview: messagePreview(item.messageType, item.payload),
            deviceName: item.device?.name || '-',
            scheduledAtLabel: item.scheduledAt.toFormat('dd/MM/yyyy HH:mm'),
        }));

        return view.render('scheduled_message/index', { messages: items });
    }

    async store({ request, response, auth }) {
        if (!request.ajax()) {
            return response.badRequest('Invalid request.');
        }
        try {
            const body = await request.validateUsing(scheduleValidator);
            const messageType = detectMessageType(body);
            if (!messageType) {
                return response.unprocessableEntity({ message: 'Isi pesan tidak valid.' });
            }

            const scheduledAt = DateTime.fromISO(body.scheduledAt);
            if (!scheduledAt.isValid || scheduledAt <= DateTime.now()) {
                return response.unprocessableEntity({ message: 'Waktu jadwal harus di masa depan.' });
            }

            const device = await Device.query()
                .where('id', body.deviceId)
                .andWhere('user_id', auth.use('web').user.id)
                .first();
            if (!device) {
                return response.notFound({ message: 'Device tidak ditemukan.' });
            }

            const payload = buildMessagePayload(messageType, body);
            const scheduled = await ScheduledMessage.create({
                userId: auth.use('web').user.id,
                deviceId: device.id,
                to: body.to,
                messageType,
                payload,
                scheduledAt,
                status: 'pending',
            });

            return response.ok({
                message: 'Pesan berhasil dijadwalkan',
                data: {
                    id: scheduled.id,
                    scheduledAt: scheduled.scheduledAt.toISO(),
                },
            });
        }
        catch (error) {
            return this.handleError(error, response);
        }
    }

    async destroy({ params, auth, request, response }) {
        if (!request.ajax()) {
            return response.badRequest('Invalid request.');
        }
        try {
            const scheduled = await ScheduledMessage.query()
                .where('id', params.id)
                .andWhere('user_id', auth.use('web').user.id)
                .first();
            if (!scheduled) {
                return response.notFound({ message: 'Jadwal pesan tidak ditemukan.' });
            }
            if (scheduled.status !== 'pending') {
                return response.unprocessableEntity({ message: 'Hanya pesan pending yang bisa dibatalkan.' });
            }
            scheduled.status = 'cancelled';
            await scheduled.save();
            return response.ok({ message: 'Jadwal pesan dibatalkan' });
        }
        catch (error) {
            return this.handleError(error, response);
        }
    }

    handleError(error, response) {
        if (error instanceof errors.E_VALIDATION_ERROR) {
            return response.unprocessableEntity({
                message: error.messages[0]?.message,
                errors: error.messages,
            });
        }
        console.error(error);
        return response.internalServerError({ message: 'An unexpected error occurred.' });
    }
}
