import User from '#models/user';
import env from '#start/env';
import vine, { errors } from '@vinejs/vine';
export default class UsersController {
    async index({}) { }
    async show({ auth, params, view, response }) {
        if (auth.use('web').user?.id !== Number.parseInt(params.id)) {
            return response.forbidden('You are not allowed to access this page.');
        }
        const user = await User.findOrFail(params.id);
        return view.render('users/show', { user });
    }
    async update({ auth, params, request, response }) {
        if (!request.ajax()) {
            return response.badRequest('Invalid request.');
        }
        if (auth.use('web').user?.id !== Number.parseInt(params.id)) {
            return response.forbidden('You are not allowed to access this page.');
        }
        if (env.get('DEMO')) {
            return response.ok({ message: 'Demo mode.' });
        }
        try {
            const { name, username, password } = await request.validateUsing(vine.compile(vine.object({
                name: vine.string().trim().maxLength(20),
                username: vine
                    .string()
                    .trim()
                    .maxLength(20)
                    .unique(async (db, value) => {
                    return !(await db
                        .from('users')
                        .whereNot('id', params.id)
                        .where('username', value)
                        .first());
                })
                    .toLowerCase(),
                password: vine.string().optional(),
            })));
            const user = await User.findOrFail(params.id);
            user.name = name;
            user.username = username;
            if (password) {
                user.password = password;
            }
            await user.save();
            return response.ok({ message: 'User updated successfully' });
        }
        catch (error) {
            if (error instanceof errors.E_VALIDATION_ERROR) {
                return response.unprocessableEntity({
                    message: error.messages[0]?.message,
                    errors: error.messages,
                });
            }
            console.error(error);
            return response.internalServerError({ message: 'An unexpected error occurred.' });
        }
    }
}
//# sourceMappingURL=users_controller.js.map