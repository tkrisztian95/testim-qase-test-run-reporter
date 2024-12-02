// SPDX-FileCopyrightText: Copyright (c) 2024 Krisztian Toth & Acrolinx GmbH
// SPDX-License-Identifier: GPL-3.0-or-later
import { scheduleJob } from 'node-schedule';
import tesitm from './api/tesitm';
import qase from './api/qase';
import logger from './logger';

/*
* Store Testim execution ids that are processed.
* The test run results successfully reported to Qase.
*/
const done: Array<string> = [];

// -------- Environment variables
// Defaults
const DEFAULT_CRON_SCHEDULE = '0 7-21 * * 1-5'; // run sync every hour from 7:00 to 20:59 at minute 0 on every day-of-week from Monday through Friday
// Required
const TESTIM_APIKEY = process.env.TESTIM_APIKEY;
const QASE_APIKEY = process.env.QASE_APIKEY;
// Optional
const RUN_ONCE_ON_START = process.env.RUN_ONCE_ON_START || true;
const OVERRIDE_CRON_SCHEDULE = process.env.OVERRIDE_CRON_SCHEDULE;

// -------- Sync job
async function syncTestimWithQase() {
  try {
    const allTests = await tesitm.v1.getAllTests();
    if (!allTests || allTests.length === 0) {
      logger.info("Skipping sync because there is no information about Testim tests!")
      return;
    }

    const executions = await tesitm.v1.getExecutionsToday();
    if (!executions || executions.length === 0) {
      logger.info("Skipping sync because there is no information about Testim test executions!")
      return;
    }

    logger.info('There are \'' + executions.length + '\' executions found in Testim for today yet!')

    for (const element of executions) {
      const executionId = element.executionId;
      if (done.includes(executionId)) {
        logger.info('Skipping Testim execution with id \'' + executionId + '\' because its already processed!')
        continue
      }
      if (element.executionResult === 'RUNNING') {
        logger.info('Skipping Testim execution with id \'' + executionId + '\' because its currently running!')
        continue
      }
      // contains qase/{projectCode}
      const isLabelled = element.resultLabels.some(l => l.startsWith('qase/'))
      if (!isLabelled) {
        logger.info('Skipping Testim execution with id \'' + executionId + '\' because its not linked to any project in Qase! Add result label with \'--result-label qase/{projectCode}\' to the CLI command...')
        continue
      }
      const projectCode = element.resultLabels.filter(l => l.startsWith('qase/'))[0].split('/')[1]

      let child = logger.child({ executionId })
      child.info('Processing Testim execution with id \'' + executionId + '\'')

      const details = await tesitm.v2.pollExecutionDetails(executionId);

      if (!details) {
        logger.info('Skipping Testim execution with id \'' + executionId + '\' because there execution details are missing, failed poll!')
        continue
      }

      logger.info('Creating test run in Qase project \'' + projectCode + '\' for Testim execution with id \'' + executionId + '\'')

      if (!details.tests) {
        logger.child({ execution: details }).info('Skipping Testim execution with id \'' + executionId + '\' because tests are undefinied!')
        continue
      }

      // Gather tests data from executtion with labels
      const testIds = details.tests.map(t => t.id)
      const testsInExecution = allTests.filter(t => testIds.includes(t._id))
      const testsInExecutionWithLabel = testsInExecution.filter(t => t.labels.some(l => l.startsWith("qase/" + projectCode + "-")))
      logger.child({ testsInExecutionWithLabel }).info('There are \'' + testsInExecutionWithLabel.length + '\' tests in the Testim execution \'' + executionId + '\' linked to test cases in the Qase \'' + projectCode + '\' project!')
      const testCaseLabels = testsInExecutionWithLabel.map(t => t.labels.filter(l => l.startsWith("qase/" + projectCode + "-"))[0])
      const testCaseIds = testCaseLabels.map(l => parseInt(l.split('-')[1], 10))

      // Create test run for test execution
      const runId = await qase.createTestRunInQase(projectCode, details, testCaseIds)

      if (runId) {

        logger.info('Successfully created test run in Qase for execution with id \'' + executionId + '\' (open https://app.qase.io/run/' + projectCode + '/dashboard/' + runId + ')')

        // Create test run results for each tests from the execution
        for (const test of testsInExecution) {
          const matchingLabels = test.labels.filter(l => l.startsWith("qase/" + projectCode + "-"))
          if (matchingLabels.length === 0) {
            continue // skip
          }
          if (matchingLabels.length > 1) {
            logger.child({ matchingLabels }).warn('Test \'' + test._id + '\' in Testim must have exactly one label for linking with a test case in Qase!')
            continue
          }
          const testCaseId = parseInt(matchingLabels[0].split('-')[1])
          const testResult = details.tests.filter(t => t.id === test._id)[0]
          const child = logger.child({ test, testResult })
          child.info('Processing test \'' + test._id + '\' result \'' + testResult.resultId + '\' from Testim execution \'' + executionId + '\'')
          const hash = await qase.createTestCaseRunResultInQase(projectCode, runId, testResult, testCaseId)
          if (hash) {
            logger.info('Successfully created test case run result for \'' + projectCode + '-' + testCaseId + '\' in Qase test run with id \'' + runId + '\' (' + testResult.executionStatus.toLowerCase() + ')')
          } else {
            logger.error('Cannot create test case run result for \'' + projectCode + '-' + testCaseId + '\' in Qase. The hash returned is undefinied!');
          }
        };

        done.push(executionId)
      } else {
        logger.error('Cannot create test run in Qase for the execution' + element + '. The runId returned is undefinied!');
      }
    }
  } catch (error) {
    logger.error(error, 'Error')
  }
}

const run = async () => {
  logger.info("Hello from Testim to Qase test run reporter! 👋")

  if (!TESTIM_APIKEY) {
    logger.error("The environment variable 'TESTIM_APIKEY' is missing. Please set before start...");
    process.exit(1);
  }

  if (!QASE_APIKEY) {
    logger.error("The environment variable 'QASE_APIKEY' is missing. Please set before start...");
    process.exit(1);
  }

  try {

    if (RUN_ONCE_ON_START) {
      syncTestimWithQase();
    }

    let cron = DEFAULT_CRON_SCHEDULE;
    if (OVERRIDE_CRON_SCHEDULE) {
      cron = OVERRIDE_CRON_SCHEDULE;
      logger.info('Override the default cron schedule with \'' + OVERRIDE_CRON_SCHEDULE + '\' for scheduling the sync job!')
    }
    scheduleJob(cron, syncTestimWithQase);
  } catch (error) {
    logger.error(error, 'Error');
  }
};
run();