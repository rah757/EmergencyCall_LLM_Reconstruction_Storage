import express from 'express';
import pkg from 'ws';
import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import axios from 'axios';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import 'dotenv/config';

const { Server } = pkg;

// Initialize Google Cloud clients
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
const speechClient = new SpeechClient();
const ttsClient = new TextToSpeechClient();

// Global variables
let activeWebSocket = null;
let streamSid = null;

// Store conversation context by call SID - ONLY for severity classification
const severityContexts = new Map();

// Express server setup
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('Twilio media stream transcriber');
});

app.post('/', (req, res) => {
  res.type('xml').send(`
    <Response>
      <Say>Connection established.</Say>
      <Connect>
        <Stream url='wss://${req.headers.host}' />
      </Connect>
    </Response>
  `);
});

// Process responses from the Flask API
app.post('/dispatcher-response', async (req, res) => {
  if (!req.body?.text) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  const { text, language = 'en-US' } = req.body;
  console.log('\n--- Processing Response ---');
  console.log('Text:', text);

  try {
    // Convert text to speech
    const [ttsResponse] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: { languageCode: language, ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 16000 },
    });

    const ttsBuffer = Buffer.from(ttsResponse.audioContent);
    const uniqueId = uuidv4();
    const inputFilePath = `./input_${uniqueId}.raw`;
    fs.writeFileSync(inputFilePath, ttsBuffer);

    // Convert audio to Twilio's format
    const soxProcess = spawn('sox', [
      '-t', 'raw', '-r', '16000', '-e', 'signed-integer', '-b', '16', '-c', '1', inputFilePath,
      '-t', 'wav', '-r', '8000', '-e', 'u-law', '-b', '8', '-c', '1', '-'
    ]);

    // Send processed audio to Twilio
    soxProcess.stdout.on('data', (chunk) => {
      if (activeWebSocket && activeWebSocket.readyState === activeWebSocket.OPEN) {
        const payload = chunk.toString('base64');
        const mediaMessage = {
          event: 'media',
          streamSid,
          media: { payload },
        };
        activeWebSocket.send(JSON.stringify(mediaMessage));
      }
    });

    soxProcess.on('close', (code) => {
      if (fs.existsSync(inputFilePath)) {
        fs.unlinkSync(inputFilePath);
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to process response' });
  }
});

// Endpoint to check the current severity context (for debugging)
app.get('/severity-context/:callSid', (req, res) => {
  const { callSid } = req.params;
  if (severityContexts.has(callSid)) {
    res.json(severityContexts.get(callSid));
  } else {
    res.status(404).json({ error: 'Context not found' });
  }
});

// Start the Express server and create a WebSocket server
const server = app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
const wss = new Server({ server });

wss.on('connection', (webSocket) => {
  console.log('Twilio media stream WebSocket connected');
  activeWebSocket = webSocket;
  let currentCallSid = null;

  // Set up Google Speech streaming recognition
  let speechStream = speechClient.streamingRecognize({
    config: {
      encoding: 'MULAW',
      sampleRateHertz: 8000,
      languageCode: 'en-US',
      useEnhanced: true,
      enableAutomaticPunctuation: true,
    },
    interimResults: true,
  });

  // Handle final speech recognition results
  speechStream.on('data', async (data) => {
    if (data.results?.[0]?.isFinal && currentCallSid) {
      const transcript = data.results[0].alternatives[0]?.transcript?.trim();
      console.log('\n--- Final Transcript ---');
      console.log(transcript);

      if (transcript) {
        // Add this transcript to the severity context
        if (severityContexts.has(currentCallSid)) {
          const contextArray = severityContexts.get(currentCallSid);
          contextArray.push(transcript);
          // Keep context a reasonable size (last 5 utterances)
          if (contextArray.length > 5) {
            contextArray.shift(); // Remove oldest utterance
          }
        }
        
        try {
          // Make a copy of the request data for severity classification with full context
          const fullSeverityContext = severityContexts.has(currentCallSid) 
            ? severityContexts.get(currentCallSid).join(" ") 
            : transcript;
          
          // For the regular completion, just use the current transcript
          const response = await axios.post('http://localhost:5001/generate', {
            transcript: transcript, // Current transcript only for the regular processing
            context_for_severity: fullSeverityContext, // Pass full context in a separate field
            call_sid: currentCallSid
          });
          
          console.log('Response from API:', response.data.completion);
          console.log('Provider used:', response.data.provider || 'unknown');
          console.log('Severity level:', response.data.severity_level);
          
          // // Send response back to caller via TTS
          // await axios.post('http://localhost:3000/dispatcher-response', {
          //   text: response.data.completion,
          //   language: 'en-US'
          // });
        } catch (error) {
          console.error('Error calling API:', error.message);
        }
      }
    }
  });

  // Handle incoming WebSocket messages from Twilio
  webSocket.on('message', (message) => {
    const msg = JSON.parse(message);
    switch (msg.event) {
      case 'connected':
        console.log('Twilio stream connected');
        break;
      case 'start':
        streamSid = msg.start.streamSid;
        currentCallSid = msg.start.callSid;
        
        // Initialize severity context for this call
        severityContexts.set(currentCallSid, []);
        
        console.log('Stream started. CallSid:', currentCallSid);
        break;
      case 'media':
        if (speechStream && !speechStream.destroyed) {
          try {
            speechStream.write(Buffer.from(msg.media.payload, 'base64'));
          } catch (error) {
            console.error('Error processing audio:', error);
          }
        }
        break;
      case 'stop':
        console.log('Stream stopped');
        
        // Clean up the severity context when call ends
        if (currentCallSid && severityContexts.has(currentCallSid)) {
          severityContexts.delete(currentCallSid);
          currentCallSid = null;
        }
        break;
    }
  });

  webSocket.on('close', () => {
    console.log('WebSocket disconnected');
    if (speechStream) speechStream.end();
    
    // Clean up the severity context if connection lost
    if (currentCallSid && severityContexts.has(currentCallSid)) {
      severityContexts.delete(currentCallSid);
    }
  });

  webSocket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Process cleanup handler
process.on('SIGINT', () => {
  console.log('Shutting down...');
  process.exit(0);
});