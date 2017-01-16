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
node server.js
```

When it receives a push notification, it pulls todays sleep data and creates a calendar event.


### 'Manual' sleep log synchronization

Create calendar events for all sleep events from `2015-12-31` to current date or a until a defined date:

```
node server.js 2015-12-31
```

```
node server.js 2015-12-31 2016-12-31
```

*Duplicate events are never created.*
