'use strict'

const fs = require('fs')
const nodemailer = require('nodemailer')
const getSleep = require('./fitbit-interface').getSleep
const createEvent = require('./google-calendar-interface').createEvent


const lastrun = new Date(fs.readFileSync(`${__dirname}/lastrun.date`, 'utf8').replace(/\s/g, ''))
const thisrun = new Date()
const date = new Date(lastrun)
const calendarId = JSON.parse(fs.readFileSync(`${process.env.HOME}/.secrets/google-calendar-ids.json`)).fitbit

while (date < thisrun) {
  console.log(`Fetching sleep from: ${date.toISOString().substr(0, 10)}`)
  fitbitToGoogle(date.toISOString().substr(0, 10))
  date.setDate(date.getDate() + 1)
}

function fitbitToGoogle(dateString) {
  getSleep(dateString, (err, sleepEvents) => {
    if (err) return errorHandler(err)
    let success = true
    for (let e of sleepEvents) {
      if (e.start > lastrun) {
        createEvent(calendarId, `(${e.totalDuration}) <${e.sleepDuration}>`, e.start, e.end, err => {
          if (err) {
            success = false
            errorHandler(err)
            console.log(`Error creating event: ${JSON.stringify(err, null, 2)}`)
          } else {
            console.log(`Created sleep event: ${e.start.toISOString()}–${e.end.toISOString()} (${e.totalDuration}) <${e.sleepDuration}>`)
          }
          // If all events were successfully created, update lastrun accordingly
          if (e === sleepEvents[sleepEvents.length - 1] && success) {
            fs.writeFile(`${__dirname}/lastrun.date`, e.start.toISOString())
          }
        })
      } else {
        console.log(`Found existing sleep event: ${dateString}`)
      }
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
  fs.appendFile(`${__dirname}/error.log`, `${(new Date()).toISOString()} ${msg}\n`)
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
