export default class DocsController {
    async webhook({ view }) {
        return view.render('docs/webhook');
    }
    async api_message({ view, request }) {
        return view.render('docs/api_message', {
            baseUrl: `${request.protocol()}://${request.host()}`,
        });
    }
    async api_group({ view }) {
        return view.render('docs/api');
    }
}
//# sourceMappingURL=docs_controller.js.map