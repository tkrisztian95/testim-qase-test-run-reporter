import axios from "axios";
import logger from "../../../logger";

interface Test {
  id: string,
  testName: string,
  resultId: string,
  link: string,
  executionStatus: 'Passed',
  baseUrl: string,
  startTime: Date,
  duration: number
}

interface Execution {
  id: string,
  startTime: Date,
  source: string,
  branch: string,
  tests: Array<Test>,
  execution: string,
  concurrency: number,
  turboMode: boolean,
  executionResult: 'Passed',
  browser: string,
  failedCount: number,
  totalTests: number,
  failedTestRunCount: number,
  totalTestRuns: number,
  link: string,
  duration: number,
  numberOfTestsWithRetries: number
}

type PollExecutionDetailsResponse = {
  execution: Execution
}

export const pollExecutionDetails = async (executionId: string): Promise<Execution | undefined> => {
  try {
    const response = await axios.get<PollExecutionDetailsResponse>('https://api.testim.io/v2/runs/executions/' + executionId, {
      headers: {
        'Authorization': 'Bearer ' + process.env.TESTIM_APIKEY,
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