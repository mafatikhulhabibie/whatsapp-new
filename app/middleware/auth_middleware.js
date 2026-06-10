export default class AuthMiddleware {
    redirectTo = '/login';
    async handle(ctx, next, options = {}) {
        if (ctx.request.ajax()) {
            if (!(await ctx.auth.use('web').check())) {
                return ctx.response.unauthorized({ message: 'Unauthorized.' });
            }
        }
        else {
            await ctx.auth.authenticateUsing(options.guards, { loginRoute: this.redirectTo });
        }
        return next();
    }
}
//# sourceMappingURL=auth_middleware.js.map