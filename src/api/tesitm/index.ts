import axios from "axios";
import logger from "../../logger";
import { getExecutionsToday, getAllTests } from './v1/index';
import { pollExecutionDetails } from './v2/index';

export default {
  v1: {
    getExecutionsToday,
    getAllTests
  },
  v2: {
    pollExecutionDetails
  }
}