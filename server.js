#!/usr/bin/env node
// server.js

if (process.argv [2] !== '' && !process.argv [2]) {
  console.log ('Usage: ' + process.argv [1] + ' home [root [port]]')
  console.log ("  home = albums' home directory (default /home/<user>)")
  console.log ('  root = chosen album root (within the home dirctory; default = not chosen)')
  console.log ('  port = server port (default 3000)')
  console.log ("Note: Parameter position is significant; use '' for default")
  return
}

// modules
var express = require ('express')
var app = express ()

//process.argv.forEach (function (val, index, array) {
//  console.log (index + ': ' + val);
//});

// Image databases home directory and default album
process.env.IMDB_HOME = process.argv [2] // albums' home
process.env.IMDB_ROOT = process.argv [3] // album root
process.env.PORT = process.argv [4]      // server port
// set our port
var port = process.env.PORT || 3000

// set the static files location
app.use ('/', express.static (__dirname))
app.use ('/', express.static (__dirname + '/public'))

// 1 configure our routes
require ('./app/routes')(app)

// 2 start our app
app.listen (port)

// 3 expose app
exports = module.exports = app

console.log ('\nExpress server, port ' + port + '\n')
