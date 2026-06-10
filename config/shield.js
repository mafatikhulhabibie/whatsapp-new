import env from '#start/env';
import { defineConfig } from '@adonisjs/shield';
const shieldConfig = defineConfig({
    csp: {
        enabled: false,
        directives: {},
        reportOnly: false,
    },
    csrf: {
        enabled: env.get('CSRF', true),
        exceptRoutes: (ctx) => {
            return ctx.request.url().includes('/api/');
        },
        enableXsrfCookie: false,
        methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    },
    xFrame: {
        enabled: true,
        action: 'DENY',
    },
    hsts: {
        enabled: true,
        maxAge: '180 days',
    },
    contentTypeSniffing: {
        enabled: true,
    },
});
export default shieldConfig;
//# sourceMappingURL=shield.js.map