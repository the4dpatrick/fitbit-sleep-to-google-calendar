# Fitbit sleep to Google Calendar

Fitbit sends push notification when new sleep is logged → create Google Calendar event.

"(5h 34m)" is total time in bed and "\<5h 17m\>" is total sleep time, as calculated by Fitbit.

![Sleep event example](https://raw.github.com/ViktorQvarfordt/fitbit-sleep-to-google-calendar/master/sleep-event-example.png)


## Usage

Configure API credentials for Fitbit and Google: See the code.


### First time: Get credentials

Authenticate user by running:

```
node fitbit-interface.js
```

and doing as it says. Access tokens have now been acquired with which the program can run autonomously, and push notifications have been initiated.


### Automatic sleep log synchronization

Start the server:

```
node fitbit-sleep-to-google-calendar.js
```

When it receives a posh notification, it pulls todays sleep data and creates a calendar event.


### 'Manual' sleep log synchronization (no push notifications)

Create calendar events for all sleep events from `2015-12-31` to current date:

```
node fitbit-sleep-to-google-calendar.js 2015-12-31
```

*Duplicate events are never created.*
