const http = require('https');

const data = JSON.stringify({
  fileData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  mimeType: "image/png"
});

const req = http.request('https://app-rendiciones.onrender.com/api/ocr', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Body:', body));
});

req.on('error', console.error);
req.write(data);
req.end();
