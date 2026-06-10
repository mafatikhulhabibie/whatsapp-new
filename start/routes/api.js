import router from '@adonisjs/core/services/router';
export default () => {
    router
        .group(() => {
        router.route('/message', ['GET', 'POST'], '#controllers/api/message_controller.index');
        router.post('/message/query', '#controllers/api/message_controller.query');
        router.route('/group/fetch', ['GET', 'POST'], '#controllers/api/group_controller.index');
        router.route('/device/status', ['GET', 'POST'], '#controllers/api/device_controller.status');
        router.post('/device/start', '#controllers/api/device_controller.start');
        router.post('/device/stop', '#controllers/api/device_controller.stop');
        router.post('/device/logout', '#controllers/api/device_controller.logout');
    })
        .prefix('api');
    router
        .post('example/webhook', '#controllers/api/example_webhook_controller.index')
        .as('api.example.webhook');
};
//# sourceMappingURL=api.js.map