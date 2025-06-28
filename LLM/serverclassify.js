import express from 'express';
import pkg from 'ws';
const { Server } = pkg;
import { SpeechClient } from '@google-cloud/speech';
import { TranslationServiceClient } from '@google-cloud/translate';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import axios from 'axios';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const parentDir = path.join(__dirname, '..');

dotenv.config();

// Define the correct keystore path
const storageFilePath = path.join(parentDir, 'testing', 'keyStore.json');
console.log('[serverclassify.js] Overriding STORAGE_FILE:', storageFilePath);

// Import KeyStorageService and manually override its path
import keyStorage from '../src/services/keyServer/keyStorage.js';
keyStorage.storageFilePath = storageFilePath;
console.log('[serverclassify.js] Forcing keyStorage to use:', keyStorage.storageFilePath);

// Now import ArweaveService after keyStorage path is set
const ArweaveService = (await import(path.join(parentDir, 'src/services/arweave.service.js'))).default;

// Ensure the correct KEY_STORE_PATH
process.env.KEY_STORE_PATH = storageFilePath;
console.log('[serverclassify.js] Setting KEY_STORE_PATH:', process.env.KEY_STORE_PATH);

// Environment setup
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Initialize clients
const speechClient = new SpeechClient();
const translateClient = new TranslationServiceClient();
const ttsClient = new TextToSpeechClient();

// Global state variables
let isDispatcherTerminalLaunched = false;
let detectedCallerLanguage = null;
let activeCallSid = null;
let activeWebSocket = null;
let streamSid = null;
let currentSoxProcess = null;
let stdinEnded = false;
// Use this to track the timestamp for the final STT audio chunk.
let sttStartTime = null;

// Conversation storage map
const conversations = new Map();

// Express server setup
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic endpoints
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

// Dispatcher response handler (for TTS + SoX conversion)
app.post('/dispatcher-response', async (req, res) => {
  console.log('Received dispatcher response:', req.body);
  if (!req.body?.text) {
    console.error('Invalid request body received');
    return res.status(400).json({ error: 'Invalid request body' });
  }
  const { text, language } = req.body;
  console.log('\n--- Processing Dispatcher Response ---');
  console.log('Received text:', text);
  console.log('Language:', language);

  // Store the dispatcher response in the conversation log.
  if (activeCallSid && conversations.has(activeCallSid)) {
    const conversation = conversations.get(activeCallSid);
    conversation.dispatcher_responses.push({
      timestamp: new Date().toISOString(),
      text,
      language
    });
  }

  try {
    // Time the TTS + SoX pipeline.
    console.time("dispatcher-response-tts-sox");

    console.log('Starting text-to-speech conversion...');
    const [ttsResponse] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: { languageCode: language, ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 16000 },
    });
    console.log('Text-to-speech conversion completed');

    const ttsBuffer = Buffer.from(ttsResponse.audioContent);
    console.log(`Total TTS buffer size: ${ttsBuffer.length} bytes`);

    // Write the TTS output to a file for SoX processing.
    const uniqueId = uuidv4();
    const inputFilePath = `./input_${uniqueId}.raw`;
    fs.writeFileSync(inputFilePath, ttsBuffer);
    console.log(`TTS buffer written to ${inputFilePath}`);

    console.log('Starting SoX process...');
    const soxProcess = spawn('sox', [
      '-t', 'raw', '-r', '16000', '-e', 'signed-integer', '-b', '16', '-c', '1', inputFilePath,
      '-t', 'wav', '-r', '8000', '-e', 'u-law', '-b', '8', '-c', '1', '-'
    ]);

    // On SoX output, send the processed audio to Twilio.
    soxProcess.stdout.on('data', (chunk) => {
      if (activeWebSocket && activeWebSocket.readyState === activeWebSocket.OPEN) {
        const payload = chunk.toString('base64');
        const mediaMessage = {
          event: 'media',
          streamSid,
          media: { payload },
        };
        activeWebSocket.send(JSON.stringify(mediaMessage), (err) => {
          if (err) {
            console.error('WebSocket send error:', err);
          } else {
            console.log('Media message sent successfully.');
          }
        });
      } else {
        console.warn('WebSocket not open. Skipping chunk processing.');
      }
    });

    soxProcess.on('close', (code) => {
      if (code === 0) {
        console.log('Audio processing completed successfully.');
      } else {
        console.error(`SoX process exited with code ${code}`);
      }
      if (fs.existsSync(inputFilePath)) {
        fs.unlinkSync(inputFilePath);
      }
      console.timeEnd("dispatcher-response-tts-sox");
    });

    soxProcess.stderr.on('data', (data) => {
      console.error('SoX stderr:', data.toString());
    });

    soxProcess.stdin.on('error', (error) => {
      console.error('SoX stdin error:', error.message);
    });

    res.json({ success: true, message: 'Audio is being streamed to Twilio.' });
  } catch (error) {
    console.error('Error processing dispatcher response:', error);
    res.status(500).json({ error: 'Failed to process response' });
  }
});

