import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'users';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id').notNullable();
            table.string('name').nullable();
            table.string('username').notNullable().unique();
            table.string('password').notNullable();
            table.integer('max_devices').notNullable().defaultTo(0);
            table.enum('role', ['admin', 'user']).notNullable().defaultTo('user');
            table.text('ws_token').nullable();
            table.timestamp('ws_token_created_at').nullable();
            table.timestamp('created_at').notNullable();
            table.timestamp('updated_at').nullable();
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1757139965719_create_users_table.js.map