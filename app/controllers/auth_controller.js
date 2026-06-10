import User from '#models/user';
import hash from '@adonisjs/core/services/hash';
import vine, { errors } from '@vinejs/vine';
import env from '#start/env';
export default class AuthController {
    async login({ view }) {
        return view.render('auth/login', { demo: env.get('DEMO') });
    }
    async loginPost({ request, response, auth, session }) {
        if (!request.ajax()) {
            return response.badRequest('Invalid request.');
        }
        try {
            const { username, password } = await request.validateUsing(vine.compile(vine.object({
                username: vine.string().trim(),
                password: vine.string().trim(),
            })));
            const user = await User.findBy('username', username);
            if (!user || !(await hash.verify(user.password, password))) {
                return response.unauthorized({ message: 'Invalid credentials' });
            }
            await user.save();
            session.put('wsToken', user.wsToken);
            await auth.use('web').login(user);
            return response.ok({ message: 'Login successful' });
        }
        catch (error) {
            console.error(`[AUTH] ${error.message}`);
            if (error instanceof errors.E_VALIDATION_ERROR) {
                return response.unprocessableEntity({
                    message: error.messages[0]?.message,
                    errors: error.messages,
                });
            }
            return response.internalServerError({ message: 'An unexpected error occurred.' });
        }
    }
    async logout({ response, auth, session }) {
        session.forget('wsToken');
        await auth.use('web').logout();
        session.flash('toast', { type: 'success', title: 'Logout successful' });
        return response.redirect().toRoute('login');
    }
}
//# sourceMappingURL=auth_controller.js.map