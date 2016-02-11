// The variable 'credentials' should contain client_id, user_id, redirect_url.
// Acquire access_token and refresh_token by startServer() and visit /auth/fitbit with the browser.

'use strict'

const fs = require('fs')
const url = require('url')
const https = require('https')
const querystring = require('querystring')


const credentials = JSON.parse(fs.readFileSync(`${process.env.HOME}/.secrets/fitbit-credentials.json`))
let profile

function authenticate(code, cb) {
  post(`grant_type=authorization_code&code=${code}&client_id=${credentials.client_id}&redirect_uri=${credentials.redirect_uri}`, cb)
}

function refresh(cb) {
  post(`grant_type=refresh_token&refresh_token=${credentials.refresh_token}`, cb)
}

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

function post(body, cb) {
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
      fs.writeFile(`${process.env.HOME}/.secrets/fitbit-credentials.json`, JSON.stringify(credentials, null, 2), cb)
    })
  })
  req.on('error', err => cb(err))
  req.write(body)
  req.end()
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
  // Start a small server through which user can authenticate.
  // This is only required once, afterwards the access tokens are used.
  startServer: () => {
    https.createServer({
      key: fs.readFileSync(`${process.env.HOME}/.secrets/ssl/key.pem`),
      cert: fs.readFileSync(`${process.env.HOME}/.secrets/ssl/cert.pem`)
    }, (req, res) => {
      if (req.url === '/auth/fitbit') {
        res.writeHead(302, { 'Location': `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${credentials.client_id}&redirect_uri=${credentials.redirect_uri}&scope=sleep%20profile%20activity` }); res.end()
      } else if (url.parse(req.url).pathname === '/auth/fitbit/callback') {
        authenticate(querystring.parse(url.parse(req.url).query).code, () => res.end('authenticated'))
      } else {
        res.statusCode = 404; res.end()
      }
    }).listen(3001, () => console.log('https://localhost:3001'))
  }
}


if (require.main === module) {
  module.exports.startServer()
}
