import User from '#models/user';
import { BaseSeeder } from '@adonisjs/lucid/seeders';
import crypto from 'node:crypto';
import { DateTime } from 'luxon';
export default class extends BaseSeeder {
    async run() {
        await User.create({
            name: 'Admin',
            username: 'admin',
            password: '12345678',
            role: 'admin',
            maxDevices: 3,
            wsToken: crypto.randomBytes(32).toString('hex'),
            wsTokenCreatedAt: DateTime.now(),
        });
        await User.create({
            name: 'User',
            username: 'user',
            password: '12345678',
            role: 'user',
            maxDevices: 3,
            wsToken: crypto.randomBytes(32).toString('hex'),
            wsTokenCreatedAt: DateTime.now(),
        });
    }
}
//# sourceMappingURL=dev_seeder.js.map