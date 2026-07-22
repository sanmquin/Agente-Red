import { google } from 'googleapis';

export const handler = async (event, context) => {
  // CORS Headers
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
    const { documentId, replacements, clientEmail, privateKey } = JSON.parse(event.body || '{}');

    if (!documentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Falta documentId' })
      };
    }

    if (!replacements || typeof replacements !== 'object') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Falta replacements o formato inválido' })
      };
    }

    // Resolve credentials from env or request body
    const finalClientEmail = clientEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let finalPrivateKey = privateKey || process.env.GOOGLE_PRIVATE_KEY;

    if (!finalClientEmail || !finalPrivateKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Credenciales de Google de Cuenta de Servicio incompletas. Configure GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY en Netlify o proporciónelas en la UI.'
        })
      };
    }

    // Replace literal escaped newlines with actual newlines
    finalPrivateKey = finalPrivateKey.replace(/\\n/g, '\n');

    // Authenticate with Google API
    const auth = new google.auth.JWT(
      finalClientEmail,
      null,
      finalPrivateKey,
      ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive']
    );

    await auth.authorize();

    const docs = google.docs({ version: 'v1', auth });

    // Construct deterministic batchUpdate requests
    const requests = Object.entries(replacements).map(([key, value]) => ({
      replaceAllText: {
        containsText: {
          text: key,
          matchCase: true
        },
        replaceText: value || ''
      }
    }));

    if (requests.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No se enviaron reemplazos' })
      };
    }

    const response = await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        documentId,
        replacementsCount: requests.length,
        result: response.data
      })
    };

  } catch (error) {
    console.error('Error en update-doc:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
