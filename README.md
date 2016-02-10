# Fitbit sleep to Google Calendar

Pulls sleep data from Fitbit and creates a Google Calendar event.

The time in `()` is total time in bed, and `<>` is total sleep time, as calculated by Fitbit.

![Sleep event example](https://raw.github.com/ViktorQvarfordt/fitbit-sleep-to-google-calendar/master/sleep-event-example.png)


## Usage

Create a plaintext file `lastrun.date` with content being a UTC date string, e.g. `2016-02-09T02:52:00.000Z`. Sleep data will be pulled starting with this date. On successful execution `lastrun.date` is automatically updated.

```
node fitbit-sleep-to-google-calendar.js
```

Configure API credentials for Fitbit and Google: See the code.
