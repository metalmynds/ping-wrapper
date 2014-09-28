var events = require("events");
var child  = require("child_process");

var EXIT_REG = /^(\d+) packets transmitted, (\d+) received, (\d+)% packet loss, time (\d+)ms$/;
var LINE_REG = /^(\d+) bytes from (.*?): icmp_[rs]eq=(\d+) ttl=(\d+) time=([\d\.]+) ms$/;

module.exports = function (target, options) {
  var emitter = new events.EventEmitter;
  var packets = 0;

  options = options || {};
  options.count = options.count || 10;

  var spawn = child.spawn("ping", ["-c", options.count, target]);
  spawn.stdout.on("data", data);

  return emitter;

  function line(str) {
    str = str.trim().replace(/\s+/g, " ");

    var match = str.match(LINE_REG);
    if (!match) {
      match = str.match(EXIT_REG);
      if (match) {
        emitter.emit("exit", {
          sent: +match[1],
          recieved: +match[2],
          loss: +match[3],
          time: +match[4]
        });
      }
    } else {
      emitter.emit("data", {
        no: ++packets,
        bytes: +match[1],
        time: +match[4],
        ttl: +match[3]
      });
    }
  }

  function data(str) {
    str = str + "";
    var lines = str.split("\n");
    if (lines.length > 1) {
      lines.forEach(line);
    } else {
      line(data);
    }
  }
};
