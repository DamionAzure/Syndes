#!/usr/bin/env node
// Read-only Data API contract check. Tokens and synthetic fixture IDs are
// supplied at run time; this file never provisions Accounts or writes Modules.
import assert from 'node:assert/strict';

const mode = process.argv[2] ?? 'anon';
if (!['anon', 'matrix'].includes(mode)) {
  throw new Error('Usage: node supabase/tests/data-api-access.mjs [anon|matrix]');
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const url = new URL(required('NEXT_PUBLIC_SUPABASE_URL'));
assert.ok(
  url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)),
  'Supabase URL must use HTTPS, except for localhost',
);
const key = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');

async function apiGet(path, token) {
  const headers = { apikey: key, Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(new URL(`/rest/v1/${path}`, url), {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

function subject(token, label) {
  const parts = token.split('.');
  assert.equal(parts.length, 3, `${label} must be a JWT access token`);
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  assert.match(claims.sub ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    `${label} must have a subject`);
  assert.ok(claims.exp * 1000 > Date.now(), `${label} has expired`);
  return claims;
}

async function access(token, label, expected) {
  const result = await apiGet('rpc/current_account_access', token);
  assert.equal(result.status, 200, `${label} RPC returned HTTP ${result.status}`);
  assert.ok(result.body && typeof result.body === 'object', `${label} RPC must return one object`);
  assert.ok(!Array.isArray(result.body), `${label} RPC returned an array`);
  assert.equal(result.body.account_id, subject(token, label).sub, `${label} RPC returned a different Account`);
  for (const [field, value] of Object.entries(expected)) {
    assert.equal(result.body[field], value, `${label} ${field} mismatch`);
  }
}

function fixtureId(name) {
  const id = required(name);
  assert.match(id, /^[A-Za-z0-9_-]+$/, `${name} must be a synthetic Module id`);
  return id;
}

async function moduleRow(token, label, id, visible, owner) {
  const query = new URLSearchParams({ select: 'id,owner,published', id: `eq.${id}` });
  const result = await apiGet(`modules?${query}`, token);
  assert.equal(result.status, 200, `${label} Module read returned HTTP ${result.status}`);
  assert.ok(Array.isArray(result.body), `${label} Module read did not return an array`);
  assert.equal(result.body.length, visible ? 1 : 0, `${label} visibility for ${id} mismatch`);
  if (visible) {
    assert.equal(result.body[0].id, id, `${label} received the wrong Module`);
    if (owner) assert.equal(result.body[0].owner, owner, `${label} fixture owner mismatch`);
  }
  return visible ? result.body[0] : null;
}

// An anonymous request must be rejected at the Data API grant boundary. A 200
// with an empty result is insufficient evidence when the table is empty.
const anon = await apiGet('modules?select=id&limit=1');
assert.ok([401, 403].includes(anon.status), `anonymous Module read returned HTTP ${anon.status}`);
console.log('ok: anonymous Module read denied');

if (mode === 'matrix') {
  const tokens = {
    pending: required('SYNDES_TEST_PENDING_TOKEN'),
    student: required('SYNDES_TEST_STUDENT_TOKEN'),
    teacher: required('SYNDES_TEST_TEACHER_TOKEN'),
    administrator: required('SYNDES_TEST_ADMIN_TOKEN'),
    revoked: required('SYNDES_TEST_REVOKED_TOKEN'),
  };
  const ids = {
    published: fixtureId('SYNDES_TEST_PUBLISHED_MODULE_ID'),
    teacher: fixtureId('SYNDES_TEST_TEACHER_MODULE_ID'),
    administrator: fixtureId('SYNDES_TEST_ADMIN_MODULE_ID'),
    revoked: fixtureId('SYNDES_TEST_REVOKED_MODULE_ID'),
  };
  assert.equal(new Set(Object.values(ids)).size, 4, 'fixture Module ids must be distinct');
  assert.equal(new Set(Object.entries(tokens).map(([label, token]) => subject(token, label).sub)).size, 5,
    'test tokens must belong to five distinct Accounts');

  await access(tokens.pending, 'Pending', { role: 'Student', approved: false, active: true });
  await access(tokens.student, 'Student', { role: 'Student', approved: true, active: true });
  await access(tokens.teacher, 'Teacher', { role: 'Teacher', approved: true, active: true });
  await access(tokens.administrator, 'Administrator', { role: 'Administrator', approved: true, active: true });
  await access(tokens.revoked, 'revoked Account', { active: false });

  const staleClaims = subject(tokens.revoked, 'revoked Account');
  assert.ok(staleClaims.app_metadata?.approved === true ||
    ['Teacher', 'Administrator'].includes(staleClaims.app_metadata?.role),
    'revoked token needs stale approved or privileged app_metadata to prove stale-token revocation');

  const publicRow = await moduleRow(tokens.student, 'Student', ids.published, true);
  assert.equal(publicRow.published, true, 'published fixture must be published');
  const teacherRow = await moduleRow(tokens.teacher, 'Teacher', ids.teacher, true,
    subject(tokens.teacher, 'Teacher').sub);
  assert.equal(teacherRow.published, false, 'Teacher fixture must be unpublished');
  const adminRow = await moduleRow(tokens.administrator, 'Administrator', ids.administrator, true,
    subject(tokens.administrator, 'Administrator').sub);
  assert.equal(adminRow.published, false, 'Administrator fixture must be unpublished');
  const retainedRow = await moduleRow(tokens.student, 'Student', ids.revoked, true,
    subject(tokens.revoked, 'revoked Account').sub);
  assert.equal(retainedRow.published, true, 'revoked Account fixture must remain published');

  const probes = [
    ['Pending', tokens.pending, [false, false, false, false]],
    ['Student', tokens.student, [true, false, false, true]],
    ['Teacher', tokens.teacher, [true, true, false, true]],
    ['Administrator', tokens.administrator, [true, false, true, true]],
    ['revoked Account', tokens.revoked, [false, false, false, false]],
  ];
  for (const [label, token, visibility] of probes) {
    for (const [index, id] of Object.values(ids).entries()) {
      await moduleRow(token, label, id, visibility[index]);
    }
  }
  console.log('ok: Pending, Student, Teacher, Administrator, and stale-token revocation matrix');
}
