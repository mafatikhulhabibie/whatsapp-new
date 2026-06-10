import router from '@adonisjs/core/services/router';
import webRoutes from '#start/routes/web';
import apiRoutes from '#start/routes/api';
import { middleware } from '#start/kernel';
router
    .group(() => {
    webRoutes();
})
    .use([
    middleware.adonisBodyParser(),
    middleware.adonisSession(),
    middleware.adonisShield(),
    middleware.adonisInitAuth(),
]);
router
    .group(() => {
    apiRoutes();
})
    .use([middleware.adonisBodyParser()]);
//# sourceMappingURL=routes.js.map