export default class AdminMiddleware {
    async handle(ctx, next) {
        const user = ctx.auth.use('web').user;
        if (!user || user.role !== 'admin') {
            if (ctx.request.ajax()) {
                return ctx.response.forbidden({ message: 'Akses admin diperlukan.' });
            }
            return ctx.response.forbidden('Akses admin diperlukan.');
        }
        return next();
    }
}
