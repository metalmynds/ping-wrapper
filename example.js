var ping = require("./index");
var exec = ping("google.com", 10);

exec.on("data", function(data) {
  console.log(data);
});

exec.on("exit", function(data) {
  console.log(data);
});
