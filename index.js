var events = require("events");
var child = require("child_process");
var os = require("os");

var REGEX = {
    line: {
        win: /^Reply from (.*?): bytes=(\d+) time=([\d\.]+)ms TTL=(\d+)$/,
        unix: /^(\d+) bytes from (.*?): icmp_[rs]eq=(\d+) ttl=(\d+) time=([\d\.]+) ms$/
    },
    exit: {
        linux: /^(\d+) packets transmitted, (\d+) received, (.*)% packet loss, time (\d+)ms$/m,
        mac: /^(\d+) packets transmitted, (\d+) packets received, (.*)% packet loss$/m,
        win: /Packets: Sent = (\d+), Received = (\d+), Lost = (\d+) \((\d+)% loss\).*?(Minimum = \d+ms, Maximum = \d+ms, Average = (\d+)ms)?/
    },
    timeout: {
        win: /Request timed out\./
    },
    no_resolve: {
        win: /^Ping request could not find host (.*?). Please check the name and try again.$/
    }
};

module.exports = function (target, options) {
    var emitter = new events.EventEmitter;
    var packets = 0;
    var totalTime = 0;

    var spawn = null;

    options = options || {};
    options.count = options.count < 0 || 10;

    if (os.platform() === "win32") {
        if (options.count === 0) { // Ping forever
            spawn = child.spawn("ping", ["/t", target]);
        } else {
            spawn = child.spawn("ping", ["/n", options.count, target]);
        }
    } else {
        if (options.count === 0) { // Ping forever
            spawn = child.spawn("ping", [target]);
        } else {
            spawn = child.spawn("ping", ["-c", options.count, target]);
        }
    }

    spawn.stdout.on("data", data);

    function emitData(target, no, bytes, time, ttl) {
        emitter.emit("data", {
            target: target,
            no: no,
            bytes: bytes,
            time: time,
            ttl: ttl
        });
    }

    function emitExit(target, sent, received, lost, time) {
        emitter.emit("exit", {
            target: target,
            sent: sent,
            received: received,
            loss: lost,
            time: time
        });
    }

    function line(str) {
        console.log(str);
        str = str.trim().replace(/\s+/g, " ");
        var match;

        // successful pings
        match = str.match(REGEX.line.win);
        if (match) {
            totalTime += parseFloat(match[3]);
            emitData(target, ++packets, +match[2], +match[3], +match[4]);
        }

        match = str.match(REGEX.line.unix);
        if (match) {
            totalTime += parseFloat(match[4]);
            emitData(target, ++packets, +match[1], +match[5], +match[4]);
        }

        // timeouts
        match = str.match(REGEX.timeout.win);
        if (match) {
            emitData(target, ++packets, 0, 0, 0);
        }

        // cant resolve
        match = str.match(REGEX.no_resolve.win);
        if (match) {
            emitExit(target, 0, 0, 100, 0);
        }

        // exit strings (complete ping)
        match = str.match(REGEX.exit.linux);
        if (match) {
            emitExit(target, +match[1], +match[2], +match[3], +match[4]);
        }

        match = str.match(REGEX.exit.mac);
        if (match) {
            emitExit(target, +match[1], +match[2], +match[3], totalTime);
        }

        match = str.match(REGEX.exit.win);
        if (match) {
            emitExit(target, +match[1], +match[2], +match[4], totalTime);
        }
    }

    function data(str) {
        str = str + "";
        line(str);
    }

    return emitter;
};

