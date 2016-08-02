var events = require("events");
var child  = require("child_process");
var os = require("os");

var LINUX_EXIT_REG = /^(\d+) packets transmitted, (\d+) received, (.*)% packet loss, time (\d+)ms$/m;
var MAC_EXIT_REG = /^(\d+) packets transmitted, (\d+) packets received, (.*)% packet loss$/m;
var WIN_EXIT_REG = /Packets: Sent = (\d+), Received = (\d+), Lost = (\d+) \((\d+)% loss\).*?Minimum = \d+ms, Maximum = \d+ms, Average = (\d+)ms/;
var LINE_REG = /^(\d+) bytes from (.*?): icmp_[rs]eq=(\d+) ttl=(\d+) time=([\d\.]+) ms$/;
var LINE_WIN = /^Reply from (.*?): bytes=(\d+) time=([\d\.]+)ms TTL=(\d+)$/;

module.exports = function (target, options) {
  console.log("called")
  var emitter = new events.EventEmitter;
  var packets = 0;
  var totalTime = 0;


  options = options || {};
  options.count = options.count || 10;

  if (os.platform() == "win32") {
    var spawn = child.spawn("ping", ["/n", options.count, target]);
  } else {
    var spawn = child.spawn("ping", ["-c", options.count, target]);
  }
  spawn.stdout.on("data", data);

  function line(str) {
    str = str.trim().replace(/\s+/g, " ");

    var match = str.match(LINE_REG);
    var win_match = str.match(LINE_WIN);
    if (match) {
      emitter.emit(
        "data", {
          target: target,
          no: ++packets,
          bytes: +match[1],
          time: +match[5],
          ttl: +match[4]
        }
      );
      totalTime += parseFloat(match[5]);
    } else if (win_match) {
      emitter.emit(
        "data", {
          target: target,
          no: ++packets,
          bytes: +win_match[2],
          time: +win_match[3],
          ttl: +win_match[4]
        }
      );
      totalTime += parseFloat(win_match[3]);
    } else {
      var match_linux = str.match(LINUX_EXIT_REG);
      var match_mac = str.match(MAC_EXIT_REG);
      var match_win = str.match(WIN_EXIT_REG);
      if (match_linux) {
        emitter.emit(
          "exit", {
            target: target,
            sent: +match_linux[1],
            recieved: +match_linux[2],
            loss: +match_linux[3],
            time: +match_linux[4]
          }
        );
      } else if (match_mac) {
        emitter.emit(
          "exit", {
            target: target,
            sent: +match_mac[1],
            recieved: +match_mac[2],
            loss: +match_mac[3],
            time: +totalTime
          }
        );
      } else if (match_win) {
        emitter.emit(
          "exit", {
            target: target,
            sent: +match_win[1],
            recieved: +match_win[2],
            loss: +match_win[4],
            time: +totalTime
          }
        );
      }
    }
  }

  function data(str) {
    str = str + "";
    line(str);
  }

  return emitter;
};
