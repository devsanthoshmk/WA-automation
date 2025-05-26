const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const fileName = 'aids.csv'
const rows = [];

fs.createReadStream(fileName)
  .pipe(csv())
  .on('data', (row) => {
    rows.push(row);
  })
  .on('end', () => {
    const done_index = [
      3,  4,  5,  6,  7,  8,  9, 10, 11, 12,
     13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
     23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
     33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
     43
   ];
    
    // Filter out rows whose index is in done_index
    const filteredRows = rows.filter((_, index) => !done_index.includes(index));
    console.log(filteredRows);
    console.log(done_index)
    const csvWriter = createCsvWriter({
    path: fileName, 
    header: [
        { id: 'NAME', title: 'NAME' },
        { id: 'CONTACT NUMBER', title: 'CONTACT NUMBER' }
    ]
    });

    csvWriter.writeRecords(rows.filter((_, index) => !done_index.includes(index)))
    .then(() => {
        console.log('Row deleted and CSV updated!');
    });

console.log(`successfully sent megs to nobaby its other program `)


  });

