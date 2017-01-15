// The variable 'credentials' should contain client_id, user_id, redirect_url, subscriptionVerification
// Acquire access_token and refresh_token by startAuthServer() and visiting http://127.0.0.1:3001/auth/fitbit in a browser

// https://dev.fitbit.com/docs/


'use strict'

const fs = require('fs')
const url = require('url')
const http = require('http')
const https = require('https')
const querystring = require('querystring')


const credentials = JSON.parse(fs.readFileSync(`${__dirname}/.credentials/fitbit-credentials.json`))
let profile


// https://dev.fitbit.com/docs/oauth2/#access-token-request
function authenticate(code, cb) {
  requestToken(`grant_type=authorization_code&code=${code}&client_id=${credentials.client_id}&redirect_uri=${encodeURIComponent(credentials.redirect_uri)}`, cb)
}

// https://dev.fitbit.com/docs/oauth2/#refreshing-tokens
function refresh(cb) {
  requestToken(`grant_type=refresh_token&refresh_token=${credentials.refresh_token}`, cb)
}

// https://dev.fitbit.com/docs/sleep/#get-sleep-logs
function get(path, cb) {
  const options = {
    hostname: 'api.fitbit.com',
    port: 443,
    path: `/1/user/${credentials.user_id}${path}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${credentials.access_token}`
    }
  }
  let data = ''
  const req = https.request(options, res => {
    res.on('data', chunk => data += chunk)
    res.on('end', () => {
      if (res.statusCode !== 200) cb(data)
      else cb(null, JSON.parse(data), null, 2)
    })
  })
  req.end()
  req.on('error', err => cb(err))
}

function requestToken(body, cb) {
  const options = {
    hostname: 'api.fitbit.com',
    port: 443,
    path: '/oauth2/token',
    method: 'POST',
    headers: {
      'Authorization': `Basic ${new Buffer(`${credentials.client_id}:${credentials.client_secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }
  let data = ''
  const req = https.request(options, res => {
    res.setEncoding('utf8')
    res.on('data', chunk => data += chunk)
    res.on('end', () => {
      data = JSON.parse(data)
      if (res.statusCode !== 200) return cb(data)
      credentials.access_token = data.access_token
      credentials.refresh_token = data.refresh_token
      fs.writeFile(`${__dirname}/.credentials/fitbit-credentials.json`, JSON.stringify(credentials, null, 2), cb)
    })
  })
  req.on('error', err => cb(err))
  req.write(body)
  req.end()
}

// https://dev.fitbit.com/docs/subscriptions/#adding-a-subscription
function addSubscription(path, cb) {
  const options = {
    hostname: 'api.fitbit.com',
    port: 443,
    path: `/1/user/${credentials.user_id}${path}`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${credentials.access_token}`
    }
  }
  let data = ''
  const req = https.request(options, res => {
    res.setEncoding('utf8')
    res.on('data', chunk => data += chunk)
    res.on('end', () => {
      if (res.statusCode !== 200) cb(data)
      else cb(null, JSON.parse(data), null, 2)
    })
  })
  req.on('error', err => cb(err))
  req.end()
}

initSubscription: cb => {
  const subscriptionId = 1
  refresh((err) => {
    if (err) return cb(err)
    // This appears to be an idempotent request
    addSubscription(`/sleep/apiSubscriptions/${subscriptionId}.json`, cb)
    // List active subscriptions
    // get(`/sleep/apiSubscriptions.json`, cb)
  })
}


module.exports = {
  // First this
  refreshToken: cb => {
    refresh(err => {
      if (err) return cb(err)
      get('/profile.json', (err, newProfile) => {
        if (err) return cb(err)
        profile = newProfile
        cb()
      })
    })
  },
  // Then this
  getSleep: (dateString, cb) => {
    get(`/sleep/date/${dateString}.json`, (err, sleepData) => {
      if (err) return cb(err)
        const sleepEvents = []
      for (let i = 0; i < sleepData.sleep.length; i++) {
        const start = new Date((new Date(sleepData.sleep[i].startTime)).getTime() - profile.user.offsetFromUTCMillis)
        const end = new Date(start.getTime() + sleepData.sleep[i].timeInBed * 60000)
        const totalDuration = (end.getTime() - start.getTime())
        const totalHours = Math.floor(totalDuration / 3600000)
        const totalMinutes = Math.round((totalDuration - totalHours * 3600000) / 60000)
        const sleepDuration = sleepData.sleep[i].minutesAsleep * 60000
        const sleepHours = Math.floor(sleepDuration / 3600000)
        const sleepMinutes = Math.round((sleepDuration - sleepHours * 3600000) / 60000)
        sleepEvents.push({
          start: start,
          end: end,
          totalDuration: `${totalHours}h ${totalMinutes}m`,
          sleepDuration: `${sleepHours}h ${sleepMinutes}m`
        })
      }
      cb(null, sleepEvents)
    })
  },
  // Start a server through which user can authenticate
  // This is only required once, afterwards the access tokens are used
  startAuthServer: () => {
    // https://dev.fitbit.com/docs/oauth2/#obtaining-consent
    https.createServer({
      key: fs.readFileSync(`${process.env.HOME}/.credentials/ssl/key.pem`),
      cert: fs.readFileSync(`${process.env.HOME}/.credentials/ssl/cert.pem`)
    }, (req, res) => {
      if (req.url === '/auth/fitbit') {
        res.writeHead(302, { 'Location': `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${credentials.client_id}&redirect_uri=${encodeURIComponent(credentials.redirect_uri)}&scope=sleep%20profile%20activity` }); res.end()
      } else if (url.parse(req.url).pathname === url.parse(credentials.redirect_uri).pathname) {
        authenticate(querystring.parse(url.parse(req.url).query).code, (err) => {
          if (err) throw err
          initSubscription((err) => {
            if (err) throw err
            const msg = `Successfully authenticated user ${credentials.user_id}, acquired access tokens and initiated push notifications`
            res.end(msg)
            console.log(msg)
          })
        })
      } else {
        res.statusCode = 404; res.end()
      }
    }).listen(3000, () => console.log(`Go to ${credentials.redirect_uri}`))
  },
  // Set up a subscription notification server, call back each time a subscription notification is received
  onNotification: cb => {
    // Cannot use https since Fitbit does not accept self-signed certs
    http.createServer((req, res) => {
      // Verification
      if (req.method === 'GET') {
        if (querystring.parse(url.parse(req.url).query).verify === credentials.subscriptionVerification) {
          res.writeHead(204)
          res.end()
        } else {
          res.writeHead(404)
          res.end()
        }
      }
      // Receiving subscription notification
      if (req.method === 'POST') {
        // Immediately respond to the subscription notification to satisfy Fitbit
        res.writeHead(204)
        res.end()
        // Since we only have one subscription, we don't have to look at the request body to know what notification this is
        cb()
      }
    }).listen(8080)
  },
  initSubscription: () => {
    const subscriptionId = 1
    refresh((err) => {
      if (err) return console.log(err)
      // This appears to be an idempotent request
      addSubscription(`/sleep/apiSubscriptions/${subscriptionId}.json`, () => console.log('done'))
      // List active subscriptions
      // get(`/sleep/apiSubscriptions.json`, cb)
    })
  }
}


if (require.main === module) {
  module.exports.startAuthServer()
  // module.exports.initSubscription()
}
