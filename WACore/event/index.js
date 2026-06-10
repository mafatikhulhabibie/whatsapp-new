import message from '#wa/event/message';
export default async function ({ sessionId, sock, events, }) {
    if (events['messages.upsert']) {
        message({ id: sessionId, sock, event: events['messages.upsert'] }).catch((err) => {
            console.error(`[WA: ${sessionId}] Error in message handler:`, err);
        });
    }
}
//# sourceMappingURL=index.js.map