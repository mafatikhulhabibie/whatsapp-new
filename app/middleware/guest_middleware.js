export default class GuestMiddleware {
    redirectTo = '/';
    async handle(ctx, next) {
        if (await ctx.auth.use('web').check()) {
            if (ctx.request.ajax()) {
                return ctx.response.ok({ message: 'Already logged-in' });
            }
            else {
                return ctx.response.redirect(this.redirectTo, true);
            }
        }
        return next();
    }
}
//# sourceMappingURL=guest_middleware.js.map