'use strict';
/**
 * Bridge-side CBP environment check (native go-live spec, D6).
 *
 * The bridge is told which CBP environment it serves (CBP_ENVIRONMENT) and
 * refuses to start when its queue manager or channel table belongs to the
 * other one (CBP MQDEF, Aug 2026: CERT = QGC1 / QGC1_SIGMATP.TAB,
 * PROD = QGP2 / QGP2_SIGMATP.TAB). When MQ_QMGR / MQCHLTAB are not set they
 * are derived from the environment, so a VM only declares CERT or PROD.
 * The server checks the same pairing from its side before every send.
 */
const QUEUE_MANAGERS = { CERT: 'QGC1', PROD: 'QGP2' };

const value = (env, name) => {
  const v = env[name];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

function resolveBridgeEnvironment(env) {
  const problems = [];
  const environment = value(env, 'CBP_ENVIRONMENT')?.toUpperCase();
  const expected = environment ? QUEUE_MANAGERS[environment] : undefined;
  if (!expected) {
    problems.push(`CBP_ENVIRONMENT must be CERT or PROD (got '${environment ?? ''}')`);
    return { problems, environment, qmgr: value(env, 'MQ_QMGR'), chltab: value(env, 'MQCHLTAB') };
  }
  const qmgr = value(env, 'MQ_QMGR') ?? expected;
  if (qmgr !== expected) {
    problems.push(`MQ_QMGR is ${qmgr}, but ${environment} requires ${expected}`);
  }
  const chltab = value(env, 'MQCHLTAB') ?? `${expected}_SIGMATP.TAB`;
  if (!chltab.startsWith(`${expected}_`)) {
    problems.push(`MQCHLTAB is ${chltab}, but ${environment} requires the ${expected} channel table`);
  }
  return { problems, environment, qmgr, chltab };
}

module.exports = { resolveBridgeEnvironment };
