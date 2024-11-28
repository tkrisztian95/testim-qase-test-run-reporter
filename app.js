// SPDX-FileCopyrightText: Copyright (c) 2024 Krisztian Toth & Acrolinx GmbH
// SPDX-License-Identifier: GPL-3.0-or-later
const schedule = require('node-schedule');
const axios = require('axios');
const helpers = require('./helpers.js')
const logger = require('pino')()

/*
* Store Testim execution ids that are processed.
* The test run results successfully reported to Qase.
*/
const done = []

// -------- Environment variables
// Defaults
const DEFAULT_CRON_SCHEDULE = '0 7-21 * * 1-5'; // run sync every hour from 7:00 to 20:59 at minute 0 on every day-of-week from Monday through Friday
// Required
const TESTIM_APIKEY = process.env.TESTIM_APIKEY
const QASE_APIKEY = process.env.QASE_APIKEY
// Optional
const RUN_ONCE_ON_START = process.env.RUN_ONCE_ON_START || true
const OVERRIDE_CRON_SCHEDULE = process.env.OVERRIDE_CRON_SCHEDULE

// -------- API Requests
async function getAllTestsFromTestim() {
  try {
    const response = await axios.get('https://api.testim.io/tests', {
      headers: {
        'Authorization': 'Bearer ' + TESTIM_APIKEY,
        'Accept': 'application/json',
      }, timeout: 5000
    }).catch(error => {
      logger.error(error, "Error with API request in getAllTestsFromTestim() for listing all Testim tests!");
    })

    if (!response) {
      return []
    }

    return response.data.tests
  } catch (err) {
    logger.error(err);
  }
}

async function getExecutionsFromTestim() {
  try {
    const response = await axios.get('https://api.testim.io/runs/executions', {
      headers: {
        'Authorization': 'Bearer ' + TESTIM_APIKEY,
        'Accept': 'application/json',
      }, timeout: 5000
    }).catch(error => {
      logger.error(error, "Error with API request in getAllTestsFromTestim() for listing all Testim tests!");
    })

    if (!response) {
      return []
    }

    return response.data.executions
  } catch (err) {
    logger.error(err);
  }
}

async function pollExecutionDetailsFromTestim(executionId) {
  try {
    const response = await axios.get('https://api.testim.io/v2/runs/executions/' + executionId, {
      headers: {
        'Authorization': 'Bearer ' + TESTIM_APIKEY,
        'Accept': 'application/json',
      }, timeout: 3000
    }).catch(error => {
      logger.error(error, "Error with API request in pollExecutionDetailsFromTestim()!");
    })

    if (!response) {
      return
    }

    return response.data.execution
  } catch (err) {
    logger.error(err);
  }
}

async function createTestRunInQase(projectCode, execution, testCaseIds) {
  try {
    const response = await axios.post('https://api.qase.io/v1/run/' + projectCode, {
      "title": "[Testim | " + execution.source + " | " + execution.branch + "] - " + execution.execution,
      "description": "[Click this link to jump to the execution page in Testim](" + execution.link + ")",
      "is_autotest": true,
      "start_time": helpers.formatDateToYMDHIS(execution.startTime),
      "cases": testCaseIds
    }, {
      headers: {
        'Token': QASE_APIKEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }, timeout: 3000
    })
    return response.data.result.id
  } catch (err) {
    logger.error(err, 'Error with API request in createTestRunInQase()');
  }
}

async function createTestCaseRunResultInQase(projectCode, runId, test, caseId) {
  try {
    const response = await axios.post('https://api.qase.io/v1/result/' + projectCode + '/' + runId, {
      "case_id": caseId,
      "status": test.executionStatus.toLowerCase(),
      "time_ms": test.duration,
    }, {
      headers: {
        'Token': QASE_APIKEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }, timeout: 3000
    })
    return response.data.result.hash
  } catch (err) {
    logger.error(err, 'Error with API request in createTestCaseRunResultInQase()');
  }
}

async function completeTestRunResultInQase(projectCode, runId) {
  try {
    const response = await axios.post('https://api.qase.io/v1/result/' + projectCode + '/' + runId + '/complete', null, {
      headers: {
        'Token': QASE_APIKEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }, timeout: 3000
    })
    return response.data.result.hash
  } catch (err) {
    logger.error(err);
  }
}

