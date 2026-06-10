import Device from '#models/device';
import vine, { errors as vineErrors } from '@vinejs/vine';
import WASocketManager from '#wa/whatsapp';
import DeviceAccessToken from '#models/device_access_token';
import crypto from 'node:crypto';
import db from '@adonisjs/lucid/services/db';
import CacheService from '#services/cache';
import { parsePhoneNumberWithError, ParseError as PhoneNumberParseException, } from 'libphonenumber-js';
export default class DevicesController {
    async index({ view, auth }) {
        const queryDevice = await Device.query()
            .where('user_id', auth.use('web').user.id)
            .orderBy('id', 'asc');
        const devices = queryDevice.map((device) => {
            return {
                ...device.serialize(),
                status: WASocketManager.SESSION_STATUS.get(device.id + '-' + device.number) || 'disconnected',
            };
        });
        return view.render('device/index', { devices });
    }
    async create({ request, response, auth }) {
        if (!request.ajax()) {
            return response.badRequest('Invalid request.');
        }
        try {
            const { name, number } = await request.validateUsing(vine.compile(vine.object({
                name: vine.string().trim().maxLength(20),
                number: vine.string().trim().maxLength(20).unique({
                    table: 'devices',
                    column: 'number',
                }),
            })));
            const phoneNumber = parsePhoneNumberWithError('+' + number);
            if (!phoneNumber || !phoneNumber.isValid()) {
                return response.unprocessableEntity({ message: 'Please enter a valid phone number.' });
            }
            const trx = await db.transaction();
            try {
                const device = await Device.create({
                    name,
                    number,
                    userId: auth.use('web').user.id,
                }, { client: trx });
                await DeviceAccessToken.create({
                    deviceId: device.id,
                    token: crypto.randomBytes(32).toString('hex'),
                }, { client: trx });
                await trx.commit();
                return response.ok({ message: 'Device created successfully', data: device });
            }
            catch (error) {
                await trx.rollback();
                throw error;
            }
        }
        catch (error) {
            if (error instanceof PhoneNumberParseException) {
                let message = 'Please enter a valid phone number.';
                if (error.message === 'TOO_SHORT') {
                    message = 'Phone number is too short.';
                }
                else if (error.message === 'INVALID_COUNTRY') {
                    message = 'The number must start with the country code.';
                }
                return response.unprocessableEntity({ message });
            }
            if (error instanceof vineErrors.E_VALIDATION_ERROR) {
                return response.unprocessableEntity({
                    message: error.messages[0]?.message,
                    errors: error.messages,
                });
            }
            return response.internalServerError({ message: 'An unexpected error occurred.' });
        }
    }
    async show({ params, view, auth }) {
        const device = await Device.query()
            .where('id', params.id)
            .andWhere('user_id', auth.use('web').user.id)
            .firstOrFail();
        const accessToken = await device.related('accessTokens').query().first();
        return view.render('device/show', { device, token: accessToken?.token });
    }
    async resetToken({ params, auth, request, response }) {
        if (!request.ajax()) {
            return response.badRequest('Invalid request.');
        }
        const device = await Device.query()
            .where('id', params.id)
            .andWhere('user_id', auth.use('web').user.id)
            .first();
        if (!device) {
            return response.notFound({ message: 'Device not found.' });
        }
        const newToken = crypto.randomBytes(32).toString('hex');
        const accessToken = await device.related('accessTokens').query().first();
        if (accessToken) {
            CacheService.delete(`${device.id}`);
            accessToken.token = newToken;
            await accessToken.save();
        }
        else {
            await device.related('accessTokens').create({ token: newToken });
        }
        return response.ok({ message: 'Token reset successfully', data: { token: newToken } });
    }
    async updateWebhook({ params, auth, request, response }) {
        if (!request.ajax()) {
            return response.badRequest('Invalid request.');
        }
        try {
            const { webhook } = await request.validateUsing(vine.compile(vine.object({
                webhook: vine.string().url({ require_tld: false }).nullable().optional(),
            })));
            const device = await Device.query()
                .where('id', params.id)
                .andWhere('user_id', auth.use('web').user.id)
                .first();
            if (!device) {
                return response.notFound({ message: 'Device not found.' });
            }
            CacheService.delete(`${device.id}`);
            device.webhook = webhook || null;
            await device.save();
            return response.ok({
                message: 'Webhook updated successfully',
                data: { webhook: device.webhook },
            });
        }
        catch (error) {
            if (error instanceof vineErrors.E_VALIDATION_ERROR) {
                return response.unprocessableEntity({
                    message: error.messages[0]?.message,
                    errors: error.messages,
                });
            }
            console.error(error);
            return response.internalServerError({ message: 'An unexpected error occurred.' });
        }
    }
    async destroy({ params, auth, request, response }) {
        if (!request.ajax()) {
            return response.badRequest('Invalid request.');
        }
        try {
            const device = await Device.query()
                .where('user_id', auth.use('web').user.id)
                .andWhere('id', params.id)
                .firstOrFail();
            await device.delete();
            return response.ok({ message: 'Device deleted successfully' });
        }
        catch (error) {
            return response.internalServerError({ message: 'An unexpected error occurred.' });
        }
    }
}
//# sourceMappingURL=devices_controller.js.map