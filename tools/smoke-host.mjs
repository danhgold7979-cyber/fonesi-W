const origin = process.argv[2] ?? 'http://127.0.0.1:4173';
const url = new URL(origin);
if (url.hostname !== '127.0.0.1')
  throw new Error('Smoke host must use the local authoring service');
const health = await fetch(origin + '/health');
if (!health.ok || !(await health.json()).ok) throw new Error('Database health request failed');
const response = await fetch(origin);
if (!response.ok) throw new Error('Renderer HTML is unavailable');
const html = await response.text();
const token = /name="studio-token" content="([a-f0-9]+)"/.exec(html)?.[1];
if (!token) throw new Error('Session token was not injected');
const result = await fetch(origin + '/api', {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Studio-Token': token },
  body: JSON.stringify({ command: 'bootstrap', input: {}, operationId: 'op_smoke' }),
});
const body = await result.json();
if (
  !result.ok ||
  !body.ok ||
  !Array.isArray(body.value.apps) ||
  !Array.isArray(body.value.workflows) ||
  !Array.isArray(body.value.processes)
)
  throw new Error('Functional bootstrap request failed');
console.log(
  JSON.stringify({
    scope: 'LOCAL_AUTHORING_HOST_READINESS',
    status: 'PASS',
    database: 'ready',
    catalogAvailable: true,
    rendererAvailable: true,
  }),
);
