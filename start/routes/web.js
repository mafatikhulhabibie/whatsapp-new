import { middleware } from '#start/kernel';
import { resetToken } from '#start/limiter';
import router from '@adonisjs/core/services/router';
export default () => {
    router
        .group(() => {
        router.get('/', '#controllers/devices_controller.index').as('home');
        router
            .group(() => {
            router.get('/', '#controllers/devices_controller.index').as('device');
            router
                .get('/:id', '#controllers/devices_controller.show')
                .where('id', router.matchers.number())
                .as('device.detail');
            router
                .get('/:id/reset-token', '#controllers/devices_controller.resetToken')
                .where('id', router.matchers.number())
                .as('device.resetToken')
                .use(resetToken);
            router
                .post('/:id/webhook', '#controllers/devices_controller.updateWebhook')
                .where('id', router.matchers.number())
                .as('device.updateWebhook');
            router.post('/create', '#controllers/devices_controller.create').as('device.create');
            router.delete('/:id', '#controllers/devices_controller.destroy').as('device.destroy');
        })
            .prefix('device');
        router.get('user/:id', '#controllers/users_controller.show').as('users.show');
        router.post('user/:id/update', '#controllers/users_controller.update').as('users.update');
        router.get('message/send', '#controllers/send_message_controller.index').as('message.send');
        router.get('docs/webhook', '#controllers/docs_controller.webhook').as('docs.webhook');
        router
            .get('docs/api/message', '#controllers/docs_controller.api_message')
            .as('docs.api.message');
    })
        .use([middleware.auth(), middleware.wapi()]);
    router
        .group(() => {
        router.get('/login', '#controllers/auth_controller.login').as('login');
        router.post('/login/post', '#controllers/auth_controller.loginPost').as('login.post');
    })
        .use(middleware.guest());
    router.get('/logout', '#controllers/auth_controller.logout').as('logout').use(middleware.auth());
};
//# sourceMappingURL=web.js.map