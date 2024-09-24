// SPDX-FileCopyrightText: Copyright (c) 2024 Krisztian Toth & Acrolinx GmbH
// SPDX-License-Identifier: GPL-3.0-or-later

/** 
 * Return date in format `YYYY-MM-DD HH-mm-ss` 
 */
function formatDateToYMDHIS(isoDateString) {

  var options = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }

  return new Intl.DateTimeFormat('sv-SE', options).format(new Date(isoDateString))
}

module.exports.formatDateToYMDHIS = formatDateToYMDHIS