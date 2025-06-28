class StreamCollector {
    constructor() {
        this.activeStreams = new Map(); // stores ongoing conversations
    }

    // Initialize a new stream when call starts
    initStream(callSid) {
        this.activeStreams.set(callSid, {
            responses: [],
            startTime: new Date().toISOString()
        });
        console.log(`New stream initialized for call ${callSid}`);
    }

    // Add RAG response (from caller side)
    addRAGResponse(callSid, transcript, ragResponse) {
        const stream = this.activeStreams.get(callSid);
        if (stream) {
            stream.responses.push({
                type: 'caller',
                timestamp: new Date().toISOString(),
                transcript: transcript,
                rag_response: ragResponse
            });
            console.log(`Added RAG response for call ${callSid}`);
        }
    }

    // Add dispatcher response
    addDispatcherResponse(callSid, original, translated) {
        const stream = this.activeStreams.get(callSid);
        if (stream) {
            stream.responses.push({
                type: 'dispatcher',
                timestamp: new Date().toISOString(),
                original: original,
                translated: translated || original // if no translation needed
            });
            console.log(`Added dispatcher response for call ${callSid}`);
        }
    }

    // Get current state of the stream
    getStreamState(callSid) {
        return this.activeStreams.get(callSid);
    }

    // When call ends, get final conversation and clean up
    finalizeStream(callSid) {
        const stream = this.activeStreams.get(callSid);
        if (!stream) return null;

        const finalConversation = {
            callSid: callSid,
            startTime: stream.startTime,
            endTime: new Date().toISOString(),
            conversation: stream.responses
        };

        // Clean up
        this.activeStreams.delete(callSid);
        return finalConversation;
    }
}

module.exports = new StreamCollector();