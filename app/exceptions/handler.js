import app from '@adonisjs/core/services/app';
import { ExceptionHandler } from '@adonisjs/core/http';
import { errors as shieldErrors } from '@adonisjs/shield';
import { errors as limiterErrors } from '@adonisjs/limiter';
export default class HttpExceptionHandler extends ExceptionHandler {
    debug = !app.inProduction;
    renderStatusPages = app.inProduction;
    statusPages = {
        '404': (error, { view }) => {
            return view.render('pages/errors/not_found', { error });
        },
        '500..599': (error, { view }) => {
            return view.render('pages/errors/server_error', { error });
        },
    };
    async handle(error, ctx) {
        if (error instanceof shieldErrors.E_BAD_CSRF_TOKEN && ctx.request.ajax()) {
            return ctx.response.badRequest({ code: 'E_BAD_CSRF_TOKEN', message: 'Invalid CSRF token' });
        }
        if (error instanceof limiterErrors.E_TOO_MANY_REQUESTS && ctx.request.ajax()) {
            return ctx.response.tooManyRequests({
                code: 'E_TOO_MANY_REQUESTS',
                message: 'Too many requests',
            });
        }
        return super.handle(error, ctx);
    }
    async report(error, ctx) {
        return super.report(error, ctx);
    }
}
//# sourceMappingURL=handler.js.map