import ScheduledMessage from '#models/scheduled_message';
import Device from '#models/device';
import MessageSender from '#services/message_sender';
import { DateTime } from 'luxon';
import consola from 'consola';

export default class ScheduledMessageProcessor {
    static intervalId = null;

    static start(intervalMs = 30000) {
        if (this.intervalId) {
            return;
        }
        this.intervalId = setInterval(() => {
            this.process().catch((error) => {
                consola.error('[Scheduler] Error processing scheduled messages:', error.message);
            });
        }, intervalMs);
        consola.info('[Scheduler] Pesan terjadwal aktif (interval 30 detik)');
    }

    static stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    static async process() {
        const dueMessages = await ScheduledMessage.query()
            .where('status', 'pending')
            .where('scheduled_at', '<=', DateTime.now().toSQL())
            .orderBy('scheduled_at', 'asc')
            .limit(20);

        for (const scheduled of dueMessages) {
            await this.processOne(scheduled);
        }
    }

    static async processOne(scheduled) {
        const device = await Device.query().where('id', scheduled.deviceId).first();
        if (!device) {
            scheduled.status = 'failed';
            scheduled.error = 'Device tidak ditemukan.';
            await scheduled.save();
            return;
        }

        if (!MessageSender.isDeviceConnected(device)) {
            scheduled.attempts += 1;
            scheduled.error = 'Device belum connected.';
            if (scheduled.attempts >= ScheduledMessage.MAX_ATTEMPTS) {
                scheduled.status = 'failed';
            }
            await scheduled.save();
            return;
        }

        const result = await MessageSender.send(device, scheduled.to, scheduled.messageType, scheduled.payload);
        if (result.ok) {
            scheduled.status = 'sent';
            scheduled.sentAt = DateTime.now();
            scheduled.error = null;
            await scheduled.save();
            consola.success(`[Scheduler] Pesan terjadwal #${scheduled.id} terkirim ke ${result.to}`);
            return;
        }

        scheduled.attempts += 1;
        scheduled.error = result.error;
        if (scheduled.attempts >= ScheduledMessage.MAX_ATTEMPTS) {
            scheduled.status = 'failed';
        }
        await scheduled.save();
    }
}
