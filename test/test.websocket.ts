// import WebSocket from 'ws';

// const url = process.argv[2];
// console.log('Connecting to:', url);
// if (!url) {
//   console.error('CHAT_API_URL not defined');
//   process.exit(1);
// }

// let testPassed = false;

// const sender = new WebSocket(url);
// const receiver = new WebSocket(url);

// receiver.on('open', () => {
//   console.log('Receiver connected');
// });

// receiver.on('message', (data: WebSocket.RawData) => {
//   const msg = data.toString();
//   console.log('Receiver got message:', msg);

//   if (msg.includes('broadcast-test')) {
//     console.log('Broadcast successful!');
//     testPassed = true;
//   }

//   sender.close();
//   receiver.close();
// });

// receiver.on('close', () => {
//   console.log('Receiver closed');
//   process.exit(testPassed ? 0 : 1);
// });

// receiver.on('error', (err) => {
//   console.error('Receiver error:', err);
//   process.exit(1);
// });

// sender.on('open', () => {
//   console.log('Sender connected');
//   sender.send(JSON.stringify({ action: 'sendmessage', message: 'broadcast-test' }));
//   console.log('Sender sent message');
// });

// sender.on('close', () => {
//   console.log('Sender closed');
// });

// sender.on('error', (err) => {
//   console.error('Sender error:', err);
//   process.exit(1);
// });


// File: test/test.websocket.ts

import WebSocket from 'ws';
import process from 'process';

const url = process.argv[2];
const message = process.argv[3];

if (!url || !message) {
  console.error('Usage: npx ts-node test/test.websocket.ts <URL> <MESSAGE>');
  process.exit(1);
}

// Use a timeout to prevent the script from hanging indefinitely
let timeoutId = setTimeout(() => {
    console.error('Test timeout: Connections did not close in time.');
    process.exit(1);
}, 10000); // 10-second timeout

// An exit function to ensure we always close all connections and clear the timer.
const exit = (code: number) => {
    clearTimeout(timeoutId);
    if (sender.readyState === WebSocket.OPEN) sender.close();
    if (receiver.readyState === WebSocket.OPEN) receiver.close();
    process.exit(code);
};

const sender = new WebSocket(url);
const receiver = new WebSocket(url);

receiver.on('open', () => {
    console.log('Receiver connected');
});

receiver.on('message', (data: WebSocket.RawData) => {
    const msg = data.toString();
    console.log('Receiver got message:', msg);
    if (msg.includes(message)) {
        console.log('Broadcast successful!');
        exit(0);
    } else {
        console.error('Test FAILED: Received unexpected message.');
        exit(1);
    }
});

receiver.on('close', (code, reason) => {
    console.log(`Receiver closed with code ${code}`);
});

receiver.on('error', (err) => {
    console.error('Receiver error:', err);
    exit(1);
});

sender.on('open', () => {
    console.log('Sender connected');
    sender.send(JSON.stringify({ action: 'sendmessage', message: message }));
    console.log('Sender sent message');
});

sender.on('close', (code, reason) => {
    console.log(`Sender closed with code ${code}`);
});

sender.on('error', (err) => {
    console.error('Sender error:', err);
    // When the sender gets an error, it's a test failure as the server should not crash.
    console.error('Test FAILED: Sender received an error. The broadcast likely failed.');
    exit(1);
});