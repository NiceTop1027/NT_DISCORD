const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../build/index.html');

fs.readFile(indexPath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading index.html:', err);
    return;
  }

  let result = data.replace(/href="\/vite.svg"/g, 'href="./vite.svg"');
  result = result.replace(/src="\/assets\//g, 'src="./assets/');
  result = result.replace(/href="\/assets\//g, 'href="./assets/');

  fs.writeFile(indexPath, result, 'utf8', (err) => {
    if (err) {
      console.error('Error writing index.html:', err);
      return;
    }
    console.log('index.html paths updated successfully.');
  });
});