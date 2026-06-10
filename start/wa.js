import app from '@adonisjs/core/services/app';
import WASocketManager from '#wa/whatsapp';
import ws from '#services/ws';
import User from '#models/user';
import Device from '#models/device';
import consola from 'consola';
app.ready(async () => {
    if (process.argv.some((arg) => arg.includes('ace')))
        return;
    const as = await WASocketManager.autoStart();
    consola.info(as?.message);
    ws.boot();
    const io = ws.io;
    io?.of('wa').use(async (socket, next) => {
        try {
            const userId = socket.handshake.auth.userId;
            const wsToken = socket.handshake.auth.wsToken;
            if (!userId || !wsToken) {
                return next(new Error('WebSocket userId or wsToken required'));
            }
            const user = await User.query().where('id', userId).first();
            if (!user) {
                return next(new Error('User not found'));
            }
            if (!(user.wsToken === wsToken)) {
                console.log('Invalid WebSocket token');
                return next(new Error('Invalid WebSocket token'));
            }
            socket.user = user;
            socket.wsToken = wsToken;
            socket.join(`${user.id}-${user.wsToken}`);
            next();
        }
        catch (error) {
            next(new Error('Authentication failed'));
        }
    });
    io?.of('wa').on('connection', (socket) => {
        socket.on('device:init', async (data, callback) => {
            try {
                if (typeof callback !== 'function') {
                    throw new Error('Callback function required');
                }
                if (!data.deviceId) {
                    return callback({ type: 'DEVICE_ID_REQUIRED', message: 'Device id required.' });
                }
                const device = await Device.query()
                    .where('id', data.deviceId)
                    .andWhere('user_id', socket.user.id)
                    .first();
                if (!device) {
                    return callback({ type: 'DEVICE_NOT_FOUND', message: 'Device not found.' });
                }
                const sessionId = device.id + '-' + device.number;
                socket.sessionId = sessionId;
                if (!WASocketManager.WEB_SOCKET.has(sessionId)) {
                    WASocketManager.WEB_SOCKET.set(sessionId, new Set());
                }
                WASocketManager.WEB_SOCKET.get(sessionId).add(socket);
                return callback(null, {
                    type: 'DEVICE_INITIALIZED',
                    message: 'Device initialized.',
                    data: {
                        device,
                        session: {
                            status: WASocketManager.SESSION_STATUS.get(sessionId) || 'disconnected',
                        },
                    },
                });
            }
            catch (error) {
                return callback({ type: 'ERROR', message: error.message });
            }
        });
        socket.on('device:start', async (data) => {
            if (!socket.sessionId)
                return;
            await WASocketManager.initSession({
                sessionId: socket.sessionId,
                usePairingCode: data.usePairingCode,
            });
        });
        socket.on('device:logout', async () => {
            if (!socket.sessionId)
                return;
            let message = '';
            try {
                await WASocketManager.removeSession(socket.sessionId);
                message = 'Logout successful.';
            }
            catch (error) {
                message = error.message;
            }
            const sockets = WASocketManager.WEB_SOCKET.get(socket.sessionId);
            if (sockets) {
                sockets.forEach((s) => s.emit('device:status', {
                    id: socket.sessionId,
                    type: 'connection:logout',
                    message: message,
                }));
            }
            consola.info(`[WA: ${socket.sessionId}] ${message}`);
        });
        socket.on('device:stop', async () => {
            if (!socket.sessionId)
                return;
            let message = '';
            try {
                await WASocketManager.stopSession(socket.sessionId);
                message = 'Session stopped.';
            }
            catch (error) {
                message = error.message;
            }
            const sockets = WASocketManager.WEB_SOCKET.get(socket.sessionId);
            if (sockets) {
                sockets.forEach((s) => s.emit('device:status', {
                    id: socket.sessionId,
                    type: 'connection:stopped',
                    message: message,
                }));
            }
            consola.info(`[WA: ${socket.sessionId}] ${message}`);
        });
        socket.on('disconnect', () => {
            if (socket.sessionId) {
                const sockets = WASocketManager.WEB_SOCKET.get(socket.sessionId);
                if (sockets) {
                    sockets.delete(socket);
                    if (sockets.size === 0) {
                        WASocketManager.WEB_SOCKET.delete(socket.sessionId);
                    }
                }
            }
        });
    });
    process.on('SIGTERM', async () => {
        consola.info('Received SIGTERM, shutting down gracefully...');
        await WASocketManager.shutdown();
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        consola.info('Received SIGINT, shutting down gracefully...');
        await WASocketManager.shutdown();
        process.exit(0);
    });
});
//# sourceMappingURL=wa.js.map