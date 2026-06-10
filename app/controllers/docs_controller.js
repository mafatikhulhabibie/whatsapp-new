export default class DocsController {
    async webhook({ view }) {
        return view.render('docs/webhook');
    }
    async api_message({ view }) {
        return view.render('docs/api_message');
    }
    async api_group({ view }) {
        return view.render('docs/api');
    }
}
//# sourceMappingURL=docs_controller.js.map