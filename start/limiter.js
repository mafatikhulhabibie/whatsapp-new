import limiter from '@adonisjs/limiter/services/main';
export const resetToken = limiter.define('reset_token', (ctx) => {
    return limiter
        .allowRequests(3)
        .every('1 minute')
        .usingKey('reset_token:' + ctx.request.ip());
});
//# sourceMappingURL=limiter.js.map