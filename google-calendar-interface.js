// Based on https://developers.google.com/google-apps/calendar/quickstart/nodejs

'use strict'

const fs = require('fs')
const readline = require('readline')
const google = require('googleapis')
const googleAuth = require('google-auth-library')

const SCOPES = ['https://www.googleapis.com/auth/calendar']
const TOKEN_PATH = `${__dirname}/.credentials/google-credentials.json`


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const clientSecret = credentials.installed.client_secret;
  const clientId = credentials.installed.client_id;
  const redirectUrl = credentials.installed.redirect_uris[0];
  const auth = new googleAuth();
  const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

function storeToken(token) {
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}


const clientSecret = JSON.parse(fs.readFileSync(`${__dirname}/.credentials/google-client-secret.json`))

module.exports = {
  authorize,
  createEvent: (calendarId, summary, start, end, cb) => {
    authorize(clientSecret, (auth) => {
      const calendar = google.calendar('v3');

      // Delete placeholder sleep event

      // Depending on time zone, tomorrow's calendar event may be found instead of todays
      // Select the correct one i.e. yesterday's
      const date = (new Date()) // Today
      date.setDate(date.getDate() - 1) // Yesterday

      calendar.events.list({
        auth: auth,
        calendarId: calendarId,
        timeMin: date.toISOString(),
        maxResults: 1,
        singleEvents: true,
        orderBy: 'startTime'
      }, function(err, response) {
        if (err) {
          console.log('The API returned an error: ' + err);
          return;
        }
        var events = response.items;
        if (events.length == 0) {
          console.log('No "Sleep" event found.');
        } else {
          var event = events[0]
          calendar.events.delete({
            auth: auth,
            calendarId: calendarId,
            eventId: event.id
          }, (err, res) => {
            if (err) {
              console.log('The API returned an error: ' + err);
            }
            var start = event.start.dateTime || event.start.date;
            console.log('Deleted %s "Sleep" event', start)
          })
        }
      });


      // Create tracked sleep event
      calendar.events.list({
        auth: auth,
        calendarId: calendarId,
        timeMin: start.toISOString(),
        timeMax: new Date(start.getTime() + 60*1000).toISOString(),
        maxResults: 1,
        singleEvents: true,
        orderBy: 'startTime'
      }, (err, response) => {
        if (err) return cb(err)
        if (response.items[0] && response.items[0].summary === summary) {
          console.log(`Event exists: '${summary}' at ${start.toISOString()}–${end.toISOString()}`)
        } else {
          calendar.events.insert({
            auth: auth,
            calendarId: calendarId,
            resource: {
              'summary': summary,
              'start': { 'dateTime': start.toISOString() },
              'end': { 'dateTime': end.toISOString() },
            }
          }, cb)
        }
      })
    })
  }
}
