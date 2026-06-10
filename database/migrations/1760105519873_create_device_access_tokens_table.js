import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'device_access_tokens';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table
                .integer('device_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('devices')
                .onDelete('CASCADE');
            table.string('token', 255).notNullable().unique();
            table.timestamp('expires_at').nullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1760105519873_create_device_access_tokens_table.js.map