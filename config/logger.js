import env from '#start/env';
import { defineConfig } from '@adonisjs/core/logger';
const loggerConfig = defineConfig({
    default: 'app',
    loggers: {
        app: {
            enabled: true,
            name: env.get('APP_NAME'),
            level: env.get('LOG_LEVEL'),
            transport: undefined,
        },
    },
});
export default loggerConfig;
//# sourceMappingURL=logger.js.map