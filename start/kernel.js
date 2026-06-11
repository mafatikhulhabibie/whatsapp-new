import router from '@adonisjs/core/services/router';
import server from '@adonisjs/core/services/server';
server.errorHandler(() => import('#exceptions/handler'));
server.use([
    () => import('#middleware/container_bindings_middleware'),
    () => import('@adonisjs/static/static_middleware'),
    () => import('@adonisjs/vite/vite_middleware'),
]);
export const middleware = router.named({
    guest: () => import('#middleware/guest_middleware'),
    auth: () => import('#middleware/auth_middleware'),
    admin: () => import('#middleware/admin_middleware'),
    wapi: () => import('#middleware/wapi_middleware'),
    adonisBodyParser: () => import('@adonisjs/core/bodyparser_middleware'),
    adonisSession: () => import('@adonisjs/session/session_middleware'),
    adonisShield: () => import('@adonisjs/shield/shield_middleware'),
    adonisInitAuth: () => import('@adonisjs/auth/initialize_auth_middleware'),
});
//# sourceMappingURL=kernel.js.map