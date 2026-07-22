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
  questionKey?: string;
  questionTitle?: string;
  responseValue?: string;
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
    const { documentId, responses, action, questionKey, questionTitle, responseValue } = body;

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

    // Helper to find the end index of the document
    const getDocumentEndIndex = async (docId: string): Promise<number> => {
      try {
        const doc = await docs.documents.get({ documentId: docId });
        const content = doc.data.body?.content || [];
        if (content.length > 0) {
          const lastElement = content[content.length - 1];
          return (lastElement.endIndex || 1) - 1;
        }
      } catch (err) {
        console.error('Error fetching document structure:', err);
      }
      return 1;
    };

    // Helper to generate styled batchUpdate requests
    const buildStyledRequests = (currentIndex: number, sections: { text: string; style?: any }[]) => {
      let accumulatedText = "";
      const requests: any[] = [];
      let offset = 0;

      for (const s of sections) {
        const start = offset;
        accumulatedText += s.text;
        const end = offset + s.text.length;
        offset = end;

        if (s.style) {
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: currentIndex + start,
                endIndex: currentIndex + end
              },
              textStyle: s.style,
              fields: Object.keys(s.style).join(',')
            }
          });
        }
      }

      // Add the insert request at the very beginning of the batch
      requests.unshift({
        insertText: {
          location: { index: currentIndex },
          text: accumulatedText
        }
      });

      return requests;
    };

    // Handle "validate" action
    if (action === 'validate') {
      const currentIndex = await getDocumentEndIndex(documentId);

      const sections = [
        {
          text: `\n\n=========================================\n CONEXIÓN VALIDADA CON AGENTE RED ALTRUISTA\n=========================================\n`,
          style: {
            bold: true,
            fontSize: { magnitude: 12, unit: 'PT' },
            foregroundColor: {
              color: { rgbColor: { red: 5/255, green: 150/255, blue: 105/255 } }
            }
          }
        },
        {
          text: `Fecha y Hora: ${new Date().toLocaleString('es-MX')}\n`,
          style: {
            italic: true,
            fontSize: { magnitude: 10, unit: 'PT' },
            foregroundColor: {
              color: { rgbColor: { red: 100/255, green: 116/255, blue: 139/255 } }
            }
          }
        },
        {
          text: `La conexión con el documento ha sido establecida correctamente y el Agente Red Altruista está listo para capturar respuestas con estilo y profesionalismo.\n-----------------------------------------\n\n`,
          style: {
            fontSize: { magnitude: 10, unit: 'PT' },
            foregroundColor: {
              color: { rgbColor: { red: 30/255, green: 41/255, blue: 59/255 } }
            }
          }
        }
      ];

      const validateRequests = buildStyledRequests(currentIndex, sections);

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

    // Handle real-time single question update
    if (action === 'update-question') {
      if (!questionTitle || !questionKey) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing question information for real-time update.' })
        };
      }

      let polishedResponse = responseValue || 'No especificado';

      // Refine single response if Gemini is available
      if (geminiApiKey && responseValue?.trim()) {
        try {
          const ai = new GoogleGenerativeAI(geminiApiKey);
          const model = ai.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: { responseMimeType: 'application/json' }
          });

          const prompt = `
            You are "Agente Red Altruista", a helpful and supportive voice assistant.
            Your task is to refine a raw Spanish voice transcription response and make it structured, professional, and clear.

            Source of errors:
            The raw transcription is captured using native browser Speech-to-Text APIs, which restart dynamically when the user pauses to think or elaborate. This results in missing punctuation, lack of proper spacing/capitalization, repetitive word stutters (e.g. "yo yo..."), background mic noise artifacts, or phonetic misinterpretations.

            Instructions:
            - Correct all punctuation, missing commas, periods, and capitalization.
            - Clean up stutters, repetitions, and vocal fillers (e.g., "este", "eh", "bueno").
            - Fix phonetic transcription typos or misheard words, ensuring the text is coherent and grammatically pristine.
            - Maintain the user's original ideas and facts exactly; do not invent or extrapolate details.
            - Output the polished, cohesive text in professional Mexican Spanish.

            Return a JSON response matching this schema:
            {
              "polishedResponse": "The polished response paragraph in Spanish"
            }

            Context:
            - Question Title: "${questionTitle}"
            - Raw transcription: "${responseValue}"
          `;

          const aiResponse = await model.generateContent(prompt);
          const aiText = aiResponse.response.text();
          const parsed = JSON.parse(aiText) as { polishedResponse: string };
          if (parsed.polishedResponse) {
            polishedResponse = parsed.polishedResponse;
          }
        } catch (err) {
          console.error('Real-time Gemini refinement failed, using raw response:', err);
        }
      }

      const currentIndex = await getDocumentEndIndex(documentId);

      const sections = [
        {
          text: `\n\n[ACTUALIZACIÓN EN TIEMPO REAL: ${new Date().toLocaleTimeString('es-MX')}]\n`,
          style: {
            italic: true,
            fontSize: { magnitude: 9, unit: 'PT' },
            foregroundColor: {
              color: { rgbColor: { red: 100/255, green: 116/255, blue: 139/255 } }
            }
          }
        },
        {
          text: `${questionTitle.toUpperCase()}\n`,
          style: {
            bold: true,
            fontSize: { magnitude: 12, unit: 'PT' },
            foregroundColor: {
              color: { rgbColor: { red: 5/255, green: 150/255, blue: 105/255 } }
            }
          }
        },
        {
          text: `${polishedResponse}\n\n`,
          style: {
            fontSize: { magnitude: 11, unit: 'PT' },
            foregroundColor: {
              color: { rgbColor: { red: 30/255, green: 41/255, blue: 59/255 } }
            }
          }
        },
        {
          text: `-----------------------------------------\n\n`,
          style: {
            foregroundColor: {
              color: { rgbColor: { red: 100/255, green: 116/255, blue: 139/255 } }
            }
          }
        }
      ];

      const questionRequests = buildStyledRequests(currentIndex, sections);

      await docs.documents.batchUpdate({
        documentId: documentId,
        requestBody: {
          requests: questionRequests
        }
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Question updated in real-time successfully.',
          polishedResponse
        })
      };
    }

    // Handle standard/default response processing (single final pass)
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

    // Process responses using Gemini AI model (gemini-3.1-flash-lite)
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
        You are "Agente Red Altruista", a helpful and supportive voice agent assisting non-profit organizers.
        Your task is to process raw voice transcription inputs in Mexican Spanish (es-MX) and format them into professional, clear, and executive-level responses.

        Source of errors:
        The raw transcription is captured using native browser Speech-to-Text APIs, which restart dynamically when the user pauses to think or elaborate. This results in missing punctuation, lack of proper spacing/capitalization, repetitive word stutters (e.g. "yo yo..."), background mic noise artifacts, or phonetic misinterpretations.

        Instructions:
        - Correct all punctuation, missing commas, periods, and capitalization.
        - Clean up stutters, repetitions, and vocal fillers (e.g., "este", "eh", "bueno").
        - Fix phonetic transcription typos or misheard words, ensuring the text is coherent and grammatically pristine.
        - Maintain the user's original ideas and facts exactly; do not invent or extrapolate details.
        - Output the polished, cohesive text in professional Mexican Spanish.

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
      `;

      const aiResponse = await model.generateContent(prompt);
      const aiText = aiResponse.response.text();
      structuredResult = JSON.parse(aiText) as Responses;
    } catch (geminiError) {
      console.error('Gemini API call failed, falling back to raw response text:', geminiError);
    }

    // Append structured text with styles to the Google Doc
    const currentIndex = await getDocumentEndIndex(documentId);

    const sections = [
      {
        text: `\n\n=========================================\n REPORTE DE ENTREVISTA: AGENTE RED ALTRUISTA\n=========================================\n`,
        style: {
          bold: true,
          fontSize: { magnitude: 14, unit: 'PT' },
          foregroundColor: {
            color: { rgbColor: { red: 5/255, green: 150/255, blue: 105/255 } }
          }
        }
      },
      {
        text: `Fecha y hora: ${new Date().toLocaleString('es-MX')}\n\n`,
        style: {
          italic: true,
          fontSize: { magnitude: 10, unit: 'PT' },
          foregroundColor: {
            color: { rgbColor: { red: 100/255, green: 116/255, blue: 139/255 } }
          }
        }
      },
      {
        text: `1. PROYECTOS ACTUALES:\n`,
        style: {
          bold: true,
          fontSize: { magnitude: 12, unit: 'PT' },
          foregroundColor: {
            color: { rgbColor: { red: 5/255, green: 150/255, blue: 105/255 } }
          }
        }
      },
      {
        text: `${structuredResult.projects || 'No especificado'}\n\n`,
        style: {
          fontSize: { magnitude: 11, unit: 'PT' },
          foregroundColor: {
            color: { rgbColor: { red: 30/255, green: 41/255, blue: 59/255 } }
          }
        }
      },
      {
        text: `2. FUENTES DE INGRESOS:\n`,
        style: {
          bold: true,
          fontSize: { magnitude: 12, unit: 'PT' },
          foregroundColor: {
            color: { rgbColor: { red: 5/255, green: 150/255, blue: 105/255 } }
          }
        }
      },
      {
        text: `${structuredResult.income || 'No especificado'}\n\n`,
        style: {
          fontSize: { magnitude: 11, unit: 'PT' },
          foregroundColor: {
            color: { rgbColor: { red: 30/255, green: 41/255, blue: 59/255 } }
          }
        }
      },
      {
        text: `3. IDEAS DE CRECIMIENTO:\n`,
        style: {
          bold: true,
          fontSize: { magnitude: 12, unit: 'PT' },
          foregroundColor: {
            color: { rgbColor: { red: 5/255, green: 150/255, blue: 105/255 } }
          }
        }
      },
      {
        text: `${structuredResult.growth || 'No especificado'}\n\n`,
        style: {
          fontSize: { magnitude: 11, unit: 'PT' },
          foregroundColor: {
            color: { rgbColor: { red: 30/255, green: 41/255, blue: 59/255 } }
          }
        }
      },
      {
        text: `-----------------------------------------\n\n`,
        style: {
          foregroundColor: {
            color: { rgbColor: { red: 100/255, green: 116/255, blue: 139/255 } }
          }
        }
      }
    ];

    const reportRequests = buildStyledRequests(currentIndex, sections);

    await docs.documents.batchUpdate({
      documentId: documentId,
      requestBody: {
        requests: reportRequests
      }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Google Doc updated successfully with styled structured responses.',
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
