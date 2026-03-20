import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

async function run() {
    const client = new Client({
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process'],
            headless: 'new',
        },
        authStrategy: new LocalAuth(),
        takeoverOnConflict: true,
        takeoverTimeoutMs: 10000,
    });

    client.on('qr', (qr) => {
        console.log('📱 Scan QR:\n');
        qrcode.generate(qr, { small: true });
    });

    client.on('loading_screen', (p, m) => console.log(`⏳ ${p}% - ${m}`));
    client.on('authenticated', () => console.log('🔐 Authenticated'));

    client.once('ready', async () => {
        console.log('✅ Ready!\n');
        try {
            const contacts = await client.getContacts();

            // Only real phone contacts (@c.us), no groups, no self, deduplicated
            const seen = new Set();
            const users = contacts.filter(c =>
                c.isMyContact &&
                c.id.server === 'c.us' &&
                !c.isMe
            );

            console.log(`Found ${users.length} unique WA contacts\n`);

            users.slice(184, 200).forEach((c, i) => {
                console.log(`  ${184 + i}. ${c.pushname || c.name || '—'} (${c.number})`);
            });
        } catch (err) {
            console.error('❌ Error:', err.message);
        } finally {
            await client.destroy();
            process.exit(0);
        }
    });

    console.log('🚀 Launching...');
    client.initialize().catch(err => {
        console.error('❌ Init failed:', err.message);
        process.exit(1);
    });
}

run();
