import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Responses {
  projects?: string;
  income?: string;
  growth?: string;
}

interface RequestBody {
  documentId?: string;
  responses?: Responses;
  action?: string;
}

export const handler = async (
  event: { httpMethod: string; body?: string },
  _context: unknown
) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}') as RequestBody;
    const { documentId, responses, action } = body;

    if (!documentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Document ID is required.' })
      };
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const googleServiceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!googleServiceAccountEmail || !googlePrivateKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Missing Google credentials on the server. Please check your environment variables.'
        })
      };
    }

    // Authenticate with Google
    const auth = new google.auth.JWT({
      email: googleServiceAccountEmail,
      key: googlePrivateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/documents']
    });

    const docs = google.docs({ version: 'v1', auth });

    // Handle "validate" action
    if (action === 'validate') {
      const validateRequests = [
        {
          insertText: {
            endOfSegmentLocation: {},
            text: `\n\n=== CONEXIÓN VALIDADA CON AGENTE VERDE ===\nFecha y Hora: ${new Date().toLocaleString('es-MX')}\n\n`
          }
        }
      ];

      await docs.documents.batchUpdate({
        documentId: documentId,
        requestBody: {
          requests: validateRequests
        }
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Document write validation completed successfully.'
        })
      };
    }

    // Handle normal response processing
    if (!responses) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing agent responses in the request.' })
      };
    }

    if (!geminiApiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing GEMINI_API_KEY environment variable.' })
      };
    }

    // Process responses using Gemini AI model (gemini-1.5-flash)
    let structuredResult: Responses = {
      projects: responses.projects,
      income: responses.income,
      growth: responses.growth
    };

    try {
      const ai = new GoogleGenerativeAI(geminiApiKey);
      const model = ai.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        generationConfig: { responseMimeType: 'application/json' }
      });

      const prompt = `
        You are "Agente Verde", a helpful and supportive voice agent assisting non-profit organizers.
        Your task is to process raw voice transcription inputs in Mexican Spanish (es-MX) and format them into professional, clear, and executive-level responses.
        You must return a strict JSON response with the following keys and no extra formatting:
        {
          "projects": "Formatted and polished projects response",
          "income": "Formatted and polished income sources response",
          "growth": "Formatted and polished growth ideas response"
        }

        Here are the raw voice transcription responses:
        - Current Projects: "${responses.projects || 'No response'}"
        - Income Sources: "${responses.income || 'No response'}"
        - Growth Ideas: "${responses.growth || 'No response'}"

        Please clean up stutters, fix grammar, and enhance the phrasing to sound clean, formal, and structured, whilst retaining the original Spanish language. Do not invent any facts or details that were not provided.
      `;

      const aiResponse = await model.generateContent(prompt);
      const aiText = aiResponse.response.text();
      structuredResult = JSON.parse(aiText) as Responses;
    } catch (geminiError) {
      console.error('Gemini API call failed, falling back to raw response text:', geminiError);
    }

    // Append structured text to the Google Doc
    const requests = [
      {
        insertText: {
          endOfSegmentLocation: {},
          text: `\n\n=== REPORTE GENERADO POR AGENTE VERDE ===\nFecha: ${new Date().toLocaleDateString('es-MX')}\n\n`
        }
      },
      {
        insertText: {
          endOfSegmentLocation: {},
          text: `1. PROYECTOS ACTUALES:\n${structuredResult.projects || 'No especificado'}\n\n`
        }
      },
      {
        insertText: {
          endOfSegmentLocation: {},
          text: `2. FUENTES DE INGRESOS:\n${structuredResult.income || 'No especificado'}\n\n`
        }
      },
      {
        insertText: {
          endOfSegmentLocation: {},
          text: `3. IDEAS DE CRECIMIENTO:\n${structuredResult.growth || 'No especificado'}\n\n`
        }
      }
    ];

    await docs.documents.batchUpdate({
      documentId: documentId,
      requestBody: {
        requests: requests
      }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Google Doc updated successfully with structured responses.',
        structuredData: structuredResult
      })
    };

  } catch (error: any) {
    console.error('Error in Netlify function process-response:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error.',
        details: error?.message || 'Unknown error'
      })
    };
  }
};
