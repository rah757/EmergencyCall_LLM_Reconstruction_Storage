import pandas as pd
import faiss
import openai
import anthropic
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import time
import logging

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Access API keys from environment variables
openai_api_key = os.getenv('OPENAI_API_KEY')
anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')

# Initialize API clients
openai.api_key = openai_api_key
claude_client = anthropic.Anthropic(api_key=anthropic_api_key) if anthropic_api_key else None

# Load and Preprocess CSV Data
def load_csv_data(file_path):
    data = pd.read_csv(file_path)
    data['combined_text'] = data.apply(lambda row: ' '.join(row.values.astype(str)), axis=1)
    return data

# Create Embeddings for CSV Data Using TF-IDF
def create_embeddings(data):
    vectorizer = TfidfVectorizer()
    embeddings = vectorizer.fit_transform(data['combined_text']).toarray()
    return embeddings, vectorizer

# Build FAISS Index for Context Search
def build_faiss_index(embeddings):
    dim = embeddings.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)
    return index

# Retrieve Relevant Context Based on Query
def retrieve_entries(query, index, data, vectorizer, k=5):
    query_vec = vectorizer.transform([query]).toarray()
    D, I = index.search(query_vec, k)
    print("FAISS Indices:", I)
    retrieved_texts = data.iloc[I[0].astype(int)]['combined_text'].tolist()
    print("Retrieved texts:", retrieved_texts)
    return retrieved_texts

# Generate Completion Using GPT
def chat_gpt(query, retrieved_texts):
    context = '\n'.join(retrieved_texts)
    prompt = f"Context:\n{context}\n\nGiven the partial transcript: '{query}', predict what the speaker is most likely saying."
    
    # Try OpenAI GPT first
    if openai_api_key:
        try:
            logger.info("Generating response with GPT...")
            response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150,
                temperature=0.7,
                timeout=10
            )
            response_text = response.choices[0].message['content'].strip()
            logger.info("GPT response completed")
            return response_text, "openai"
        except Exception as e:
            logger.warning(f"GPT unavailable, using Claude instead...")
    
    # Use Claude if GPT is unavailable
    if claude_client:
        try:
            logger.info("Generating response with Claude...")
            response = claude_client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=150,
                temperature=0.7,
                messages=[{"role": "user", "content": prompt}],
                timeout=10
            )
            response_text = response.content[0].text.strip()
            logger.info("Claude response completed")
            return response_text, "claude"
        except Exception as e:
            logger.error(f"Claude also unavailable: {e}")
    
    # Default response if no AI is available
    logger.error("AI services temporarily unavailable")
    return "LLM unavailable", "fallback"

# Load your CSV data
csv_file = 'emergency.csv'  # Make sure this path is correct
data = load_csv_data(csv_file)
embeddings, vectorizer = create_embeddings(data)
index = build_faiss_index(embeddings)

@app.route('/generate', methods=['POST'])
def generate():
    try:
        request_data = request.get_json()
        logger.info(f"Received request data: {request_data}")
        
        transcript = request_data.get('transcript', '')
        if not transcript:
            return jsonify({"error": "Transcript not provided"}), 400
        
        retrieved_texts = retrieve_entries(transcript, index, data, vectorizer)
        response_text, provider = chat_gpt(transcript, retrieved_texts)
        
        # Return both response and completion for backwards compatibility
        return jsonify({
            "response": response_text,
            "completion": response_text,
            "provider": provider,
            "timestamp": time.time()
        })
    except Exception as e:
        logger.error(f"Exception occurred: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint to verify API availability"""
    status = {
        "openai_available": bool(openai_api_key),
        "claude_available": bool(claude_client),
        "timestamp": time.time()
    }
    return jsonify(status)

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5001)
