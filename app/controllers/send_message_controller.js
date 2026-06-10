import Device from '#models/device';
import WASocketManager from '#wa/whatsapp';

export default class SendMessageController {
    async index({ view, auth }) {
        const queryDevice = await Device.query()
            .where('user_id', auth.use('web').user.id)
            .preload('accessTokens')
            .orderBy('id', 'asc');
        const devices = queryDevice.map((device) => ({
            id: device.id,
            name: device.name,
            number: device.number,
            token: device.accessTokens[0]?.token || null,
            status: WASocketManager.SESSION_STATUS.get(`${device.id}-${device.number}`) || 'disconnected',
        }));
        return view.render('send_message/index', { devices });
    }
}
