'use strict';
/**
 * The bridge's own environment check (native go-live spec, D6): the bridge
 * must be told which CBP environment it serves and refuses to start when its
 * queue manager or channel table belongs to the other one.
 * Run with: node --test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveBridgeEnvironment } = require('./envCheck.js');

test('derives the CERT queue manager and channel table when none are set', () => {
  const r = resolveBridgeEnvironment({ CBP_ENVIRONMENT: 'CERT' });
  assert.deepEqual(r.problems, []);
  assert.equal(r.environment, 'CERT');
  assert.equal(r.qmgr, 'QGC1');
  assert.equal(r.chltab, 'QGC1_SIGMATP.TAB');
});

test('derives the PROD queue manager and channel table when none are set', () => {
  const r = resolveBridgeEnvironment({ CBP_ENVIRONMENT: 'prod' });
  assert.deepEqual(r.problems, []);
  assert.equal(r.environment, 'PROD');
  assert.equal(r.qmgr, 'QGP2');
  assert.equal(r.chltab, 'QGP2_SIGMATP.TAB');
});

test('accepts explicit values that match the environment', () => {
  const r = resolveBridgeEnvironment({ CBP_ENVIRONMENT: 'PROD', MQ_QMGR: 'QGP2', MQCHLTAB: 'QGP2_SIGMATP.TAB' });
  assert.deepEqual(r.problems, []);
});

test('refuses to start without a CBP environment', () => {
  const r = resolveBridgeEnvironment({ MQ_QMGR: 'QGC1' });
  assert.match(r.problems.join(' '), /CBP_ENVIRONMENT/);
});

test('refuses a PROD bridge pointed at the CERT queue manager', () => {
  const r = resolveBridgeEnvironment({ CBP_ENVIRONMENT: 'PROD', MQ_QMGR: 'QGC1' });
  assert.match(r.problems.join(' '), /QGC1/);
});

test('refuses a CERT bridge pointed at the PROD queue manager', () => {
  const r = resolveBridgeEnvironment({ CBP_ENVIRONMENT: 'CERT', MQ_QMGR: 'QGP2' });
  assert.match(r.problems.join(' '), /QGP2/);
});

test('refuses a channel table that belongs to the other environment', () => {
  const r = resolveBridgeEnvironment({ CBP_ENVIRONMENT: 'PROD', MQ_QMGR: 'QGP2', MQCHLTAB: 'QGC1_SIGMATP.TAB' });
  assert.match(r.problems.join(' '), /MQCHLTAB/);
});

test('treats empty values as unset, as docker compose passes them', () => {
  const r = resolveBridgeEnvironment({ CBP_ENVIRONMENT: 'CERT', MQ_QMGR: '', MQCHLTAB: '' });
  assert.deepEqual(r.problems, []);
  assert.equal(r.qmgr, 'QGC1');
});
