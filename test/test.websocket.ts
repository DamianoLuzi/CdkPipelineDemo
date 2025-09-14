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
import WebSocket from 'ws';
import process from 'process';

const url = process.argv[2];
const message = process.argv[3];

if (!url || !message) {
  console.error('Usage: npx ts-node test/test.websocket.ts <URL> <MESSAGE>');
  process.exit(1);
}

const timeout = 10000;
const timeoutId = setTimeout(() => {
    console.error('Test timeout: Did not receive expected result.');
    process.exit(1);
}, timeout);

const sender = new WebSocket(url);
const receiver = new WebSocket(url);

const exitTest = (code: number) => {
    clearTimeout(timeoutId);
    sender.close();
    receiver.close();
    process.exit(code);
};

receiver.on('open', () => {
    console.log('Receiver connected.');
});

receiver.on('message', (data: WebSocket.RawData) => {
    const msg = data.toString();
    console.log('Receiver got message:', msg);
    if (msg.includes(message)) {
        console.log('Broadcast successful! Test PASSED.');
        exitTest(0);
    } else {
        console.log('Test FAILED: Received unexpected message.');
        exitTest(1);
    }
});

receiver.on('error', (err) => {
    console.error('Receiver error:', err);
    exitTest(1);
});

sender.on('open', () => {
    console.log('Sender connected.');
    sender.send(JSON.stringify({ action: 'sendmessage', message: message }));
    console.log('Sender sent message.');
});

sender.on('error', (err) => {
    console.error('Sender error:', err);
    console.error('Test FAILED: Sender received an error. The broadcast likely failed.');
    exitTest(1);
});