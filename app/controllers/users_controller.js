import User from '#models/user';
import env from '#start/env';
import vine, { errors } from '@vinejs/vine';
import crypto from 'node:crypto';
import { DateTime } from 'luxon';

const userFields = {
    name: vine.string().trim().maxLength(50),
    username: vine
        .string()
        .trim()
        .maxLength(20)
        .toLowerCase(),
    role: vine.enum(['admin', 'user']),
    maxDevices: vine.number().min(0).max(100),
};

export default class UsersController {
    async index({ view }) {
        const users = await User.query().orderBy('id', 'asc');
        return view.render('users/index', { users });
    }

    async store({ request, response }) {
        if (!request.ajax()) {
            return response.badRequest('Invalid request.');
        }
        if (env.get('DEMO')) {
            return response.ok({ message: 'Demo mode.' });
        }
        try {
            const payload = await request.validateUsing(vine.compile(vine.object({
                ...userFields,
                username: userFields.username.unique({
                    table: 'users',
                    column: 'username',
                }),
                password: vine.string().minLength(6),
            })));
            const user = await User.create({
                ...payload,
                wsToken: crypto.randomBytes(32).toString('hex'),
                wsTokenCreatedAt: DateTime.now(),
            });
            return response.ok({ message: 'User berhasil ditambahkan', data: user.serialize() });
        }
        catch (error) {
            return this.handleError(error, response);
        }
    }

    async edit({ params, view, response }) {
        const user = await User.find(params.id);
        if (!user) {
            return response.notFound('User tidak ditemukan.');
        }
        return view.render('users/edit', { user });
    }

    async adminUpdate({ params, request, response }) {
        if (!request.ajax()) {
            return response.badRequest('Invalid request.');
        }
        if (env.get('DEMO')) {
            return response.ok({ message: 'Demo mode.' });
        }
        try {
            const payload = await request.validateUsing(vine.compile(vine.object({
                ...userFields,
                username: userFields.username.unique({
                    table: 'users',
                    column: 'username',
                    filter: (db) => db.whereNot('id', params.id),
                }),
                password: vine.string().minLength(6).optional(),
            })));
            const user = await User.findOrFail(params.id);
            user.name = payload.name;
            user.username = payload.username;
            user.role = payload.role;
            user.maxDevices = payload.maxDevices;
            if (payload.password) {
                user.password = payload.password;
            }
            await user.save();
            return response.ok({ message: 'User berhasil diperbarui' });
        }
        catch (error) {
            return this.handleError(error, response);
        }
    }

    async destroy({ params, auth, request, response }) {
        if (!request.ajax()) {
            return response.badRequest('Invalid request.');
        }
        if (env.get('DEMO')) {
            return response.ok({ message: 'Demo mode.' });
        }
        try {
            if (auth.use('web').user?.id === Number.parseInt(params.id)) {
                return response.unprocessableEntity({ message: 'Tidak bisa menghapus akun sendiri.' });
            }
            const user = await User.findOrFail(params.id);
            await user.delete();
            return response.ok({ message: 'User berhasil dihapus' });
        }
        catch (error) {
            return this.handleError(error, response);
        }
    }

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
            return this.handleError(error, response);
        }
    }

    handleError(error, response) {
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
