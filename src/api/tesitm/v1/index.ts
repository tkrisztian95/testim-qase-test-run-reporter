
import axios from "axios";
import logger from "../../../logger";

interface Execution {
  execution: string,
  executionId: string,
  executionResult: 'PASSED' | 'FAILED' | 'RUNNING',
  duration: number,
  totalTests: number,
  failedCount: number,
  concurrency: number,
  branch: string,
  browser: Array<string>,
  startTime: Date,
  turboMode: boolean,
  resultLabels: Array<string>,
  link: string
}

type Executions = {
  executions: Array<Execution>
}

interface Paged {
  totalRecords: number,
  page: number,
  pageSize: number,
}

type GetExecutionsResponse = Paged & Executions;

export const getExecutionsToday = async (): Promise<Array<Execution> | undefined> => {
  try {
    const response = await axios.get<GetExecutionsResponse>('https://api.testim.io/runs/executions', {
      headers: {
        'Authorization': 'Bearer ' + process.env.TESTIM_APIKEY,
        'Accept': 'application/json',
      }, timeout: 5000
    }).catch(error => {
      logger.error(error, "Error with API request in getAllTestsFromTestim() for listing all Testim tests!");
    })

    if (!response) {
      return;
    }

    return response.data.executions;
  } catch (err) {
    logger.error(err);
  }
}

interface Test {
  _id: string,
  name: string,
  labels: Array<string>
}

export const getAllTests = async (): Promise<Array<Test> | undefined> => {
  try {
    const response = await axios.get('https://api.testim.io/tests', {
      headers: {
        'Authorization': 'Bearer ' + process.env.TESTIM_APIKEY,
        'Accept': 'application/json',
      }, timeout: 5000
    }).catch(error => {
      logger.error(error, "Error with API request in getAllTestsFromTestim() for listing all Testim tests!");
    })

    if (!response) {
      return []
    }

    const tests: Array<Test> = response.data.tests;
    return tests;
  } catch (err) {
    logger.error(err);
  }
}