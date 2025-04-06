const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const rows = [];
fs.createReadStream('cse.csv')
    .pipe(csv())
    .on('data', (row) => {
        rows.push(row);
    })


let send_count=0;
const done_index=[];

function capitalize(str) {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  

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
 try{
    let media;
    try {
        media = MessageMedia.fromFilePath('./poster.jpg');
    } catch (err) {
        console.error('Error loading media file:', err);
        return;
    }
    
  for (const [index, row] of rows.entries()) {
    const phoneNumber = row['CONTACT NUMBER'];
    const name = capitalize(row["NAME"]);
    const numberId = await client.getNumberId(phoneNumber);

    if (numberId) {
        // console.log(`WhatsApp ID: ${numberId._serialized}`);
        try{
            await client.sendMessage(
                numberId._serialized,
                media,
                { 
                caption: `Hey ${name}!

Thanks a ton for being part of Cognit-25 — we hope you had an amazing time!

We’re back with another exciting event at *MNM Jain Engineering College!*

🔥 *\`TechVista 2025\`* – A National Level Technical Symposium  Of the Computer Science and business systems department🔥
📅 Date: 9th April 2025
📍 Venue: MNM Jain Engineering College, Chennai
📞 Vice President: +918608306016 

Don’t miss out on the fun, learning, and competition!
Register Now: mnm-jec-techvista.pages.dev (or) copy paste the link below in a browser
IG: instagram.com/techvista2k25

Let’s make it epic — again! See you there!` 
                }
            )
            // console.log('Message sent successfully:');



        await client.sendMessage(numberId._serialized, 'mnm-jec-techvista.pages.dev')
        // console.log('Additional text message sent successfully.')
        await client.sendMessage(numberId._serialized, 'instagram.com/techvista2k25')
        await client.sendMessage(numberId._serialized, 'https://maps.app.goo.gl/1LrG6yUYmU6aW8Xj8')

        // console.log('Additional text message sent successfully.')
        send_count+=1;
        done_index.push(index)
    } catch(error) {
        console.error(`Error sending link(for ${numberId._serialized}) :`, error);
    }
   
    console.log(send_count);
    } else {
        console.log('The phone number is not registered on WhatsApp.');
    }

  }
} finally {
        console.log(done_index,rows)
        const csvWriter = createCsvWriter({
        path: 'cse.csv', 
        header: [
            { id: 'NAME', title: 'NAME' },
            { id: 'CONTACT NUMBER', title: 'CONTACT NUMBER' }
        ]
        });
    
        csvWriter.writeRecords(rows.filter((_, index) => !done_index.includes(index)))
        .then(() => {
            console.log('Row deleted and CSV updated!');
        });
    
    console.log(`successfully sent megs to ${send_count}`)
}
});
    


// Start your client
client.initialize();


