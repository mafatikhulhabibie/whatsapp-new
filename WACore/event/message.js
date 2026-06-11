import consola from 'consola';
import serialize from '#wa/utils/serialize';
import ChatMessageStore from '#services/chat_message_store';
import axios from 'axios';
const WEBHOOK_TIMEOUT = 5000;
export default async function ({ id, sock, event }) {
    if (event.type !== 'notify')
        return;
    for (const message of event.messages) {
        const startTime = Date.now();
        if (!message?.message) {
            consola.info(message.messageStubParameters);
            continue;
        }
        const m = await serialize({
            id,
            sock,
            WAMessage: message,
        });
        if (!m)
            continue;
        try {
            await ChatMessageStore.saveFromSerialized(id, message, m);
        }
        catch (error) {
            consola.error(`[CHAT: ${id}] Failed to save message: ${error.message}`);
        }
        // Jangan kirim webhook untuk pesan yang dikirim bot sendiri (cegah loop balasan ganda)
        if (m.fromMe || m.flags?.fromMe || m.key?.fromMe) {
            continue;
        }
        if (m.webhook) {
            try {
                await Promise.all([
                    sock.readMessages([m.key]),
                    axios.post(m.webhook, m, {
                        timeout: WEBHOOK_TIMEOUT,
                    }),
                ]);
                const duration = Date.now() - startTime;
                consola.success(`[WEBHOOK: ${id}] Successfully processed in ${duration}ms`);
            }
            catch (error) {
                let errorMessage = `[WEBHOOK: ${id}] Something went wrong.`;
                if (axios.isAxiosError(error)) {
                    if (error.response) {
                        errorMessage = `[WEBHOOK: ${id}] ${error.response.status} ${error.response.statusText}`;
                    }
                    else if (error.code === 'ECONNABORTED') {
                        errorMessage = `[WEBHOOK: ${id}] Request timed out after ${WEBHOOK_TIMEOUT}.`;
                    }
                    else {
                        errorMessage = `[WEBHOOK: ${id}] ${error.message}`;
                    }
                }
                else {
                    errorMessage = `[WEBHOOK: ${id}] ${error.message}`;
                }
                consola.error(errorMessage);
            }
        }
    }
}
//# sourceMappingURL=message.js.map