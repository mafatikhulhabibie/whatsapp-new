export default class ExampleWebhookController {
    async index({ response, request }) {
        console.log(request.body());
        return response.ok({ message: 'Webhook received successfully' });
    }
}
//# sourceMappingURL=example_webhook_controller.js.map