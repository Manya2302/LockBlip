import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI = null;
let customModelHandler = null;

export function initializeGemini(apiKey) {
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✓ Gemini AI initialized');
  }
}

export function setCustomModelHandler(handler) {
  customModelHandler = handler;
  console.log('✓ Custom AI model handler set');
}

export async function summarizeChat(messages, options = {}) {
  const {
    useCustomModel = false,
    isGroupChat = false,
    maxLength = 500,
  } = options;

  if (useCustomModel && customModelHandler) {
    return await customModelHandler(messages, options);
  }

  if (!genAI) {
    throw new Error('Gemini AI not initialized. Please set GEMINI_API_KEY.');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const formattedMessages = messages.map(msg => {
    const sender = msg.sender || 'Unknown';
    const content = msg.content || msg.text || '';
    const type = msg.messageType || 'text';
    
    if (type === 'audio' && msg.transcription) {
      return `[${sender}] (Voice Note): ${msg.transcription}`;
    }
    return `[${sender}]: ${content}`;
  }).join('\n');

  let prompt;
  if (isGroupChat) {
    prompt = `You are a helpful assistant that summarizes chat conversations. 
    
Summarize this group chat conversation. Group messages by who said what, highlight:
- Key decisions made
- Action items or tasks mentioned
- Important shared information (locations, links, etc.)
- Frequently discussed topics

Keep the summary concise (max ${maxLength} characters) and easy to scan.

Conversation:
${formattedMessages}

Summary:`;
  } else {
    prompt = `You are a helpful assistant that summarizes chat conversations.

Summarize this conversation between two people. Highlight:
- Main topics discussed
- Key decisions or agreements
- Any action items or follow-ups mentioned
- Important information shared

Keep the summary concise (max ${maxLength} characters) and easy to scan.

Conversation:
${formattedMessages}

Summary:`;
  }

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();
    
    return {
      summary: summary.trim(),
      messageCount: messages.length,
      generatedAt: new Date(),
      model: 'gemini-2.0-flash',
    };
  } catch (error) {
    console.error('Gemini summarization error:', error);
    
    // Check for specific error types
    if (error.status === 403) {
      if (error.message?.includes('leaked')) {
        throw new Error('API key has been invalidated. Please update your Gemini API key.');
      }
      throw new Error('API key is invalid or unauthorized. Please check your Gemini API key.');
    }
    
    if (error.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    throw new Error('Failed to generate summary. Please try again.');
  }
}

export async function transcribeAudio(audioUrl) {
  if (customModelHandler) {
    return await customModelHandler({ type: 'transcribe', audioUrl });
  }

  if (!genAI) {
    throw new Error('Gemini AI not initialized. Please set GEMINI_API_KEY.');
  }

  return {
    transcription: '[Voice note - transcription pending]',
    duration: 0,
  };
}

export async function extractKeywords(text) {
  if (!genAI) {
    return [];
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const prompt = `Extract 3-5 key topics/keywords from this text. Return only a comma-separated list of keywords, nothing else.

Text: ${text}

Keywords:`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const keywords = response.text().split(',').map(k => k.trim());
    return keywords;
  } catch (error) {
    console.error('Keyword extraction error:', error);
    return [];
  }
}

export function isAIAvailable() {
  return !!(genAI || customModelHandler);
}
