import { BaseSchema } from '@adonisjs/lucid/schema';

export default class extends BaseSchema {
    async up() {
        this.schema.createTable('chat_conversations', (table) => {
            table.increments('id');
            table
                .integer('device_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('devices')
                .onDelete('CASCADE');
            table.string('chat_jid').notNullable();
            table.boolean('is_group').notNullable().defaultTo(false);
            table.string('name').nullable();
            table.text('last_message_preview').nullable();
            table.timestamp('last_message_at').nullable();
            table.integer('unread_count').notNullable().defaultTo(0);
            table.timestamp('created_at');
            table.timestamp('updated_at');

            table.unique(['device_id', 'chat_jid']);
            table.index(['device_id', 'last_message_at']);
        });

        this.schema.createTable('chat_messages', (table) => {
            table.increments('id');
            table
                .integer('device_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('devices')
                .onDelete('CASCADE');
            table
                .integer('conversation_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('chat_conversations')
                .onDelete('CASCADE');
            table.string('wa_message_id').notNullable();
            table.boolean('from_me').notNullable().defaultTo(false);
            table.string('chat_jid').notNullable();
            table.string('sender_jid').nullable();
            table.string('sender_name').nullable();
            table.string('message_type').nullable();
            table.text('body_text').nullable();
            table.boolean('is_media').notNullable().defaultTo(false);
            table.timestamp('message_at').notNullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');

            table.unique(['device_id', 'wa_message_id']);
            table.index(['conversation_id', 'message_at']);
        });
    }

    async down() {
        this.schema.dropTable('chat_messages');
        this.schema.dropTable('chat_conversations');
    }
}
