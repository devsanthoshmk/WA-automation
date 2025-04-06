const { Client, LocalAuth  } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
// for reading csv
const fs = require('fs');
const csv = require('csv-parser');



// Create a new client instance
const client = new Client(
    {
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
        authStrategy: new LocalAuth()
    }
);

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Client is ready!');
});

// When the client received QR-Code
client.on('qr', (qr) => {
    qrcode.generate(qr, {small: true});
});

// client.on('message_create', message => {
//     if (message.body === "hi"){
// 		// send back "pong" to the chat the message was sent in
// 		client.sendMessage(message.from, 'pong');
//         console.log(message.body);
//     }
    
// });
client.on('ready', async () => {
    
    
    fs.createReadStream('contacts.csv')
        .pipe(csv())
        .on('data', (row) => {
            const phoneNumber = ; // Replace with the target phone number
            const numberId = await client.getNumberId(phoneNumber);

            if (numberId) {
                console.log(`WhatsApp ID: ${numberId._serialized}`);

                client.sendMessage(numberId._serialized, ``)
                .then((message) => {
                    console.log('Message sent successfully:', message);
                })
                .catch((error) => {
                    console.error('Error sending message:', error);
                });
            } else {
                console.log('The phone number is not registered on WhatsApp.');
            }

        })
        .on('end', () => {
            console.log('CSV file successfully processed');
            console.log(results);
        });
});

917904127446@c.us


// Start your client
client.initialize();


