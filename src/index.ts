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
  // Keep connection alive for long-running process
  connTimeout: 3_600_000,
  keepalive: {
    interval: 10000,
    idleInterval: 300000,
  },
});

/**
 * Search for unread Netflix emails and process update links.
 * Triggered on new email arrival via IMAP IDLE.
 */
async function handleEmails() {
  imap.search([
    'UNSEEN',
    ['HEADER', 'FROM', process.env.TARGET_EMAIL_ADDRESS],
    ['HEADER', 'SUBJECT', process.env.TARGET_EMAIL_SUBJECT],
  ], (err, results) => {
    if (err) {
      new Errorlogger(err);
      return;
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
          // Decode quoted-printable encoding (e.g., =3D -> =)
          const decodedBody = body
            .replace(/=(\r?\n|$)/g, '')
            .replace(/=([a-f0-9]{2})/ig, (_, code) => String.fromCharCode(parseInt(code, 16)));
          
          // Extract Netflix household update link
          const regex = /"(https:\/\/www\.netflix\.com\/account\/update-primary-location[^"]*)"/;
          const match = decodedBody.match(regex);

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
    // Open INBOX in read-write mode (false = not read-only)
    imap.openBox('INBOX', false, (err) => {
      if (err) {
        throw new Errorlogger(`Open INBOX Error: ${err}`);
      }

      Logger.success('Connected to IMAP, listening for emails...');
      
      // Listen for new emails via IMAP IDLE
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
