import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parse } from 'csv-parse/sync';

// ─── Load Config ─────────────────────────────────────────────────
const config = JSON.parse(readFileSync('messages.json', 'utf-8'));
const SEND_TO_ALL = config.sendToAll || false;
const MESSAGES = config.messages;

// ─── Load Numbers from CSV ───────────────────────────────────────
function loadNumbersFromCSV(filePath) {
    if (!existsSync(filePath)) {
        console.log(`⚠️  CSV file not found: ${filePath}`);
        return [];
    }
    const content = readFileSync(filePath, 'utf-8');
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });
    return records.map(r => r.number).filter(Boolean);
}

const NUMBERS = loadNumbersFromCSV('data/contacts_mock.csv');

// ─── Speed + Stealth Config ─────────────────────────────────────
const CFG = {
    // Delay between the 2 messages to the SAME contact (ms)
    interMsgDelay: { min: 150, max: 500 },

    // Delay between DIFFERENT contacts (ms)
    interContactDelay: { min: 200, max: 700 },

    // Micro-batch: after N contacts, take a short breather
    batchSize: { min: 40, max: 70 },
    batchBreak: { min: 5_000, max: 12_000 },  // 5–12 seconds

    // Shuffle order to avoid sequential patterns (FREE — no time cost)
    shuffle: true,

    // Message variation to avoid content fingerprinting (FREE — no time cost)
    varyText: true,
};

const PROGRESS_FILE = 'progress.json';

// ─── Utilities ───────────────────────────────────────────────────

const delay = ms => new Promise(r => setTimeout(r, ms));
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

/** Gaussian-ish random (bell curve between min–max) */
function gRand(min, max) {
    let s = 0;
    for (let i = 0; i < 3; i++) s += Math.random();
    return Math.floor(min + (s / 3) * (max - min));
}

/** Fisher-Yates shuffle */
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = randInt(0, i);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Vary message text with invisible Unicode characters.
 * These are invisible to the reader but make every message unique
 * so WhatsApp can't hash-match them as identical spam.
 */
function vary(msg) {
    if (!CFG.varyText) return msg;
    const chars = ['\u200B', '\u200C', '\u200D', '\u00AD', '\uFEFF'];
    let out = msg;
    // Insert 2–4 invisible chars at random word boundaries
    const count = randInt(2, 4);
    for (let i = 0; i < count; i++) {
        const pos = randInt(1, out.length - 1);
        out = out.slice(0, pos) + chars[randInt(0, chars.length - 1)] + out.slice(pos);
    }
    // Random trailing whitespace variation
    out += [' ', '', '  ', ' '][randInt(0, 3)];
    return out;
}

/** Load/save progress for crash-safe resume */
function loadProgress() {
    if (existsSync(PROGRESS_FILE)) {
        try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8')); }
        catch { return { sent: [], failed: [] }; }
    }
    return { sent: [], failed: [] };
}
function saveProgress(p) { writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2)); }
function fmtTime(ms) { return ms < 60_000 ? `${(ms / 1000).toFixed(0)}s` : `${(ms / 60_000).toFixed(1)}min`; }

// ─── WhatsApp Client ─────────────────────────────────────────────
const client = new Client({
    puppeteer: {
        args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
            '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process',
        ],
        headless: 'new',
    },
    authStrategy: new LocalAuth(),
    takeoverOnConflict: true,
    takeoverTimeoutMs: 10000,
});

client.on('qr', qr => { console.log('\n📱 Scan QR:\n'); qrcode.generate(qr, { small: true }); });
client.on('loading_screen', (p, m) => console.log(`⏳ ${p}% - ${m}`));
client.on('authenticated', () => console.log('🔐 Authenticated'));
client.on('auth_failure', m => { console.error('❌ Auth failed:', m); process.exit(1); });

