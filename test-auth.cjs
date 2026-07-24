const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/login',
  method: 'GET',
  headers: {
    'Host': '2397e5be-23e5-4900-9114-a1e5c81b4921-00-qmw5oiiusgxq.spock.replit.dev'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  if (res.statusCode === 302) {
    console.log('Redirect Location:', res.headers.location);
  }
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response Body Length:', data.length);
    if (data.length < 1000) {
      console.log('Response Body:', data);
    } else {
      console.log('Response Body (first 500 chars):', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();