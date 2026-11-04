import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnv } from './env.validation';

const base = {
  DATABASE_HOST: 'localhost',
  DATABASE_NAME: 'asteai',
  DATABASE_USER: 'asteai_app',
  DATABASE_PASSWORD: 'secret',
  JWT_SECRET: 'x'.repeat(40),
};

describe('validateEnv', () => {
  it('accepts a minimal valid environment and returns it unchanged', () => {
    const env = { ...base, PORT: '3001', EXTRA: 'kept' };
    assert.deepEqual(validateEnv(env), env);
  });

  it('lists every missing required variable at once', () => {
    assert.throws(() => validateEnv({}), (err: Error) =>
      ['DATABASE_HOST', 'DATABASE_NAME', 'DATABASE_USER', 'DATABASE_PASSWORD', 'JWT_SECRET']
        .every((name) => err.message.includes(name)));
  });

  it('treats empty strings as unset', () => {
    assert.throws(() => validateEnv({ ...base, JWT_SECRET: '' }), /JWT_SECRET/);
  });

  it('rejects a short JWT_SECRET', () => {
    assert.throws(() => validateEnv({ ...base, JWT_SECRET: 'short' }), /at least 32/);
  });

  it('needs AWS_REGION but no password with IAM auth', () => {
    const iam = { ...base, DATABASE_IAM_AUTH: 'true', DATABASE_PASSWORD: '' };
    assert.throws(() => validateEnv(iam), /AWS_REGION/);
    assert.doesNotThrow(() => validateEnv({ ...iam, AWS_REGION: 'ap-south-1' }));
  });

  it('rejects non-numeric ports', () => {
    assert.throws(() => validateEnv({ ...base, PORT: 'eighty' }), /PORT/);
  });

  it('refuses an AI_JWT_SECRET equal to JWT_SECRET', () => {
    assert.throws(() => validateEnv({ ...base, AI_JWT_SECRET: base.JWT_SECRET }), /must differ/);
  });

  it('refuses the .env.example JWT_SECRET in production', () => {
    const env = { ...base, NODE_ENV: 'production', JWT_SECRET: 'replace_with_64_char_random_secret' };
    assert.throws(() => validateEnv(env), /placeholder/);
  });

  it('needs a sender and region to send through SES', () => {
    assert.throws(() => validateEnv({ ...base, EMAIL_TRANSPORT: 'ses' }), (err: Error) =>
      /EMAIL_FROM/.test(err.message) && /AWS_REGION/.test(err.message));
    assert.doesNotThrow(() => validateEnv({ ...base, EMAIL_TRANSPORT: 'ses', EMAIL_FROM: 'AsteAI <no-reply@asteai.com>', AWS_REGION: 'ap-south-1' }));
    assert.throws(() => validateEnv({ ...base, EMAIL_TRANSPORT: 'smtp' }), /EMAIL_TRANSPORT/);
  });
});