// Start the Express server and create a WebSocket server.
const server = app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
const wss = new Server({ server });

wss.on('connection', (webSocket) => {
  console.log('Twilio media stream WebSocket connected');
  activeWebSocket = webSocket;

  let speechStream = speechClient.streamingRecognize({
    config: {
      encoding: 'MULAW',
      sampleRateHertz: 8000,
      languageCode: 'en-US',
      useEnhanced: true,
      enableAutomaticPunctuation: true,
      alternativeLanguageCodes: ['hi-IN', 'es-ES', 'fr-FR', 'de-DE'],
    },
    interimResults: true,
  });

  // When the final STT result is received...
  speechStream.on('data', async (data) => {
    if (data.results?.[0]?.isFinal) {
      // Compute final STT processing time using the timestamp of the last audio chunk.
      const sttEndTime = Date.now();
      if (sttStartTime) {
        const finalSTTTime = sttEndTime - sttStartTime;
        console.log(`Final STT Processing Time: ${finalSTTTime} ms`);
        if (activeCallSid && conversations.has(activeCallSid)) {
          const conversation = conversations.get(activeCallSid);
          conversation.sttProcessingTime = finalSTTTime;
        }
        sttStartTime = null; // Reset for next cycle.
      }

      // Measure the processing time for translation and RAG.
      const speechHandlingStart = Date.now();
      const result = data.results[0];
      const transcript = result.alternatives[0]?.transcript?.trim();
      console.log('\n--- Final Transcription Received ---');
      console.log('Speech recognition language:', result.languageCode);
      console.log('Final Transcription:', transcript);

      if (!transcript) {
        console.warn('Empty transcription received, skipping processing.');
        return;
      }

      // Launch dispatcher terminal on the first message.
      if (!isDispatcherTerminalLaunched) {
        detectedCallerLanguage = result.languageCode;
        try {
          console.log('Starting dispatcher terminal...');
          console.log(`Caller's language: ${detectedCallerLanguage}`);
          const currentDir = process.cwd();
          const terminal = spawn('osascript', [
            '-e',
            `tell app "Terminal" to do script "cd '${currentDir}' && source emergencyenv/bin/activate && CALLER_LANGUAGE=${detectedCallerLanguage} CALL_SID=${activeCallSid} node tdispatcher.js"`
          ]);
          isDispatcherTerminalLaunched = true;
          console.log('Dispatcher terminal launched successfully');
          terminal.on('error', (err) => {
            console.error('Failed to start dispatcher terminal:', err);
          });
        } catch (error) {
          console.error('Error launching dispatcher terminal:', error);
        }
      }

      // Measure translation + RAG processing.
      const translationStart = Date.now();
      if (result.languageCode.toLowerCase() !== 'en-us') {
        try {
          console.log('Translating transcript...');
          const [translation] = await translateClient.translateText({
            parent: `projects/${process.env.GOOGLE_PROJECT_ID}/locations/global`,
            contents: [transcript],
            mimeType: 'text/plain',
            sourceLanguageCode: result.languageCode,
            targetLanguageCode: 'en',
          });
          const translatedText = translation.translations[0]?.translatedText;
          console.log('Translated Text:', translatedText);
          try {
            console.log('Sending transcript to RAG service...');
            const ragCallStart = Date.now();
            const response = await axios.post('http://localhost:3000/dispatcher-response', {
              transcript: translatedText,
              call_sid: activeCallSid
            });
            console.log('RAG Response:', response.data.response);
            console.log(`RAG call took ${Date.now() - ragCallStart} ms`);
          } catch (error) {
            console.log('RAG service not available - continuing without RAG processing');
          }
        } catch (error) {
          console.error('Translation error:', error);
        }
      } else {
        try {
          console.log('Sending transcript to RAG service...');
          const ragCallStart = Date.now();
          const response = await axios.post('http://localhost:3000/dispatcher-response', {
            transcript,
            call_sid: activeCallSid
          });
          console.log('RAG Response:', response.data.response);
          console.log(`RAG call took ${Date.now() - ragCallStart} ms`);
        } catch (error) {
          console.log('RAG service not available - continuing without RAG processing');
        }
      }
      console.log(`Translation + RAG processing took ${Date.now() - translationStart} ms`);
      console.log(`Total time from final speech to finish: ${Date.now() - speechHandlingStart} ms\n`);
    }
  });

  // Handle other incoming WebSocket messages
  webSocket.on('message', async (message) => {
    const msg = JSON.parse(message);
    switch (msg.event) {
      case 'connected':
        console.info('Twilio stream connected');
        break;
      case 'start':
        streamSid = msg.start.streamSid;
        activeCallSid = msg.start.callSid;
        sttStartTime = null; // Reset STT timer when call starts.
        conversations.set(activeCallSid, {
          start_time: new Date().toISOString(),
          caller_responses: [],
          dispatcher_responses: []
        });
        console.info('Stream started. CallSid:', activeCallSid);
        break;
      case 'media':
        // When receiving audio, if the STT timer isn't set, set it now.
        if (!sttStartTime) {
          sttStartTime = Date.now();
        }
        if (speechStream && !speechStream.destroyed) {
          try {
            speechStream.write(Buffer.from(msg.media.payload, 'base64'));
          } catch (error) {
            console.error('Error processing audio:', error);
          }
        } else {
          console.warn('Speech stream not available, skipping media message');
        }
        break;
      case 'stop':
        console.info('Twilio stream stopped');
        if (conversations.has(activeCallSid)) {
          try {
            console.time("save-and-store-conversation");
            const conversation = conversations.get(activeCallSid);
            conversation.end_time = new Date().toISOString();
            conversation.call_sid = activeCallSid;
            const filename = `conversation_${activeCallSid}_${new Date().toISOString()}.json`;
            fs.writeFileSync(filename, JSON.stringify(conversation, null, 2));
            console.log(`Conversation saved to ${filename}`);
            const arweaveId = await storeConversationInArweave(conversation);
            console.log('Arweave Transaction ID:', arweaveId);
            conversations.delete(activeCallSid);
            console.timeEnd("save-and-store-conversation");
          } catch (error) {
            console.error('Error saving conversation:', error);
          }
        }
        break;
    }
  });

  webSocket.on('close', (code, reason) => {
    console.log(`WebSocket connection closed by Twilio with code ${code} and reason: ${reason}`);
    if (speechStream) speechStream.end();
    console.log('WebSocket disconnected');
  });

  webSocket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

async function storeConversationInArweave(conversation) {
  try {
    console.log('\nStoring emergency conversation in Arweave...');
    console.log('Using keystore at:', process.env.KEY_STORE_PATH);
    const documentData = {
      content: conversation,
      timestamp: new Date().toISOString(),
      type: "emergency-transcript"
    };
    console.log('Storing document data:', documentData);
    const jsonString = JSON.stringify(documentData, null, 2);
    console.log('Final JSON string before storing:', jsonString);
    const storeResult = await ArweaveService.storeData(jsonString);
    console.log('\nStore result:', storeResult);
    try {
      console.log('\nVerifying stored document...');
      const retrievedDoc = await ArweaveService.getData(storeResult.transactionId);
      console.log('Successfully retrieved:', retrievedDoc);
      return storeResult.transactionId;
    } catch (error) {
      console.error('Error retrieving document:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to store in Arweave:', error);
    throw error;
  }
}

// WebSocket server error handler
wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

// Process cleanup handler
process.on('SIGINT', () => {
  console.log('Received SIGINT, cleaning up...');
  if (currentSoxProcess) {
    currentSoxProcess.kill();
  }
  process.exit(0);
});