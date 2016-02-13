'use strict'

const fs = require('fs')
const nodemailer = require('nodemailer')
const fitbit = require('./fitbit-interface')
const createEvent = require('./google-calendar-interface').createEvent
const calendarId = JSON.parse(fs.readFileSync(`${process.env.HOME}/.secrets/google-calendar-ids.json`)).fitbit


// Run 'manual'
if (process.argv[2]) {
  const now = new Date()
  let date = new Date(process.argv[2])
  fitbit.refreshToken(err => {
    if (err) return errorHandler(err)
    while (date < now) {
      console.log(`Fetching sleep event from: ${date.toISOString().substr(0, 10)}`)
      fitbitToGoogle(date.toISOString().substr(0, 10))
      date.setDate(date.getDate() + 1)
    }
  })
}
// Run 'automatic'
else {
  fitbit.onNotification(() => {
    console.log('Received notification')
    fitbit.refreshToken(err => {
      if (err) return errorHandler(err)
      console.log(`Fetching sleep events from today`)
      fitbitToGoogle(new Date().toISOString().substr(0, 10))
    })
  })
  console.log('Listening for sleep event push notifications')
}


function fitbitToGoogle(dateString) {
  fitbit.getSleep(dateString, (err, sleepEvents) => {
    if (err) return errorHandler(err)
    let success = true
    for (let e of sleepEvents) {
      createEvent(calendarId, `(${e.totalDuration}) <${e.sleepDuration}>`, e.start, e.end, err => {
        if (err) {
          success = false
          errorHandler(err)
          console.log(`Error creating event: ${JSON.stringify(err, null, 2)}`)
        } else {
          console.log(`Created event: '(${e.totalDuration}) <${e.sleepDuration}>' at ${e.start.toISOString()}–${e.end.toISOString()}`)
        }
      })
    }
  })
}


// Report errors by email and to error.log

const credentials = JSON.parse(fs.readFileSync(`${process.env.HOME}/.secrets/credentials.json`))

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: credentials.gmailNotifier.user,
    pass: credentials.gmailNotifier.pass
  }
})

function log(msg) {
  msg = `${(new Date()).toISOString()} ${msg}`
  console.log(msg)
  fs.appendFile(`${__dirname}/error.log`, `${msg}\n`)
}

function sendmail(from, subject, text) {
  transporter.sendMail({
    from: `${from} <${credentials.gmailNotifier.user}>`,
    to: credentials.gmail.user,
    subject: subject,
    text: text,
  }, err => {
    if (err) log(`SENDMAIL ERROR: ${JSON.stringify(err, null, 2)}`)
  })
}

function errorHandler(err, cb) {
  if (!err) return
  log(`ERROR: ${JSON.stringify(err, null, 2)}`)
  sendmail('Fitbit sleep log', 'Error', JSON.stringify(err, null, 2))
}
