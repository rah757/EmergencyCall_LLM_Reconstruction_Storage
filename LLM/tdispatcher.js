import express from 'express';
import pkg from 'ws';
import { SpeechClient } from '@google-cloud/speech';
import { TranslationServiceClient } from '@google-cloud/translate';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import axios from 'axios';
import dotenv from 'dotenv';
import record from 'node-record-lpcm16';

dotenv.config();

process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Initialize clients
const speechClient = new SpeechClient();
const translateClient = new TranslationServiceClient();
const ttsClient = new TextToSpeechClient();

// Get caller's language from environment
const callerLanguage = process.env.CALLER_LANGUAGE;
console.log(`Connected to call. Caller's language: ${callerLanguage}`);

// Set up Express server for dispatcher
const app = express();
const PORT = 3001;

// Configure speech recognition request
const request = {
  config: {
    encoding: 'LINEAR16',
    sampleRateHertz: 16000,
    languageCode: 'en-US',
    enableAutomaticPunctuation: true,
  },
  interimResults: false,
};

const server = app.listen(PORT, () => {
  console.log(`Dispatcher server started on port ${PORT}`);
});

// Set up WebSocket server
const { Server } = pkg;
const wss = new Server({ server });

// Recording setup
const recording = record.record({
  sampleRateHertz: 16000,
  threshold: 0,
  verbose: true,
  recordProgram: 'rec',
  silence: '1.0',
});

// Initialize speech stream outside connection handler
let speechStream = speechClient.streamingRecognize(request);

speechStream.on('data', async (data) => {
  if (data.results?.[0]?.isFinal) {
    // For the dispatcher, measure overall processing time (translation and sending)
    const overallStart = Date.now();
    const transcript = data.results[0].alternatives[0].transcript;
    console.log('\n--- Dispatcher Speech Processing ---');
    console.log('Original Transcript:', transcript);

    try {
      let textToSend = transcript;
      
      // If translation is needed, measure its duration.
      if (callerLanguage.toLowerCase() !== 'en-us') {
        console.log('Translating transcript...');
        const translationStart = Date.now();
        const [translation] = await translateClient.translateText({
          parent: `projects/${process.env.GOOGLE_PROJECT_ID}/locations/global`,
          contents: [transcript],
          mimeType: 'text/plain',
          sourceLanguageCode: 'en-US',
          targetLanguageCode: callerLanguage,
        });
        textToSend = translation.translations[0].translatedText;
        console.log(`Translated Text: ${textToSend}`);
        console.log(`Translation took ${Date.now() - translationStart} ms`);
      } else {
        console.log('No translation needed (Caller language is English)');
      }
  
      console.log('Sending transcript to main server...');
      const sendStart = Date.now();
      try {
        const response = await axios.post('http://localhost:3000/dispatcher-response', {
          text: textToSend,
          language: callerLanguage,
          callSid: process.env.CALL_SID
        }, {
          headers: { 'Content-Type': 'application/json' }
        });
        console.log('Successfully sent to main server:', response.data);
      } catch (axiosError) {
        console.error('Error sending to main server:', {
          message: axiosError.message,
          response: axiosError.response?.data,
          status: axiosError.response?.status
        });
      }
      console.log(`Sending to main server took ${Date.now() - sendStart} ms`);
      console.log(`Total processing time for transcript: ${Date.now() - overallStart} ms\n`);
    } catch (error) {
      console.error('Processing error:', error);
      console.log('-----------------------------------\n');
    }
  } else {
    console.log('Interim transcript:', data.results[0].alternatives[0].transcript);
  }
});

console.log('Recording started. Speak into your microphone...');

recording.stream()
  .on('data', async (chunk) => {
    console.time("write-chunk");
    try {
      if (speechStream && !speechStream.destroyed) {
        speechStream.write(chunk);
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
    console.timeEnd("write-chunk");
  })
  .on('error', error => {
    console.error('Recording error:', error);
  })
  .on('end', () => {
    console.log('Recording ended');
  });

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down dispatcher...');
  if (recording) {
    recording.stop();
  }
  if (speechStream) {
    speechStream.end();
  }
  process.exit(0);
});