// ─── Main ────────────────────────────────────────────────────────
client.once('ready', async () => {
    console.log('✅ Ready!\n');

    // Resume support
    const progress = loadProgress();
    const done = new Set(progress.sent);
    if (done.size > 0) console.log(`📂 Resuming — ${done.size} already sent\n`);

    const contacts = await client.getContacts();
    let targets;

    if (SEND_TO_ALL) {
        const seen = new Set();
        targets = contacts
            .filter(c => {
                if (!c.isMyContact || c.id?.server !== 'c.us' || c.isMe) return false;
                if (seen.has(c.number)) return false;
                seen.add(c.number);
                return true;
            })
            .map(c => ({
                chatId: c.id._serialized,
                number: c.number,
                name: c.pushname || c.name || c.shortName || 'there',
            }));
        console.log(`📢 ${targets.length} unique contacts found`);
    } else {
        // Bulk verify numbers in parallel-ish fashion
        console.log(`🔍 Verifying ${NUMBERS.length} numbers...`);
        targets = [];
        // Verify in chunks of 50 to speed up
        for (let i = 0; i < NUMBERS.length; i += 50) {
            const chunk = NUMBERS.slice(i, i + 50);
            const results = await Promise.all(
                chunk.map(async num => {
                    try {
                        const nid = await client.getNumberId(`91${num}`);
                        if (!nid) return null;
                        const c = contacts.find(x => x.number === num || x.number === `91${num}`);
                        return {
                            chatId: nid._serialized,
                            number: num,
                            name: c?.pushname || c?.name || c?.shortName || 'there',
                        };
                    } catch { return null; }
                })
            );
            targets.push(...results.filter(Boolean));
            if (i + 50 < NUMBERS.length) {
                process.stdout.write(`  ✓ ${Math.min(i + 50, NUMBERS.length)}/${NUMBERS.length} verified\r`);
            }
        }
        console.log(`\n📋 ${targets.length}/${NUMBERS.length} valid numbers on WhatsApp`);
    }

    // Remove already-sent
    targets = targets.filter(t => !done.has(t.number));
    console.log(`📤 ${targets.length} remaining to send\n`);

    if (targets.length === 0) {
        console.log('🎉 All done! Delete progress.json to resend.');
        return;
    }

    // Shuffle contacts (FREE anti-detection)
    if (CFG.shuffle) {
        shuffle(targets);
        console.log('🔀 Contacts shuffled\n');
    }

    let batchTarget = randInt(CFG.batchSize.min, CFG.batchSize.max);
    let batchCount = 0;
    let sent = 0;
    const failed = [];
    const startTime = Date.now();

    // Estimate time
    const avgPerContact = (CFG.interMsgDelay.min + CFG.interMsgDelay.max) / 2
        + (CFG.interContactDelay.min + CFG.interContactDelay.max) / 2 + 600; // ~600ms for 2 API calls
    const batches = Math.floor(targets.length / ((CFG.batchSize.min + CFG.batchSize.max) / 2));
    const estMs = targets.length * avgPerContact + batches * (CFG.batchBreak.min + CFG.batchBreak.max) / 2;
    console.log(`⏱️  Estimated time: ${fmtTime(estMs)}\n`);

    for (const [i, target] of targets.entries()) {
        process.stdout.write(`[${i + 1}/${targets.length}] ${target.name} (${target.number}) `);

        try {
            // Send message 1 (varied)
            const msg1 = vary(MESSAGES[0].replace(/\{\{name\}\}/g, target.name));
            await client.sendMessage(target.chatId, msg1);

            // Tiny delay between msgs to same person
            await delay(gRand(CFG.interMsgDelay.min, CFG.interMsgDelay.max));

            // Send message 2 (varied)
            await client.sendMessage(target.chatId, vary(MESSAGES[1]));

            sent++;
            batchCount++;
            progress.sent.push(target.number);

            // Save progress every 10 messages (reduces disk I/O)
            if (sent % 10 === 0) saveProgress(progress);

            const elapsed = Date.now() - startTime;
            const rate = (sent / (elapsed / 60_000)).toFixed(1);
            const eta = fmtTime(((targets.length - i - 1) * elapsed) / (i + 1));
            console.log(`✅ (${rate}/min, ETA: ${eta})`);
        } catch (err) {
            failed.push(target.number);
            progress.failed.push(target.number);
            console.log(`❌ ${err.message}`);

            // Rate limit / ban detecting — back off hard
            const msg = err.message.toLowerCase();
            if (msg.includes('rate') || msg.includes('block') || msg.includes('ban') ||
                msg.includes('disconnect') || msg.includes('closed') || msg.includes('timeout')) {
                const wait = randInt(30_000, 90_000);
                console.log(`\n🛑 Possible rate limit! Pausing ${fmtTime(wait)}...`);
                saveProgress(progress);
                await delay(wait);
            }
        }

        // ─── Between-contact delay ───────────────────────────────
        if (i < targets.length - 1) {
            // Batch break
            if (batchCount >= batchTarget) {
                const br = gRand(CFG.batchBreak.min, CFG.batchBreak.max);
                console.log(`\n☕ Batch ${batchCount} done → pause ${fmtTime(br)}\n`);
                saveProgress(progress);
                await delay(br);
                batchCount = 0;
                batchTarget = randInt(CFG.batchSize.min, CFG.batchSize.max);
            } else {
                // Normal gap between contacts
                await delay(gRand(CFG.interContactDelay.min, CFG.interContactDelay.max));
            }
        }
    }

    // Final save
    saveProgress(progress);

    if (failed.length > 0) {
        writeFileSync('failed.json', JSON.stringify(failed, null, 4));
        console.log(`\n💾 ${failed.length} failed saved to failed.json`);
    } else if (existsSync('failed.json')) {
        writeFileSync('failed.json', '[]');
    }

    const total = Date.now() - startTime;
    console.log(`\n📊 Done!`);
    console.log(`   Sent: ${sent} | Failed: ${failed.length}`);
    console.log(`   All sessions total: ${progress.sent.length}`);
    console.log(`   Time: ${fmtTime(total)} | Rate: ${(sent / (total / 60_000)).toFixed(1)}/min`);
    console.log(`\n🏁 Delete progress.json to start fresh.`);
});

// ─── Graceful shutdown ───────────────────────────────────────────
process.on('SIGINT', () => { console.log('\n🛑 Interrupted! Progress saved.'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n🛑 Terminated! Progress saved.'); process.exit(0); });

// ─── Start ───────────────────────────────────────────────────────
console.log('🚀 Launching (fast + stealth)...');
client.initialize().catch(err => {
    console.error('❌ Init failed:', err.message);
    process.exit(1);
});