// -------- Sync job
async function syncTestimWithQase() {
  try {
    const allTests = await getAllTestsFromTestim();
    if (!allTests || allTests.length === 0) {
      logger.info("Skipping sync because there is no information about Testim tests!")
      return;
    }

    const executions = await getExecutionsFromTestim();
    if (!executions || executions.length === 0) {
      logger.info("Skipping sync because there is no information about Testim test executions!")
      return;
    }

    logger.info('There are \'' + executions.length + '\' executions found in Testim for today!')

    for (let idx = 0; idx < executions.length; idx++) {
      const executionId = executions[idx].executionId
      if (done.includes(executionId)) {
        logger.info('Skipping Testim execution with id \'' + executionId + '\' because its already processed!')
        continue
      }
      if (executions[idx].executionResult === 'RUNNING') {
        logger.info('Skipping Testim execution with id \'' + executionId + '\' because its currently running!')
        continue
      }
      // executions[idx].resultLables[] contains qase/{projectCode}
      const isLabelled = executions[idx].resultLabels.some(l => l.startsWith('qase/'))
      if (!isLabelled) {
        logger.info('Skipping Testim execution with id \'' + executionId + '\' because its not linked to any project in Qase! Add result label with \'--result-label qase/{projectCode}\' to the CLI command...')
        continue
      }
      const projectCode = executions[idx].resultLabels.filter(l => l.startsWith('qase/'))[0].split('/')[1]

      const child = logger.child({ executionId })
      child.info('Processing Testim execution')

      const execution = await pollExecutionDetailsFromTestim(executionId)

      if (!execution) {
        logger.info('Skipping Testim execution with id \'' + executionId + '\' because there execution details are missing, failed poll!')
        continue
      }

      logger.info('Creating test run in Qase project \'' + projectCode + '\' for Testim execution with id \'' + executionId + '\'')

      if (!execution.tests) {
        const child = logger.child({ execution })
        child.info('Skipping Testim execution with id \'' + executionId + '\' because tests are undefinied!')
        continue
      }

      // Gather tests data from executtion with labels
      const testIds = execution.tests.map(t => t.id)
      const testsInExecution = allTests.filter(t => testIds.includes(t._id))
      const testsInExecutionWithLabel = testsInExecution.filter(t => t.labels.some(l => l.startsWith("qase/" + projectCode + "-")))
      child = logger.child({ testsInExecutionWithLabel })
      child.info('There are \'' + testsInExecutionWithLabel.length + '\' tests in the Testim execution \'' + executionId + '\' linked to test cases in the Qase \'' + projectCode + '\' project!')
      const testCaseLabels = testsInExecutionWithLabel.map(t => t.labels.filter(l => l.startsWith("qase/" + projectCode + "-"))[0])
      const testCaseIds = testCaseLabels.map(l => parseInt(l.split('-')[1], 10))

      // Create test run for test execution
      const runId = await createTestRunInQase(projectCode, execution, testCaseIds)
      logger.info('Successfully created test run in Qase for execution with id \'' + executionId + '\' (open https://app.qase.io/run/' + projectCode + '/dashboard/' + runId + ')')
      done.push(executionId)

      // Create test run results for each tests from the execution
      for (const test of testsInExecution) {
        const matchingLabels = test.labels.filter(l => l.startsWith("qase/" + projectCode + "-"))
        if (matchingLabels.length === 1) {
          child = logger.child({ matchingLabels })
          logger.console.warn('Test \'' + test._id + '\' in Testim must have exactly one label for linking with a test case in Qase!')
          continue
        }
        const testCaseId = parseInt(matchingLabels[0].split('-')[1])
        const testResult = execution.tests.filter(t => t.id === test._id)[0]
        const child = logger.child({ test, testResult })
        child.info('Processing test \'' + test._id + '\' result \'' + testResult.resultId + '\' from Testim execution \'' + executionId + '\'')
        const hash = await createTestCaseRunResultInQase(projectCode, runId, testResult, testCaseId)
        if (hash) {
          logger.info('Successfully created test case run result for \'' + projectCode + '-' + testCaseId + '\' in Qase test run with id \'' + runId + '\' (' + testResult.executionStatus.toLowerCase() + ')')
        }
      };
    }
  } catch (error) {
    logger.error(error, 'Error')
  }
}

const run = async () => {
  logger.info("Hello from Testim to Qase test run reporter!")
  try {

    if (RUN_ONCE_ON_START) {
      syncTestimWithQase();
    }

    let cron = DEFAULT_CRON_SCHEDULE;
    if (OVERRIDE_CRON_SCHEDULE) {
      cron = OVERRIDE_CRON_SCHEDULE;
      logger.info('Override the default cron schedule with \'' + OVERRIDE_CRON_SCHEDULE + '\' for scheduling the sync job!')
    }
    schedule.scheduleJob(cron, syncTestimWithQase);
  } catch (error) {
    logger.error(error, 'Error');
  }
};
run();