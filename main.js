const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const fileName = 'DEVDASH.csv'
const rows = [];
fs.createReadStream(fileName)
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
    // let media;
    // try {
    //     media = MessageMedia.fromFilePath('./poster.jpg');
    // } catch (err) {
    //     console.error('Error loading media file:', err);
    //     return;
    // }
    
  for (const [index, row] of rows.entries()) {
    const phoneNumber = row['Phone Number'];
    const name = capitalize(row["Name"]);
    try {
        numberId = await client.getNumberId(phoneNumber);
    } catch (err) {
        console.error(`Error fetching numberId for ${phoneNumber}:`, err);
        continue; // Skip this row and continue with the next one
    }
    if (numberId) {
        // console.log(`WhatsApp ID: ${numberId._serialized}`);
        try{
            await client.sendMessage(numberId._serialized,`Hi ${name},
\`First of all Thank You Attending Techvista😇\`
You have successfully registered *DEVDASH*. If not please ignore.
Participants please fill the below form and join this group to participate in this *DEVDASH* (If you can't open please copy paste in browser)`)
            await client.sendMessage(numberId._serialized,`https://forms.gle/gmiyHBrVXGnp47iy9`)
            await client.sendMessage(numberId._serialized,`https://chat.whatsapp.com/L9pADxjz5Ow00gNQpkEzoW`)
            await client.sendMessage(numberId._serialized,`If you don't have laptop kindly inform it and your requirements(like python,js,java or any libraries too which you will use to code here) to *Event Head*(number given below). If you have lap then make sure you *only just set up* your project `)
            await client.sendMessage(numberId._serialized,`7904127446`)

            
//            
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
    console.log(done_index)
    const csvWriter = createCsvWriter({
        path: fileName, 
        header: [
            { id: 'NAME', title: 'NAME' },
            { id: 'CONTACT NUMBER', title: 'CONTACT NUMBER' }
        ]
        });

    const problematic = rows.filter((_, index) => !done_index.includes(index));
    csvWriter.writeRecords(problematic)
    .then(() => {
        console.log('Row deleted and CSV updated!',problematic);
    });
    
    console.log(`successfully sent megs to ${send_count}`)
}
});
    


// Start your client
client.initialize();


