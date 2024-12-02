import axios from "axios";
import logger from "../../logger";
import { formatDateToYMDHIS } from '../../helpers.js';

const createTestRun = async (projectCode: string, execution: any, testCaseIds: Array<number>): Promise<string | undefined> => {
  try {
    const response = await axios.post('https://api.qase.io/v1/run/' + projectCode, {
      "title": "[Testim | " + execution.source + " | " + execution.branch + "] - " + execution.execution,
      "description": "[Click this link to jump to the execution page in Testim](" + execution.link + ")",
      "is_autotest": true,
      "start_time": formatDateToYMDHIS(execution.startTime),
      "cases": testCaseIds
    }, {
      headers: {
        'Token': process.env.QASE_APIKEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }, timeout: 3000
    })
    return response.data.result.id
  } catch (err) {
    logger.error('Error with API request in createTestRunInQase()');
    if (axios.isAxiosError(err)) {
      logger.error('error message: ' + err.message);
      return;
    } else {
      logger.error(err, 'unexpected error: ');
      return;
    }
  }
}

const createTestCaseRunResult = async (projectCode: string, runId: number | string, test: any, caseId: number): Promise<string | undefined> => {
  try {
    const response = await axios.post('https://api.qase.io/v1/result/' + projectCode + '/' + runId, {
      "case_id": caseId,
      "status": test.executionStatus.toLowerCase(),
      "time_ms": test.duration,
    }, {
      headers: {
        'Token': process.env.QASE_APIKEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }, timeout: 3000
    })
    return response.data.result.hash
  } catch (err) {
    logger.error(err, 'Error with API request in createTestCaseRunResult()');
  }
}

const completeTestRunResult = async (projectCode: string, runId: number): Promise<string | undefined> => {
  try {
    const response = await axios.post('https://api.qase.io/v1/result/' + projectCode + '/' + runId + '/complete', null, {
      headers: {
        'Token': process.env.QASE_APIKEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }, timeout: 3000
    })
    return response.data.result.hash
  } catch (err) {
    logger.error(err);
  }
}

export default { createTestRunInQase: createTestRun, createTestCaseRunResultInQase: createTestCaseRunResult, completeTestRunResultInQase: completeTestRunResult }