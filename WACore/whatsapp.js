import { makeWASocket, makeCacheableSignalKeyStore, DisconnectReason, isJidBroadcast, isJidNewsletter, isJidStatusBroadcast, fetchLatestWaWebVersion, isJidBot, isJidMetaAI, useMultiFileAuthState, } from 'baileys';
import { consola } from 'consola';
import pino from 'pino';
import QRCode from 'qrcode';
import useAdonisAuthState from '#wa/utils/use_adonis_usestate';
import DeviceAuth from '#models/device_auth';
import { LRUCache } from 'lru-cache';
import env from '#start/env';
import app from '@adonisjs/core/services/app';
import fs from 'node:fs';
import path from 'node:path';
import events from '#wa/event/index';
export class WASocketManager {
    MAX_RECONNECT_ATTEMPTS = 15;
    CONNECTION_TIMEOUT_SECONDS = 40;
    PAIRING_CODE_DELAY_SECONDS = 5;
    PATH_SESSION = app.tmpPath('whatsapp');
    DRIVER_AUTH_STATE = env.get('WA_AUTH_STATE');
    SESSIONS = new Map();
    SESSION_STATUS = new Map();
    SESSION_ATTEMPTS = new Map();
    SESSION_CONNECTION_TIMEOUTS = new Map();
    SESSION_PAIRING_TIMEOUTS = new Map();
    SESSION_LOCKS = new Map();
    WEB_SOCKET = new Map();
    groupCache;
    cachedWAVersion = null;
    constructor() {
        this.groupCache = new LRUCache({
            max: 100,
            ttl: 1000 * 60 * 60,
            allowStale: false,
            updateAgeOnGet: true,
        });
        if (!fs.existsSync(this.PATH_SESSION)) {
            fs.mkdirSync(this.PATH_SESSION, { recursive: true });
        }
    }
    async getWAVersion() {
        if (!this.cachedWAVersion) {
            this.cachedWAVersion = await fetchLatestWaWebVersion({});
            consola.success(`[WA] Version cached: ${this.cachedWAVersion.version.join('.')}`);
        }
        return this.cachedWAVersion;
    }
    clearAllTimeouts(id) {
        if (this.SESSION_CONNECTION_TIMEOUTS.has(id)) {
            clearTimeout(this.SESSION_CONNECTION_TIMEOUTS.get(id));
            this.SESSION_CONNECTION_TIMEOUTS.delete(id);
        }
        if (this.SESSION_PAIRING_TIMEOUTS.has(id)) {
            clearTimeout(this.SESSION_PAIRING_TIMEOUTS.get(id));
            this.SESSION_PAIRING_TIMEOUTS.delete(id);
        }
    }
    setConnectionTimeout(sessionId) {
        this.clearAllTimeouts(sessionId);
        const timeoutId = setTimeout(async () => {
            consola.warn(`[WA: ${sessionId}] Connection timeout (${this.CONNECTION_TIMEOUT_SECONDS} seconds). Destroying...`);
            this.WebSocketEmit(sessionId, 'device:status', {
                id: sessionId,
                type: 'connection:timeout',
                message: 'Connection timeout. Session destroyed automatically.',
            });
            try {
                await this.removeSession(sessionId);
                consola.info(`[WA: ${sessionId}] Session destroyed.`);
            }
            catch (error) {
                consola.error(`[WA: ${sessionId}] Error destroying session: ${error.message}`);
            }
        }, this.CONNECTION_TIMEOUT_SECONDS * 1000);
        this.SESSION_CONNECTION_TIMEOUTS.set(sessionId, timeoutId);
        consola.info(`[WA: ${sessionId}] Connection timeout set for ${this.CONNECTION_TIMEOUT_SECONDS} seconds.`);
    }
    WebSocketEmit(sessionId, key, data) {
        const sockets = this.WEB_SOCKET.get(sessionId);
        if (sockets && sockets.size > 0) {
            sockets.forEach((s) => {
                try {
                    s.emit(key, data);
                }
                catch (error) {
                    consola.error(`[WA: ${sessionId}] Error emitting to socket: ${error.message}`);
                }
            });
        }
    }
    async useAuthState(sessionId) {
        if (this.DRIVER_AUTH_STATE === 'database') {
            return await useAdonisAuthState({ session: sessionId });
        }
        else if (this.DRIVER_AUTH_STATE === 'file') {
            const removeCreds = async () => {
                fs.rmSync(path.join(this.PATH_SESSION, sessionId), { recursive: true, force: true });
            };
            return {
                ...(await useMultiFileAuthState(path.join(this.PATH_SESSION, sessionId))),
                removeCreds,
            };
        }
    }
    async clearGroupCache(sessionId) {
        for (const key of Array.from(this.groupCache.keys())) {
            if (key.startsWith(`${sessionId}:`)) {
                this.groupCache.delete(key);
            }
        }
    }
    setupGroupCache(sock, sessionId) {
        sock.setGroupCache = (groupId, metadata) => {
            const cacheKey = `${sessionId}:${groupId}`;
            this.groupCache.set(cacheKey, metadata);
        };
        sock.getGroupCache = async (groupId) => {
            const cacheKey = `${sessionId}:${groupId}`;
            if (this.groupCache.has(cacheKey)) {
                return this.groupCache.get(cacheKey);
            }
            try {
                const metadata = await sock.groupMetadata(groupId);
                this.groupCache.set(cacheKey, metadata);
                return metadata;
            }
            catch (error) {
                consola.error(`[WA: ${sessionId}] Error fetching group metadata: ${error.message}`);
                return undefined;
            }
        };
        sock.delGroupCache = (groupId) => {
            const cacheKey = `${sessionId}:${groupId}`;
            this.groupCache.delete(cacheKey);
        };
    }
    getSession(sessionId) {
        return this.SESSIONS.get(sessionId);
    }
    async initSession({ sessionId, usePairingCode = false, reconnecting = false, }) {
        if (this.SESSION_LOCKS.has(sessionId)) {
            consola.warn(`[WA: ${sessionId}] Session initialization already in progress`);
            return null;
        }
        if (this.SESSIONS.has(sessionId) && !reconnecting) {
            consola.info(`[WA: ${sessionId}] Session already exists`);
            return this.SESSIONS.get(sessionId);
        }
        this.SESSION_LOCKS.set(sessionId, true);
        try {
            if (reconnecting) {
                const currentAttempts = (this.SESSION_ATTEMPTS.get(sessionId) || 0) + 1;
                this.SESSION_ATTEMPTS.set(sessionId, currentAttempts);
                if (currentAttempts > this.MAX_RECONNECT_ATTEMPTS) {
                    consola.warn(`[WA: ${sessionId}] Max reconnect attempts reached`);
                    try {
                        await this.stopSession(sessionId);
                        consola.info(`[WA: ${sessionId}] Session stopped.`);
                    }
                    catch (error) {
                        consola.error(`[WA: ${sessionId}] Error stopping session: ${error?.message}`);
                    }
                    this.WebSocketEmit(sessionId, 'device:status', {
                        id: sessionId,
                        type: 'connection:max_reconnect_reached',
                        message: `Max reconnect attempts reached. Session stopped.`,
                    });
                    return null;
                }
                const oldSock = this.SESSIONS.get(sessionId);
                if (oldSock) {
                    try {
                        oldSock.ev?.removeAllListeners();
                        oldSock.end?.();
                    }
                    catch (error) {
                        consola.warn(`[WA: ${sessionId}] Error cleaning old socket: ${error?.message}`);
                    }
                }
                this.clearAllTimeouts(sessionId);
            }
            const [deviceId, deviceNumber] = sessionId.split('-');
            if (!deviceId) {
                consola.error(`[WA: ${sessionId}] Invalid device ID`);
                return null;
            }
            const { state, saveCreds } = await this.useAuthState(sessionId);
            const { version } = await this.getWAVersion();
            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
                },
                logger: pino({ level: 'silent' }),
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                defaultQueryTimeoutMs: undefined,
                shouldIgnoreJid: (jid) => isJidBroadcast(jid) ||
                    isJidNewsletter(jid) ||
                    isJidStatusBroadcast(jid) ||
                    isJidBot(jid) ||
                    isJidMetaAI(jid),
            });
            this.SESSIONS.set(sessionId, sock);
            this.SESSION_STATUS.set(sessionId, 'initializing');
            this.setupGroupCache(sock, sessionId);
            if (usePairingCode && !sock.authState.creds.registered && deviceNumber) {
                const pairingTimeoutId = setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(deviceNumber);
                        this.WebSocketEmit(sessionId, 'device:status', {
                            id: sessionId,
                            type: 'connection:pairing',
                            message: 'Pairing Code Received',
                            data: { code, timeout: this.CONNECTION_TIMEOUT_SECONDS },
                        });
                        consola.success(`[WA: ${sessionId}] Pairing Code: ${code}`);
                        this.setConnectionTimeout(sessionId);
                    }
                    catch (error) {
                        consola.error(`[WA: ${sessionId}] Error requesting pairing code: ${error.message}`);
                        this.WebSocketEmit(sessionId, 'device:status', {
                            id: sessionId,
                            type: 'connection:pairing_error',
                            message: 'Error requesting pairing code',
                        });
                    }
                    finally {
                        this.SESSION_PAIRING_TIMEOUTS.delete(sessionId);
                    }
                }, this.PAIRING_CODE_DELAY_SECONDS * 1000);
                this.SESSION_PAIRING_TIMEOUTS.set(sessionId, pairingTimeoutId);
            }
            sock.ev.process(async (BaileysEvents) => {
                if (BaileysEvents['connection.update']) {
                    try {
                        const update = BaileysEvents['connection.update'];
                        const { connection, lastDisconnect, qr } = update;
                        if (qr && usePairingCode === false) {
                            const qrDataURL = await QRCode.toDataURL(qr);
                            this.WebSocketEmit(sessionId, 'device:status', {
                                id: sessionId,
                                type: 'connection:qr',
                                message: 'QR Code Received',
                                data: { qr: qrDataURL, timeout: this.CONNECTION_TIMEOUT_SECONDS },
                            });
                            consola.success(`[WA: ${sessionId}] QR Code Received`);
                            this.setConnectionTimeout(sessionId);
                        }
                        if (connection === 'close') {
                            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                            if (shouldReconnect) {
                                this.SESSION_STATUS.set(sessionId, 'reconnecting');
                                consola.warn(`[WA: ${sessionId}] Connection closed, attempting reconnect...`);
                                this.WebSocketEmit(sessionId, 'device:status', {
                                    id: sessionId,
                                    type: 'connection:reconnecting',
                                    message: 'Reconnecting...',
                                });
                                setTimeout(() => {
                                    this.initSession({ sessionId, usePairingCode, reconnecting: true });
                                }, 5000);
                            }
                            else {
                                this.SESSION_STATUS.set(sessionId, 'disconnected');
                                consola.info(`[WA: ${sessionId}] Logged out, removing session`);
                                let message = '';
                                try {
                                    await this.removeSession(sessionId);
                                    message = 'Session removed';
                                }
                                catch (error) {
                                    message = `Error removing session: ${error.message}`;
                                }
                                this.WebSocketEmit(sessionId, 'device:status', {
                                    id: sessionId,
                                    type: 'connection:logout',
                                    message: message,
                                });
                            }
                        }
                        else if (connection === 'connecting') {
                            this.SESSION_STATUS.set(sessionId, 'connecting');
                            consola.info(`[WA: ${sessionId}] Connecting...`);
                            this.WebSocketEmit(sessionId, 'device:status', {
                                id: sessionId,
                                type: 'connection:connecting',
                                message: 'Connecting...',
                            });
                        }
                        else if (connection === 'open') {
                            this.SESSION_STATUS.set(sessionId, 'connected');
                            consola.success(`[WA: ${sessionId}] Connection Opened`);
                            this.WebSocketEmit(sessionId, 'device:status', {
                                id: sessionId,
                                type: 'connection:open',
                                message: 'Connected',
                            });
                            this.SESSION_ATTEMPTS.delete(sessionId);
                            this.clearAllTimeouts(sessionId);
                        }
                    }
                    catch (error) {
                        consola.error(`[WA: ${sessionId}] Connection Update Error: ${error.message}`);
                    }
                }
                if (BaileysEvents['creds.update']) {
                    await saveCreds();
                }
                events({
                    sessionId,
                    sock,
                    events: BaileysEvents,
                });
            });
            return sock;
        }
        catch (error) {
            consola.error(`[WA: ${sessionId}] Error initializing session: ${error.message}`);
            return null;
        }
        finally {
            this.SESSION_LOCKS.delete(sessionId);
        }
    }
    async stopSession(sessionId) {
        const sock = this.SESSIONS.get(sessionId);
        if (!sock) {
            throw new Error('Session not found.');
        }
        sock.ev?.removeAllListeners();
        sock.end?.();
        this.SESSIONS.delete(sessionId);
        this.SESSION_STATUS.set(sessionId, 'stopped');
        this.SESSION_ATTEMPTS.delete(sessionId);
        this.clearAllTimeouts(sessionId);
        this.clearGroupCache(sessionId);
    }
    async removeSession(sessionId) {
        const sock = this.SESSIONS.get(sessionId);
        if (!sock) {
            throw new Error('Session not found.');
        }
        sock.ev?.removeAllListeners();
        const { removeCreds } = await this.useAuthState(sessionId);
        removeCreds();
        this.SESSIONS.delete(sessionId);
        this.SESSION_STATUS.delete(sessionId);
        this.SESSION_ATTEMPTS.delete(sessionId);
        this.clearAllTimeouts(sessionId);
        this.clearGroupCache(sessionId);
        try {
            await sock.logout();
        }
        catch (logoutError) {
            consola.warn(`[WA: ${sessionId}] Logout error: ${logoutError.message}`);
        }
        sock.end?.();
    }
    async autoStart() {
        if (this.DRIVER_AUTH_STATE === 'file') {
            const sessions = fs.readdirSync(this.PATH_SESSION);
            const results = await Promise.allSettled(sessions.map((s) => {
                if (fs.statSync(path.join(this.PATH_SESSION, s)).isDirectory()) {
                    return this.initSession({ sessionId: s });
                }
            }));
            const loaded = results.filter((r) => r.status === 'fulfilled').length;
            const failed = results.filter((r) => r.status === 'rejected').length;
            return {
                length: sessions.length,
                loaded,
                failed,
                message: `Auto-start: ${loaded} loaded, ${failed} failed`,
            };
        }
        else if (this.DRIVER_AUTH_STATE === 'database') {
            const sessions = await DeviceAuth.query()
                .select('session')
                .distinct('session')
                .whereNotNull('session');
            if (sessions.length === 0) {
                return {
                    length: 0,
                    loaded: 0,
                    failed: 0,
                    message: 'No sessions to auto-start',
                };
            }
            const results = await Promise.allSettled(sessions.map((s) => this.initSession({ sessionId: s.session })));
            const loaded = results.filter((r) => r.status === 'fulfilled').length;
            const failed = results.filter((r) => r.status === 'rejected').length;
            return {
                length: sessions.length,
                loaded,
                failed,
                message: `Auto-start: ${loaded} loaded, ${failed} failed`,
            };
        }
    }
    healthCheck(id) {
        const sock = this.SESSIONS.get(id);
        const status = this.SESSION_STATUS.get(id) || 'disconnected';
        return {
            exists: !!sock,
            status,
            reconnectAttempts: this.SESSION_ATTEMPTS.get(id) || 0,
            hasTimeout: this.SESSION_CONNECTION_TIMEOUTS.has(id),
            hasPairingTimeout: this.SESSION_PAIRING_TIMEOUTS.has(id),
            isLocked: this.SESSION_LOCKS.has(id),
        };
    }
    async shutdown() {
        const sessionIds = Array.from(this.SESSIONS.keys());
        const results = await Promise.allSettled(sessionIds.map((sessionId) => this.stopSession(sessionId)));
        this.SESSION_CONNECTION_TIMEOUTS.forEach((t) => clearTimeout(t));
        this.SESSION_CONNECTION_TIMEOUTS.clear();
        this.SESSION_PAIRING_TIMEOUTS.forEach((t) => clearTimeout(t));
        this.SESSION_PAIRING_TIMEOUTS.clear();
        this.SESSION_LOCKS.clear();
        this.groupCache.clear();
        const succeeded = results.filter((r) => r.status === 'fulfilled').length;
        consola.success(`[WA] Shutdown: ${succeeded}/${sessionIds.length} sessions stopped`);
    }
}
const instance = new WASocketManager();
export default instance;
//# sourceMappingURL=whatsapp.js.map