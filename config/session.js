import env from '#start/env';
import app from '@adonisjs/core/services/app';
import { defineConfig, stores } from '@adonisjs/session';
const sessionConfig = defineConfig({
    enabled: true,
    cookieName: 'velixs-wapi-session',
    clearWithBrowser: false,
    age: '2h',
    cookie: {
        path: '/',
        httpOnly: true,
        secure: env.get('COOKIE_SECURE', app.inProduction),
        sameSite: 'lax',
    },
    store: env.get('SESSION_DRIVER'),
    stores: {
        cookie: stores.cookie(),
        file: stores.file({ location: app.tmpPath('sessions') }),
    },
});
export default sessionConfig;
//# sourceMappingURL=session.js.map