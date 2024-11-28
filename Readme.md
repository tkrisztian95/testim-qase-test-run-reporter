# Report Testim test runs into Qase TMS

This application serves an integration purpose between [Testim.io](https://www.testim.io/) and [Qase.io](https://app.qase.io/). It creates test runs and results in Qase projects from the Testim test executions.

_Note: This is custom solution for a requested integration between the above mentioned systems. Also vote for feature request <https://roadmap.qase.io/feature-requests/p/testim-integration>_

In order to find matching test cases and for successful test run result creation in Qase:

**Label tests in Testim:**

- Label tests in Testim `qase/{projectCode}-{testCase}`
- Label test executions in Testim `qase/{projectCode}`

_Note: Tests and executions should have exactly one label with the `qase/` prefix. Linking multiple test cases or projects to a single test run (or suite) is currently not supported._

**Configure projects in Qase:**

In Qase configure projects `Project Settings > Test Run > Allow to add results for cases in closed runs` toggle enabled and then click `Update settings` to save changes.

_Note: Sync job is run by default from 7:00 to 20:59 in every hours (at 0 minute) on every day-of-week from Monday through Friday. Use env vars to override cron schedule._

_Disclaimer: Testim has a monthly limit on API requests, check your company limits on that before override the cron for a more frequent sync schedule._

## Running the application

Set environment variables:

using Windows PowerShell:

```PowerShell
// Required
$env:TESTIM_APIKEY="Add api key..."
$env:QASE_APIKEY="Add api key..."

// Optional
$env:CRON_SCHEDULE_OVERRIDE="*/5 * * * *"
```

using Linux shell:

```sh
// Required
export TESTIM_APIKEY="Add api key..."
export QASE_APIKEY="Add api key..."

// Optional
export CRON_SCHEDULE_OVERRIDE="*/5 * * * *"
```

_Note: Always keep your API keys secure!_

Install Node modules:

```ps
npm install
```

Start application by command:

```ps
node app.js
```

For development also use `pino-pretty`, it will format the log output:

```cmd
// Install
npm install -g pino-pretty

// Start app by command formatting the log output
node app.js | pino-pretty
```

Start the application from Docker image:

```cmd
docker run -t --rm --name testim-qase-test-run-reporter -e TESTIM_APIKEY="Add api key..." -e QASE_APIKEY="Add api key..." your.registry/testim-qase-test-run-reporter
```

## Building and deploying the application

Create a Docker image with the tag

```cmd
docker build -t your.registry/testim-qase-test-run-reporter .
```

Deploy image to the container registry:

```cmd
docker push your.registry/testim-qase-test-run-reporter
```

### License

Licensed under GNU General Public License v3.0 or later.

### Copyright

Copyright (c) 2024 Krisztian Toth & Acrolinx GmbH

**Notes:**

- This project was written at and with support from [Acrolinx](https://www.acrolinx.com/) GmbH.
- This project is not an official Acrolinx open-source package. For official Acrolinx open-source projects see the [GitHub page](https://github.com/acrolinx/) from Acrolinx.
