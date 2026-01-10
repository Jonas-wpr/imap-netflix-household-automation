import Imap from 'imap';
import Errorlogger from '@/Errorlogger';
import Logger from '@/Logger';
import playwrightAutomation from '@/playwrightAutomation';

const imap = new Imap({
  user: process.env.IMAP_USER ?? '',
  password: process.env.IMAP_PASSWORD ?? '',
  host: process.env.IMAP_HOST ?? '',
  port: Number(process.env.IMAP_PORT) || 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  connTimeout: 3_600_000,
  keepalive: {
    interval: 10000,
    idleInterval: 300000,
  },
});

async function handleEmails() {
  imap.search([
    'UNSEEN',
    ['HEADER', 'FROM', process.env.TARGET_EMAIL_ADDRESS],
    ['HEADER', 'SUBJECT', process.env.TARGET_EMAIL_SUBJECT],
  ], (err, results) => {
    if (err) {
      new Errorlogger(err);
    }

    if (!results?.length) {
      return;
    }

    Logger.info(`Netflix email received (${results.length} message(s))`);

    const fetchingData = imap.fetch(results, { bodies: 'TEXT', markSeen: true });
    fetchingData.on('message', (msg) => {
      let body = '';
      msg.on('body', (stream) => {
        stream.on('data', (chunk) => {
          body += chunk.toString('utf-8');
        });

        stream.on('end', async () => {
          const quotedPrintable = body
            .replace(/=(\r?\n|$)/g, '')
            .replace(/=([a-f0-9]{2})/ig, (_, code) => String.fromCharCode(parseInt(code, 16)));
          
          const regex = /"(https:\/\/www\.netflix\.com\/account\/update-primary-location[^"]*)"/;
          const match = quotedPrintable.match(regex);

          if (match?.[1]) {
            Logger.info('Update link found, processing...');
            try {
              await playwrightAutomation(match[1]);
            } catch (e) {
              new Errorlogger(e);
            }
          } else {
            new Errorlogger('No Netflix update link found in email');
          }
        });
      });
    });

    fetchingData.on('error', (fetchingError) => {
      new Errorlogger(`Fetching Error: ${fetchingError}`);
    });
  });
}

(function main() {
  Logger.info('Starting IMAP Netflix Automation...');
  
  imap.connect();

  imap.once('ready', () => {
    imap.openBox('INBOX', false, (err) => {
      if (err) {
        throw new Errorlogger(`Open INBOX Error: ${err}`);
      }

      Logger.success('Connected to IMAP, listening for emails...');
      imap.on('mail', handleEmails);
    });
  });

  imap.once('error', (err: Error) => {
    throw new Errorlogger(`IMAP connection failed: ${err}`);
  });

  imap.once('end', () => {
    Logger.info('IMAP connection ended');
  });
})();
