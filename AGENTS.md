# Agente Red Altruista - Voice Assistant Developer Guidelines

Welcome to the development scope of Agente Red Altruista. To ensure the codebase remains clean, secure, and easily maintainable, all contributions must respect the guidelines outlined below.

## 1. Modular Coding Principles
- Do not build large monolithic React structures (e.g. keeping everything inside a single `App.jsx`).
- Break down interfaces and workflows into clean, reusable modular components under `src/components/`.
- Maintain clean state propagation down to child components, utilizing simple events and hooks.

## 2. English Documentation and Comments
- All code, comments, variables, and API logs in the backend serverless functions and frontend source files must be written in **English**.
- Only the user-facing interface text (UI labels, titles, inputs) and the spoken prompt text (audio script, native voice assistant questions) are allowed to be in Spanish (configured for Mexican Spanish `es-MX`).

## 3. Strict Secrets Safety
- **No JSON secret key files or API key strings may be committed to the repository.**
- All sensitive variables (including Gemini and Google Service Account private keys) must be resolved securely using standard Environment Variables.
- Ensure any environment-specific `.env` or `.env.local` file is explicitly ignored in `.gitignore`.

## 4. Google Docs Verification First
- Under no circumstances should the system allow mock/simulated interview data insertion.
- The workflow must mandate verification of the target Google Doc (using a write-test) before releasing the voice interview.
