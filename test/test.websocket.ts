import WebSocket from 'ws';

const url = process.argv[2];
console.log('Connecting to:', url);
if (!url) {
  console.error('CHAT_API_URL not defined');
  process.exit(1);
}

let testPassed = false;

const sender = new WebSocket(url);
const receiver = new WebSocket(url);

receiver.on('open', () => {
  console.log('Receiver connected');
});

receiver.on('message', (data: WebSocket.RawData) => {
  const msg = data.toString();
  console.log('Receiver got message:', msg);

  if (msg.includes('broadcast-test')) {
    console.log('Broadcast successful!');
    testPassed = true;
  }

  sender.close();
  receiver.close();
});

receiver.on('close', () => {
  console.log('Receiver closed');
  process.exit(testPassed ? 0 : 1);
});

receiver.on('error', (err) => {
  console.error('Receiver error:', err);
  process.exit(1);
});

sender.on('open', () => {
  console.log('Sender connected');
  sender.send(JSON.stringify({ action: 'sendmessage', message: 'broadcast-test' }));
  console.log('Sender sent message');
});

sender.on('close', () => {
  console.log('Sender closed');
});

sender.on('error', (err) => {
  console.error('Sender error:', err);
  process.exit(1);
});

/* 
const ws = new WebSocket(url);

let timeout: NodeJS.Timeout;
ws.on('open', () => {
  console.log('Connected');

  // Send a test message
  ws.send(JSON.stringify({ action: 'sendmessage', message: 'test-message' }));

  // Set a 5-second timeout to avoid hanging if no message arrives
  timeout = setTimeout(() => {
    console.warn('No response received, closing connection.');
    ws.close();
  }, 5000);
});

ws.on('message', (data: WebSocket.RawData) => {
  console.log('Received message:', data.toString());
  clearTimeout(timeout);
  ws.close();
});

ws.on('close', () => {
  console.log('Connection closed');
  process.exit(0);
});

ws.on('error', (err: Error) => {
  console.error('WebSocket error:', err);
  process.exit(1);
}); */
