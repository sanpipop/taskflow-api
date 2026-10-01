import net from 'node:net';
import readline from 'node:readline';

const host = process.env.NOTIFY_SMTP_HOST ?? 'host.docker.internal';
const port = Number(process.env.NOTIFY_SMTP_PORT ?? '1025');
const from = process.env.NOTIFY_EMAIL_FROM ?? 'jenkins@taskflow.local';
const to = process.env.NOTIFY_EMAIL_TO ?? 'devops@taskflow.local';
const status = process.env.NOTIFY_STATUS ?? 'UNKNOWN';
const job = process.env.JOB_NAME ?? 'taskflow-api';
const branch = process.env.BRANCH_NAME ?? 'unknown';
const buildNumber = process.env.BUILD_NUMBER ?? 'unknown';
const buildUrl = process.env.BUILD_URL ?? 'unavailable';

const socket = net.createConnection({ host, port });
const lines = readline.createInterface({ input: socket, crlfDelay: Infinity });
const responses = lines[Symbol.asyncIterator]();

async function readResponse(expectedCode) {
  while (true) {
    const { value, done } = await responses.next();
    if (done) throw new Error('SMTP connection closed unexpectedly');
    if (!/^\d{3}[ -]/.test(value)) continue;
    if (/^\d{3}-/.test(value)) continue;

    const code = Number(value.slice(0, 3));
    if (code !== expectedCode) {
      throw new Error(`SMTP error: expected ${expectedCode}, received ${value}`);
    }
    return;
  }
}

function send(value) {
  socket.write(`${value}\r\n`);
}

try {
  await readResponse(220);
  send('EHLO taskflow-jenkins');
  await readResponse(250);
  send(`MAIL FROM:<${from}>`);
  await readResponse(250);
  send(`RCPT TO:<${to}>`);
  await readResponse(250);
  send('DATA');
  await readResponse(354);

  const subject = `[${status}] ${job} #${buildNumber}`;
  const body = [
    `Pipeline status: ${status}`,
    `Job: ${job}`,
    `Branch: ${branch}`,
    `Build URL: ${buildUrl}`,
  ].join('\r\n');

  send([
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
    '.',
  ].join('\r\n'));
  await readResponse(250);
  send('QUIT');
  await readResponse(221);
  console.log(`Build notification sent to ${to}: ${subject}`);
} finally {
  lines.close();
  socket.end();
}
