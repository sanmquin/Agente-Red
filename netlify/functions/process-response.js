const { google } = require('googleapis');
const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { documentId, responses, mock } = body;

    if (!responses) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Faltan las respuestas del agente en la solicitud.' })
      };
    }

    // 1. If mock is enabled or keys are missing, simulate success with simulated payload structure
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const googleServiceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (mock || !geminiApiKey || !googleServiceAccountEmail || !googlePrivateKey) {
      console.log('Utilizando modo de simulación (MOCK/SIMULATED) para responder al cliente...');

      // Simulate deterministic JSON output that structured processing would output
      const mockStructuredData = {
        projects: {
          original: responses.projects || '',
          cleaned_es: `[SIMULADO] ${responses.projects || 'Sin proyectos registrados'}`,
          action_taken: "Inserto en sección Proyectos"
        },
        income: {
          original: responses.income || '',
          cleaned_es: `[SIMULADO] ${responses.income || 'Sin ingresos registrados'}`,
          action_taken: "Inserto en sección Ingresos"
        },
        growth: {
          original: responses.growth || '',
          cleaned_es: `[SIMULADO] ${responses.growth || 'Sin ideas de crecimiento registradas'}`,
          action_taken: "Inserto en sección Crecimiento"
        }
      };

      // We simulate success and return payload
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Simulación completada con éxito. Google Doc no modificado realmente.',
          structuredData: mockStructuredData,
          mock: true,
          warning: (!geminiApiKey || !googleServiceAccountEmail || !googlePrivateKey)
            ? 'Se usó el modo simulación por falta de variables de entorno reales en Netlify.'
            : undefined
        })
      };
    }

    // 2. Real Integration with Gemini-flash-lite 3.1 & Google Docs API
    // 2a. Call Gemini to format and clean user input in JSON
    let structuredResult = {
      projects: responses.projects,
      income: responses.income,
      growth: responses.growth
    };

    try {
      const ai = new GoogleGenerativeAI(geminiApiKey);
      // We target gemini-2.5-flash as the latest standard name, fallback to gemini-1.5-flash
      const model = ai.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `
        Eres "Agente Red". Tu tarea es procesar las transcripciones de voz de un usuario en español de México (es-MX) y convertirlas en respuestas de texto redactadas de manera clara, profesional, coherente y organizada.
        Debes responder estrictamente en formato JSON con la siguiente estructura:
        {
          "projects": "La respuesta pulida de proyectos gestionados",
          "income": "La respuesta pulida sobre las fuentes de ingresos principales",
          "growth": "La respuesta pulida sobre ideas de crecimiento"
        }

        Las respuestas de voz crudas son las siguientes:
        - Proyectos gestionados: "${responses.projects || 'Sin respuesta'}"
        - Fuentes de ingreso: "${responses.income || 'Sin respuesta'}"
        - Ideas de crecimiento: "${responses.growth || 'Sin respuesta'}"

        Asegúrate de limpiar tartamudeos, corregir gramática, enriquecer ligeramente la redacción para que luzca muy formal y profesional para un reporte ejecutivo, pero sin inventar información no provista.
      `;

      const aiResponse = await model.generateContent(prompt);
      const aiText = aiResponse.response.text();
      structuredResult = JSON.parse(aiText);
    } catch (geminiError) {
      console.error('Error al invocar Gemini API, usando texto original sin pulir:', geminiError);
      // Fallback to original responses if LLM fails
    }

    // 2b. Write to Google Docs using Google Service Account
    // We authorize using the google service account
    const auth = new google.auth.JWT(
      googleServiceAccountEmail,
      null,
      googlePrivateKey.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/documents']
    );

    const docs = google.docs({ version: 'v1', auth });

    // Let's perform deterministic updates on Google Docs: Append structured titles and responses to the document
    const requests = [
      {
        insertText: {
          endOfSegmentLocation: {},
          text: `\n\n=== REPORTE GENERADO POR AGENTE RED ===\nFecha: ${new Date().toLocaleDateString('es-MX')}\n\n`
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
        message: 'Google Doc actualizado correctamente de forma estructurada.',
        structuredData: structuredResult,
        mock: false
      })
    };

  } catch (error) {
    console.error('Error en netlify function process-response:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error interno de servidor backend.',
        details: error.message
      })
    };
  }
};
