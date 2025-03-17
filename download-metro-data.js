const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://www.dropbox.com/scl/fi/6ln0oubyqk42zwlro77dr/metroNetworkData.json?rlkey=vy3juw9yrnyutzatsyxlzvnty&st=zo5jml7d&dl=1';
const filePath = path.join(__dirname, 'public', 'data', 'metroNetworkData.json');

function downloadFile(url, filePath) {
  https.get(url, (response) => {
    if (response.statusCode === 302 && response.headers.location) {
      // Follow the redirection
      downloadFile(response.headers.location, filePath);
    } else if (response.statusCode !== 200) {
      console.error(`Failed to download file: ${response.statusCode}`);
      return;
    } else {
      const file = fs.createWriteStream(filePath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('Downloaded metroNetworkData.json');
      });
    }
  }).on('error', (err) => {
    console.error(`Error: ${err.message}`);
  });
}

downloadFile(url, filePath);