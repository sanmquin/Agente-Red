export const handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido' })
    };
  }

  try {
    const { transcript, question, instruction, apiKey: bodyApiKey, model: bodyModel } = JSON.parse(event.body || '{}');

    if (!transcript) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Falta la transcripción' })
      };
    }

    const apiKey = bodyApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'GEMINI_API_KEY no está configurada. Configure el entorno de Netlify o ingrese una clave en la sección de configuración de la UI.' })
      };
    }

    const modelName = bodyModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const systemPrompt = `Eres el Agente Red, un asistente de voz profesional que captura respuestas en español (México) para rellenar un documento formal.
Tu tarea es tomar la transcripción informal del usuario, que corresponde a una pregunta específica, y transformarla en un párrafo limpio, pulido, profesional y bien redactado, ideal para un documento corporativo.
No elimines información importante, pero corrige la gramática, muletillas de voz y redacción.

Pregunta del documento: "${question}"
Instrucción de la pregunta: "${instruction || ''}"
Transcripción del usuario: "${transcript}"

Debes devolver la respuesta en formato JSON con la siguiente estructura:
{
  "answer": "La respuesta redactada de manera profesional y pulida"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: systemPrompt
          }]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              answer: {
                type: 'STRING',
                description: 'La respuesta redactada de manera profesional y pulida, corregida gramaticalmente.'
              }
            },
            required: ['answer']
          }
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `Error de Gemini API: ${errText}` })
      };
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'No se recibió respuesta válida de Gemini' })
      };
    }

    // Parse the JSON text returned by Gemini
    const geminiJson = JSON.parse(candidateText.trim());

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(geminiJson)
    };

  } catch (error) {
    console.error('Error en process-gemini:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
