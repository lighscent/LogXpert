'use strict';

/**
 * Scenario registry. Order here is the default execution order.
 */

const text = require('./text');
const structured = require('./structured');
const context = require('./context');
const json = require('./json');
const error = require('./error');
const disabled = require('./disabled');
const nested = require('./nested');
const large = require('./large');
const volume = require('./volume');

const SCENARIOS = [text, structured, context, json, error, disabled, nested, large, volume];

const BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));

function getScenario(id) {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`unknown scenario: ${id}`);
  return s;
}

module.exports = { SCENARIOS, getScenario };
