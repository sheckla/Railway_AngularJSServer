function log(...args) {
    const eventMarkers = {
        none: '\x1b[2m\x1b[90m[INTERNAL]\x1b[0m',
        emit: '\x1b[31m\x1b[1m[EMIT]\x1b[0m',
        receive: '\x1b[32m\x1b[1m[RECEIVE]\x1b[0m',
        lobby: '\x1b[36m\x1b[1m[LOBBY]\x1b[0m',
    }

    let eventType = 'none';
    let messages = args;

    if (args.length > 1 && eventMarkers[args[0]]) {
        eventType = args.shift();
        messages = args;
    }

    var date = new Date();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    var timestamp = '[' + hours + ':' + minutes + ':' + seconds + ']';

    const eventMarker = eventMarkers[eventType] || '';
    var logMessage = timestamp.padEnd(11) + eventMarker.padStart(25) + ':';
    messages.forEach((msg) => {
        if (msg !== undefined) {
            logMessage += ' ' + msg.toString();
        }
    });
    console.log(logMessage);
}

module.exports = { log: log }


module.exports = { log: log }