"use strict";

var Promise = require('bluebird');
var WebClient = require('@slack/client').WebClient;
const prompt = require('prompt-promise');
const minimist = require('minimist');
const fs = Promise.promisifyAll(require('fs'));
const homedir = require('os').homedir();

var https = require('https');

var token;

var channel;
var privateChannel = false;
var delay = 300; // delay between delete operations in millisecond

var channelApi = privateChannel ? 'groups' : 'channels';
var baseApiUrl = 'https://slack.com/api/';
var historyApiUrl;
var deleteApiUrl;
var messages = [];
// ---------------------------------------------------------------------------------------------------------------------

module.exports = function() {

  var args = minimist(process.argv.slice(2));

  // check for required args
  Promise.try(() => {
      if (!args.channel) return Promise.reject('Argument channel required');
      else return Promise.resolve();
    })
    .then(() => fs.readFileAsync(`${homedir}/.slackdel.json`, 'utf-8'))
    .then(data => {
      token = JSON.parse(data).token;
      var web = new WebClient(token);

      return new Promise(function(resolve, reject) {
        web.channels.list(function(err, res) {

          if (err) reject(err);
          else {
            // console.log('res:', res);
            channel = res.channels.find(c => c.name == args.channel).id;
            // console.log('channel:', channel);
            resolve(channel);
          }
        });
      });
    })
    .then(channel => {

      historyApiUrl = baseApiUrl + channelApi + '.history?token=' + token + '&count=1000&channel=' + channel;
      deleteApiUrl = baseApiUrl + 'chat.delete?token=' + token + '&channel=' + channel + '&ts=';

      function deleteMessage() {

        if (messages.length === 0) process.exit();
        else {
          var ts = messages.shift();

          https.get(deleteApiUrl + ts, function(res) {

            var body = '';

            res.on('data', function(chunk) {
              body += chunk;
            });

            res.on('end', function() {
              var response = JSON.parse(body);

              if (response.ok === true) {
                console.log(ts + ' deleted!');
              } else if (response.ok === false) {
                messages.push(ts);
              }

              setTimeout(deleteMessage, delay);
            });
          }).on('error', function(e) {
            console.log("Got an error: ", e);
          });
        }
      }

      console.log('before get');

      https.get(historyApiUrl, function(res) {

        var body = '';

        res.on('data', function(chunk) {
          body += chunk;
        });

        res.on('end', function() {

          var response = JSON.parse(body);

          // console.log('response:', response);

          for (var i = 0; i < response.messages.length; i++) {
            messages.push(response.messages[i].ts);
          }

          deleteMessage();
        });
      }).on('error', function(e) {
        console.log("Got an error: ", e);
      });
    })
    .catch(err => {
      console.log(err);
      process.exit(1);
    });
};
