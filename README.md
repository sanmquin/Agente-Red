# Agente Red - Voice Assistant for Google Docs (es-MX)

**Agente Red** es un agente de voz interactivo desarrollado en **React** que captura las respuestas de voz de un usuario de forma nativa en su navegador (usando Google Chrome native transcription API) y las escribe de forma estructurada en un documento de **Google Docs** usando **Gemini-flash-lite 3.1** (a través de Netlify serverless functions).

---

## 🚀 Características principales
- **Asistente de Voz Nativo:** Utiliza las APIs nativas del navegador Google Chrome para reproducción (Speech Synthesis - TTS) y transcripción (Speech Recognition - STT) configuradas en español de México (`es-MX`).
- **Guión Estructurado JSON:** El asistente sigue de forma exacta la secuencia y configuración descrita en `public/script.json`.
- **Estructuración con Gemini:** Procesa los textos crudos con el modelo Gemini de Google AI Studio para estructurar respuestas ejecutivas perfectas en formato JSON antes de grabarlas.
- **Ediciones Controladas (Google Docs):** Actualiza el documento de manera determinista utilizando la API oficial de Google Docs de forma segura desde el backend.
- **Modo Offline / Simulador:** Permite realizar pruebas completas y simular inserciones sin requerir credenciales activas o llaves API, ideal para demostración ágil.

---

## 📋 Script Piloto de Preguntas (Español - México)
El agente te formulará de manera interactiva las siguientes tres preguntas del piloto:
1. **¿Qué proyectos estás gestionando actualmente?**
2. **¿Cuáles son las principales fuentes de ingresos?**
3. **¿Qué ideas de crecimiento tienes?**

---

## 🛠️ Configuración del Documento de Google

Para enlazar este agente con un documento real de Google Docs, sigue estos pasos:

1. **Crear el Google Doc:**
   Crea un nuevo documento de Google Docs en [docs.new](https://docs.new).

2. **Obtener el Google Doc ID:**
   Copia el ID largo del documento desde la barra de direcciones de tu navegador. El ID se encuentra entre `/d/` y `/edit`. Ejemplo:
   `https://docs.google.com/document/d/1uB6pZ8Qo7H_MOCK_DOCUMENT_ID/edit` -> El ID es `1uB6pZ8Qo7H_MOCK_DOCUMENT_ID`.

3. **Compartir el Documento con la Cuenta de Servicio:**
   Haz clic en **Compartir** y otorga permisos de **Editor** al correo de la Cuenta de Servicio de Google (Service Account) configurada para el backend:
   `agente-red-service@agente-red-42.iam.gserviceaccount.com`

---

## ⚙️ Variables de Entorno (Netlify)

Para conectar el backend real en producción o de forma local, debes configurar las siguientes variables de entorno en tu panel de **Netlify** o archivo `.env`:

| Variable | Descripción | Requerido |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | API Key provista por Google AI Studio para el modelo Gemini-flash. | Sí (Real) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Correo electrónico de la Cuenta de Servicio de Google Cloud Console. | Sí (Real) |
| `GOOGLE_PRIVATE_KEY` | Clave privada (Private Key) del Service Account en formato JSON (`-----BEGIN PRIVATE KEY-----\n...`). | Sí (Real) |

---

## 💻 Desarrollo Local

Para correr este proyecto localmente, asegúrate de tener instalado Node.js y ejecuta los siguientes comandos:

```bash
# 1. Instalar dependencias
npm install

# 2. Correr el servidor de desarrollo local
npm run dev

# 3. Compilar para producción
npm run build
```

---

## 📝 Lista de Pendientes (TODOs) para Producción

- [ ] Reemplazar las credenciales de prueba por cuentas de servicio de Google Cloud Console de producción.
- [ ] Configurar un sistema de control de autenticación de usuarios para impedir que usuarios no autorizados escriban en documentos ajenos.
- [ ] Incorporar comandos de voz globales como *"Siguiente"*, *"Repetir"* o *"Guardar"* en la API de Speech Recognition para una navegación 100% libre de manos.
