# Agente Verde - Voice Assistant for Google Docs (es-MX)

**Agente Verde** is an interactive voice agent developed in **React** that captures user voice responses natively in the browser (using the native Google Chrome Speech Recognition transcription API) and writes them in a structured format directly to a **Google Doc** after refining the input with **Gemini-1.5-flash** (processed securely via Netlify serverless functions).

This tool is specifically designed to support non-profit organizations with a helpful, friendly persona and calming emerald green colors.

---

## 🚀 Key Features
- **Calming & Peaceful Design:** Styled using a soothing Emerald Green theme representing development and supportive action (completely avoiding colors associated with warning/violence).
- **Friendly & Supportive Voice Selection:** Integrated with warm, higher-pitched, pleasant native Spanish voices, avoiding deep, robotic, or harsh synthesizers.
- **Secure Architecture:** Built under standard modular React components. Local files (`.env`, `.env.local`, `.env.*`) are ignored to protect API credentials.
- **Setup Verification & No Lost Work:** Users are guided step-by-step to set up their Google Doc first. Access and edit permissions are validated before starting the voice agent, ensuring you never lose your speech responses.
- **Real-time API Monitor:** View the exact payload structured on the client-side for server submission.

---

## 📋 Interactive Pilot Script (Mexican Spanish - es-MX)
The friendly voice agent will guide you through these three pilot questions:
1. **¿Qué proyectos estás gestionando actualmente?** (What projects are you currently managing?)
2. **¿Cuáles son las principales fuentes de ingresos?** (What are the primary income sources?)
3. **¿Qué ideas de crecimiento tienes?** (What are your growth ideas?)

---

## 🛠️ Google Doc Configuration

To link this agent to your Google Doc:

1. **Create a Google Doc:**
   Create a new blank document on [docs.new](https://docs.new).

2. **Retrieve the Document ID:**
   Copy the long alphanumeric ID from your browser's address bar. It resides between `/d/` and `/edit`.
   *Example:* `https://docs.google.com/document/d/1uB6pZ8Qo7H_MOCK_DOCUMENT_ID/edit` -> The ID is `1uB6pZ8Qo7H_MOCK_DOCUMENT_ID`.

3. **Share Access with Service Account:**
   Click **Share** in Google Docs and grant **Editor** privileges to the application's service account email:
   `agente-red-service@agente-red-42.iam.gserviceaccount.com`

4. **Verify connection:**
   Type or paste the ID into the **Google Doc Integration** panel on the UI and click **Validate and Open Document**. This checks real-time write capability by adding a validation tag to the document. The interview flow will unlock immediately upon success.

---

## ⚙️ Environment Configuration

To run real-world operations in production (Netlify) or local development, you must configure server environment keys.

### Secure Configuration Method
**Warning: Never hardcode or commit JSON files or environment secrets containing keys.**

Instead, use standard environment variables. You can configure them in your **Netlify dashboard** under **Site settings > Environment variables**, or locally by creating a `.env.local` file at the root of your project (which is automatically ignored by `.gitignore`):

| Variable | Description |
| :--- | :--- |
| `GEMINI_API_KEY` | Your Google AI Studio API key for Gemini. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | The service account client email. |
| `GOOGLE_PRIVATE_KEY` | The private key from your service account JSON file. Replace escaped line breaks (`\n` strings) with actual line breaks or leave as-is depending on your system's environment variable parsing. |

---

## 💻 Local Development

Ensure you have Node.js installed, then execute:

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build for production
npm run build
```

---

## 📝 Future Production Tasks (TODOs)
- Integrate global voice commands like *"Siguiente"*, *"Repetir"*, or *"Guardar"* directly into the Speech Recognition API.
- Support user access lists/scopes to authenticate individual Google Service accounts on the client.
