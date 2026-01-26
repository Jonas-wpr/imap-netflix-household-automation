import Imap from 'imap';
import Logger from '@/Logger';
import playwrightAutomation from '@/playwrightAutomation';

// Normalize unknown errors for Logger.error
function logErr(err: unknown): void {
  if (err instanceof Error) {
    Logger.error(err);
  } else {
    Logger.error(String(err));
  }
}

function decodeMimeWords(input: string): string {
  return input.replace(/=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g, (_, charsetRaw, encodingRaw, text) => {
    const charset = String(charsetRaw).toLowerCase();
    const encoding = String(encodingRaw).toLowerCase();
    let buffer: Buffer;

    if (encoding === 'b') {
      buffer = Buffer.from(text, 'base64');
    } else {
      const bytes: number[] = [];
      const normalized = String(text).replace(/_/g, ' ');
      for (let i = 0; i < normalized.length; i += 1) {
        const ch = normalized[i];
        if (ch === '=' && i + 2 < normalized.length) {
          const hex = normalized.slice(i + 1, i + 3);
          if (/^[0-9a-fA-F]{2}$/.test(hex)) {
            bytes.push(parseInt(hex, 16));
            i += 2;
            continue;
          }
        }
        bytes.push(normalized.charCodeAt(i));
      }
      buffer = Buffer.from(bytes);
    }

    const nodeEncoding =
      charset.includes('utf-8') || charset.includes('utf8')
        ? 'utf8'
        : charset.includes('iso-8859-1') || charset.includes('latin1')
          ? 'latin1'
          : 'utf8';

    return buffer.toString(nodeEncoding);
  });
}

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
 * Find unread Netflix emails (sender + subject),
 * run Playwright automation on initial link emails,
 * and mark confirmation emails as read without further action.
 */
async function handleEmails() {
  const initialSubject = process.env.TARGET_EMAIL_SUBJECT ?? '';
  const confirmationSubject = process.env.CONFIRMATION_SUBJECT ?? '';

  const searchCriteria: (string | string[])[] = ['UNSEEN', ['HEADER', 'FROM', process.env.TARGET_EMAIL_ADDRESS ?? '']];

  imap.search(searchCriteria, (err, results) => {
    if (err) {
      Logger.error(err);
      return;
    }

    if (!results?.length) {
      return;
    }

    Logger.info(`Netflix email received (${results.length} message(s))`);

    // Fetch without marking messages seen; mark after handling (confirmation or successful automation).
    const fetchingData = imap.fetch(results, { bodies: ['HEADER.FIELDS (SUBJECT)', 'TEXT'], markSeen: false });
    fetchingData.on('message', (msg, seqno) => {
      let body = '';
      let header = '';

      msg.on('body', (stream, info) => {
        let chunkBuffer = '';
        stream.on('data', (chunk) => {
          chunkBuffer += chunk.toString('utf-8');
        });

        stream.on('end', () => {
          const isHeader = String(info?.which ?? '').toUpperCase().includes('HEADER');
          if (isHeader) {
            header += chunkBuffer;
          } else {
            body += chunkBuffer;
          }
        });
      });

      msg.once('end', async () => {
        const parsedHeader = Imap.parseHeader(header);
        const subjectRaw = Array.isArray(parsedHeader.subject) ? parsedHeader.subject[0] ?? '' : '';
        const subject = decodeMimeWords(subjectRaw ?? '');
        const subjectLower = subject.toLowerCase();
        const initialLower = initialSubject.toLowerCase();
        const confirmationLower = confirmationSubject.toLowerCase();
        const isInitialMatch = initialSubject ? subjectLower.includes(initialLower) : false;
        const isConfirmationMatch = confirmationSubject ? subjectLower.includes(confirmationLower) : false;

        if (isConfirmationMatch) {
          try {
            (imap as any).seq.addFlags(seqno, '\\Seen', (flagErr: Error | null) => {
              if (flagErr) {
                Logger.error(`Failed to mark confirmation message ${seqno} as seen: ${flagErr}`);
              } else {
                Logger.info(`Marked confirmation message ${seqno} as read`);
              }
            });
          } catch (flagError) {
            logErr(flagError);
          }
          return;
        }

        if (initialSubject && !isInitialMatch) {
          Logger.info(`Skipping email with non-matching subject: "${subject}"`);
          return;
        }

        if (!body) {
          Logger.error('No email body found to inspect for Netflix update link');
          return;
        }

        // Best-effort quoted-printable decode for plain text parts.
        const decodedBody = body
          .replace(/=(\r?\n|$)/g, '')
          .replace(/=([a-f0-9]{2})/ig, (_, code) => String.fromCharCode(parseInt(code, 16)));

        // Locate the Netflix update-primary-location link.
        const regex = /"(https:\/\/www\.netflix\.com\/account\/update-primary-location[^"]*)"/;
        const match = decodedBody.match(regex);

        if (match?.[1]) {
          Logger.info('Update link found, processing...');
          try {
            await playwrightAutomation(match[1]);

            // Mark initial message as read after automation succeeded.
            try {
              (imap as any).seq.addFlags(seqno, '\\Seen', (flagErr: Error | null) => {
                if (flagErr) {
                  Logger.error(`Failed to mark message ${seqno} as seen: ${flagErr}`);
                } else {
                  Logger.info(`Marked initial message ${seqno} as read`);
                }
              });
            } catch (flagError) {
              logErr(flagError);
            }
          } catch (e) {
            logErr(e);
          }
        } else {
          Logger.error('No Netflix update link found in email');
        }
      });
    });

    fetchingData.on('error', (fetchingError) => {
      Logger.error(`Fetching Error: ${fetchingError}`);
    });
  });
}

(function main() {
  Logger.info('Starting IMAP Netflix Automation...');

  imap.connect();

  imap.once('ready', () => {
    imap.openBox('INBOX', false, (err) => {
      if (err) {
        throw Logger.createError(`Open INBOX Error: ${err}`);
      }

      Logger.success('Connected to IMAP, listening for emails...');
      // Listen for new emails via IMAP IDLE
      imap.on('mail', handleEmails);
    });
  });

  imap.once('error', (err: Error) => {
    throw Logger.createError(`IMAP connection failed: ${err}`);
  });

  imap.once('end', () => {
    Logger.info('IMAP connection ended');
  });
})();
