import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'device_auths';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.bigIncrements('id').primary();
            table.string('session').notNullable();
            table.string('key').notNullable();
            table.text('value').nullable();
            table.unique(['session', 'key']);
            table.index(['session']);
            table.timestamp('created_at').notNullable();
            table.timestamp('updated_at').notNullable();
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1757144539655_create_device_auths_table.js.map