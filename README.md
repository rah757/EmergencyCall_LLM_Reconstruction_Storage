# Multilingual Low-Latency Emergency VoIP System Using LLM for Speech Reconstruction and Blockchain for Secure Data Archiving

A real-time emergency communication system that processes VoIP calls through Twilio with multilingual speech-to-text transcription, AI-powered context-aware responses using RAG (FAISS + GPT), and automatic severity classification. Emergency transcripts are securely stored on Arweave blockchain with encryption keys distributed via Shamir secret sharing across epoch servers. Access control is managed through Solana multisig governance requiring proposal approval for data retrieval, with support for epoch-based key rotation ensuring long-term security compliance.

## System Architecture

The architecture diagrams below illustrate the complete system workflow:

### 1. Real-time Emergency Call Processing Pipeline

<p align="center">
  <img width="1026" height="219" alt="Real-time emergency call processing pipeline from VoIP caller through speech recognition, translation, LLM-based reconstruction, and dispatcher response flow" src="https://github.com/user-attachments/assets/f81fdc2a-ff70-4973-b344-0f937331634d" />
</p>

### 2. Blockchain-Based Secure Storage Architecture

<p align="center">
  <img width="794" height="493" alt="Blockchain-based secure storage architecture using Shamir's secret sharing, Arweave decentralized storage, and Solana multisig access control with PSAP encryption module" src="https://github.com/user-attachments/assets/bbb64542-547b-4612-958a-3d622b277d8a" />
</p>

---

**Note**: The private keys in this repository are for testing on the Solana devnet only and do not control any real assets.


@article{rafi2025multilingual,
  title={Multilingual Low-Latency Emergency VoIP System Using LLM for Speech Reconstruction and Blockchain for Secure Data Archiving},
  author={Rafi, Rahman A and Ahmed, Shakil and Venkateshperumal, Danush and Khokhar, Ashfaq and Arifuzzaman, Md and Azad, AKM and Alyami, Salem A},
  journal={IEEE Access},
  year={2025},
  publisher={IEEE}
}
