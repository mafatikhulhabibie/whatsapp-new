import { Env } from '@adonisjs/core/env';
export default await Env.create(new URL('../', import.meta.url), {
    NODE_ENV: Env.schema.enum(['development', 'production', 'test']),
    PORT: Env.schema.number(),
    APP_KEY: Env.schema.string(),
    HOST: Env.schema.string({ format: 'host' }),
    LOG_LEVEL: Env.schema.string(),
    SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'file']),
    DB_CONNECTION: Env.schema.enum(['mysql', 'sqlite']),
    DB_HOST: Env.schema.string.optional(),
    DB_PORT: Env.schema.number.optional(),
    DB_USER: Env.schema.string.optional(),
    DB_PASSWORD: Env.schema.string.optional(),
    DB_DATABASE: Env.schema.string.optional(),
    LIMITER_STORE: Env.schema.enum(['database', 'memory']),
    DEMO: Env.schema.string.optional(),
    CSRF: Env.schema.boolean.optional(),
    COOKIE_SECURE: Env.schema.boolean.optional(),
    WA_AUTH_STATE: Env.schema.enum(['database', 'file']),
    CACHE_DRIVER: Env.schema.enum(['lru', 'redis']),
});
//# sourceMappingURL=env.js.map