import { BaseSchema } from '@adonisjs/lucid/schema';

export default class extends BaseSchema {
    tableName = 'scheduled_messages';

    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table
                .integer('user_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('users')
                .onDelete('CASCADE');
            table
                .integer('device_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('devices')
                .onDelete('CASCADE');
            table.string('to').notNullable();
            table.enum('message_type', ['text', 'image', 'video', 'document', 'location']).notNullable();
            table.json('payload').notNullable();
            table.timestamp('scheduled_at').notNullable();
            table.enum('status', ['pending', 'sent', 'failed', 'cancelled']).notNullable().defaultTo('pending');
            table.integer('attempts').notNullable().defaultTo(0);
            table.text('error').nullable();
            table.timestamp('sent_at').nullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');

            table.index(['status', 'scheduled_at']);
        });
    }

    async down() {
        this.schema.dropTable(this.tableName);
    }
}
