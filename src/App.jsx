import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Square, Mic, MicOff, RefreshCw, Send, CheckCircle,
  HelpCircle, Settings, FileText, Database, Info, Copy, Check, AlertCircle, Sparkles, Volume2, ArrowRight
} from 'lucide-react';

export default function App() {
  // Voice Agent State
  const [script, setScript] = useState(null);
  const [currentStep, setCurrentStep] = useState('welcome'); // 'welcome', 'question_0', 'question_1', 'question_2', 'processing', 'completed'
  const [responses, setResponses] = useState({
    projects: '',
    income: '',
    growth: ''
  });
  const [editedResponse, setEditedResponse] = useState('');
  const [transcriptLog, setTranscriptLog] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [backendStatus, setBackendStatus] = useState(null); // 'success', 'error', 'loading'
  const [backendPayload, setBackendPayload] = useState(null);

  // Connection & Auth Settings State
  const [mockMode, setMockMode] = useState(true);
  const [docId, setDocId] = useState('');
  const [copiedText, setCopiedText] = useState('');

  // Browser Web Speech API references
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const currentUtteranceRef = useRef(null);

  // Load Script on Mount
  useEffect(() => {
    fetch('/script.json')
      .then(res => res.json())
      .then(data => {
        setScript(data);
      })
      .catch(err => {
        console.error('Error cargando el script.json:', err);
        setErrorMessage('No se pudo cargar la configuración de Agente Red.');
      });
  }, []);

  // Web Speech STT API Initialization
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'es-MX';

      rec.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        if (currentText.trim()) {
          setEditedResponse(prev => {
            // Avoid duplicate appends if we are just starting
            return currentText;
          });
        }
      };

      rec.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setErrorMessage(`Error de transcripción: ${event.error}`);
          setIsListening(false);
        }
      };

      rec.onend = () => {
        // Automatically restart if we were listening, unless stopped explicitly
        if (isListening) {
          try {
            rec.start();
          } catch (e) {
            console.error(e);
          }
        }
      };

      recognitionRef.current = rec;
    } else {
      console.warn('La API Web Speech (SpeechRecognition) no es soportada de forma nativa en este navegador.');
    }
  }, [isListening]);

  // Handle Speech synthesis (TTS)
  const speakText = (text, callback) => {
    if (!synthRef.current) return;

    // Stop any current speech
    synthRef.current.cancel();
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';

    // Find an es-MX or es-ES voice if possible
    const voices = synthRef.current.getVoices();
    const mxVoice = voices.find(v => v.lang.includes('es-MX')) || voices.find(v => v.lang.includes('es'));
    if (mxVoice) {
      utterance.voice = mxVoice;
    }

    utterance.onend = () => {
      setIsSpeaking(false);
      if (callback) callback();
    };

    utterance.onerror = (e) => {
      console.error('Speech synthesis error:', e);
      setIsSpeaking(false);
      if (callback) callback();
    };

    currentUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  // Start Voice Assistant Flow
  const startAssistant = () => {
    if (!script) return;
    setCurrentStep('welcome');
    speakText(script.welcomeMessage, () => {
      // Automatically advance to Question 1 after greeting
      goToQuestion(0);
    });
  };

  const goToQuestion = (index) => {
    if (!script) return;
    const q = script.questions[index];
    setCurrentStep(`question_${index}`);

    // Reset inputs for this step
    const currentKey = q.key;
    setEditedResponse(responses[currentKey] || '');

    // Read question out loud
    speakText(q.ttsPrompt, () => {
      // Start recording automatically after reading the question
      startListening();
    });
  };

  // Recording Controls
  const startListening = () => {
    stopSpeaking();
    if (recognitionRef.current) {
      setErrorMessage('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Fallo al iniciar grabación:', err);
      }
    } else {
      setErrorMessage('Tu navegador no soporta Speech Recognition de forma nativa. Por favor introduce tu respuesta de forma manual.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    setIsListening(false);
  };

  const saveResponseAndNext = (index) => {
    stopListening();
    stopSpeaking();

    const q = script.questions[index];
    const updatedResponses = {
      ...responses,
      [q.key]: editedResponse
    };
    setResponses(updatedResponses);

    // Save logs
    setTranscriptLog(prev => [
      ...prev,
      { question: q.title, rawResponse: editedResponse }
    ]);

    // Go to next question or complete
    if (index < script.questions.length - 1) {
      goToQuestion(index + 1);
    } else {
      // Final completion step
      setCurrentStep('processing');
      speakText(script.completionMessage, () => {
        submitToGoogleDocs(updatedResponses);
      });
    }
  };

  // Reset/Restart Agent Flow
  const resetAgent = () => {
    stopListening();
    stopSpeaking();
    setResponses({ projects: '', income: '', growth: '' });
    setEditedResponse('');
    setTranscriptLog([]);
    setBackendStatus(null);
    setBackendPayload(null);
    setErrorMessage('');
    setCurrentStep('welcome');
  };

  // Submit to Google Docs API through Netlify Function
  const submitToGoogleDocs = async (finalResponses) => {
    setBackendStatus('loading');

    const payload = {
      documentId: docId || '1uB6pZ8Qo7H_MOCK_DOCUMENT_ID',
      responses: finalResponses,
      mock: mockMode
    };

    setBackendPayload(payload);

    try {
      const response = await fetch('/.netlify/functions/process-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setBackendStatus('success');
        setCurrentStep('completed');
      } else {
        setBackendStatus('error');
        setErrorMessage(data.error || 'Ocurrió un error al intentar actualizar el documento.');
        setCurrentStep('completed');
      }
    } catch (err) {
      console.error('Error submitting data:', err);
      setBackendStatus('error');
      setErrorMessage('No se pudo conectar con la función de Netlify Backend. Verifica tu configuración.');
      setCurrentStep('completed');
    }
  };

  // Copy to clipboard utility
  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedText(key);
    setTimeout(() => setCopiedText(''), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* HEADER */}
      <header className="bg-red-600 text-white shadow-lg py-5 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-full shadow text-red-600 animate-pulse">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight m-0 text-white leading-none">Agente Red</h1>
              <p className="text-red-100 text-sm mt-1">Tu Agente de Voz para Documentar en Google Docs (es-MX)</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-red-700/50 p-2 rounded-lg border border-red-500/30">
            <span className="text-xs font-semibold text-red-200">MODO DE OPERACIÓN:</span>
            <button
              onClick={() => setMockMode(!mockMode)}
              className={`px-3 py-1 text-xs font-bold rounded transition-all duration-300 ${
                mockMode
                  ? 'bg-amber-400 text-slate-900 shadow-md border border-amber-300'
                  : 'bg-green-500 text-white shadow-md border border-green-400'
              }`}
            >
              {mockMode ? 'Offline / Simulador (Sin API Keys)' : 'Conexión Real (Google / Gemini)'}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: THE VOICE INTERACTIVE AGENT */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          {/* CONTROL DE AGENTE DE VOZ */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 flex flex-col justify-between min-h-[480px]">
            <div>
              {/* Voice Agent Top Status */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 relative">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isListening ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isListening ? 'bg-red-600' : 'bg-green-600'}`}></span>
                  </span>
                  <span className="text-sm font-semibold text-slate-600">
                    {isListening ? 'Escuchándote...' : isSpeaking ? 'Agente Hablando...' : 'Agente Listo'}
                  </span>
                </div>
                <div className="text-xs bg-slate-100 px-2.5 py-1 rounded text-slate-500 font-mono">
                  Etapa: {currentStep}
                </div>
              </div>

              {/* INTERACTIVE PANEL BASED ON STATE */}
              {currentStep === 'welcome' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <Volume2 className="w-10 h-10 animate-bounce" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-3">¡Bienvenido a Agente Red!</h2>
                  <p className="text-slate-600 max-w-md mx-auto mb-8">
                    Este agente te guiará por medio de comandos de voz nativos para responder tres preguntas cruciales sobre tu negocio y guardarlos de forma organizada en Google Docs.
                  </p>
                  <button
                    onClick={startAssistant}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2 text-lg transform hover:-translate-y-0.5"
                  >
                    <Play className="fill-current w-5 h-5" /> Comenzar Entrevista de Voz
                  </button>
                </div>
              )}

              {/* QUESTIONS (0, 1, 2) */}
              {script && currentStep.startsWith('question_') && (() => {
                const index = parseInt(currentStep.split('_')[1]);
                const q = script.questions[index];
                return (
                  <div>
                    <div className="mb-4">
                      <span className="text-xs font-bold text-red-600 tracking-wider uppercase bg-red-50 px-2.5 py-1 rounded">
                        Pregunta {index + 1} de {script.questions.length}
                      </span>
                      <h2 className="text-xl font-bold text-slate-800 mt-3 flex items-center gap-2">
                        {q.title}
                        <button
                          onClick={() => speakText(q.ttsPrompt)}
                          title="Escuchar de nuevo"
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                        >
                          <Volume2 className="w-5 h-5" />
                        </button>
                      </h2>
                      <p className="text-slate-500 text-sm italic mt-1">{q.instructions}</p>
                    </div>

                    {/* LIVE TRANSCRIPTION INPUT / EDIT AREA */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 relative min-h-[140px] flex flex-col justify-between">
                      <textarea
                        value={editedResponse}
                        onChange={(e) => setEditedResponse(e.target.value)}
                        placeholder={q.placeholder}
                        className="w-full bg-transparent border-0 resize-none focus:outline-none focus:ring-0 text-slate-700 text-base"
                        rows="4"
                      />

                      {isListening && (
                        <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1 rounded-full text-xs text-red-600 animate-pulse">
                          <Mic className="w-3.5 h-3.5" /> Transcribiendo...
                        </div>
                      )}
                    </div>

                    {/* CONTROLS */}
                    <div className="flex flex-wrap gap-3 items-center justify-between border-t border-slate-100 pt-4">
                      <div className="flex gap-2">
                        {isListening ? (
                          <button
                            onClick={stopListening}
                            className="bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 text-sm"
                          >
                            <MicOff className="w-4 h-4" /> Pausar Micrófono
                          </button>
                        ) : (
                          <button
                            onClick={startListening}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 text-sm shadow"
                          >
                            <Mic className="w-4 h-4 animate-bounce" /> Activar Micrófono
                          </button>
                        )}

                        <button
                          onClick={() => setEditedResponse('')}
                          className="border border-slate-300 hover:bg-slate-50 text-slate-600 font-semibold py-2 px-3 rounded-lg flex items-center gap-2 text-sm"
                        >
                          <RefreshCw className="w-4 h-4" /> Limpiar
                        </button>
                      </div>

                      <button
                        onClick={() => saveResponseAndNext(index)}
                        disabled={!editedResponse.trim()}
                        className={`font-bold py-2.5 px-5 rounded-lg flex items-center gap-2 text-sm transition-all ${
                          editedResponse.trim()
                            ? 'bg-red-600 text-white hover:bg-red-700 shadow-md cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        Siguiente <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* PROCESSING STEP */}
              {currentStep === 'processing' && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Guardando Respuestas</h3>
                  <p className="text-slate-600">
                    El Agente Red está organizando tus respuestas y contactando con el backend de Google Docs...
                  </p>
                </div>
              )}

              {/* COMPLETED STEP */}
              {currentStep === 'completed' && (
                <div className="py-4">
                  <div className="text-center mb-6">
                    {backendStatus === 'success' ? (
                      <>
                        <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                          <CheckCircle className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-bold text-green-700 mb-1">¡Guardado con éxito!</h2>
                        <p className="text-slate-600 text-sm max-w-md mx-auto">
                          Tus respuestas han sido procesadas con Gemini e insertadas deterministicamente en tu Google Doc.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                          <AlertCircle className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-bold text-amber-700 mb-1">Operación Completada</h2>
                        <p className="text-slate-600 text-sm max-w-md mx-auto">
                          Se procesó la solicitud pero {mockMode ? 'se completó en modo de simulación' : 'ocurrió una advertencia/error'}.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Summary Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 border-b pb-1">
                      Resumen de Datos Capturados:
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-bold text-slate-700">1. Proyectos:</span>
                        <p className="text-slate-600 pl-3 border-l-2 border-red-500 mt-1">{responses.projects || 'Sin respuesta'}</p>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700">2. Fuentes de Ingreso:</span>
                        <p className="text-slate-600 pl-3 border-l-2 border-red-500 mt-1">{responses.income || 'Sin respuesta'}</p>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700">3. Ideas de Crecimiento:</span>
                        <p className="text-slate-600 pl-3 border-l-2 border-red-500 mt-1">{responses.growth || 'Sin respuesta'}</p>
                      </div>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 mb-4 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Detalle del Error / Advertencia:</span>
                        <p className="mt-1">{errorMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Re-run Buttons */}
                  <div className="flex gap-3 justify-center border-t border-slate-100 pt-4">
                    <button
                      onClick={resetAgent}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-6 rounded-lg transition-all text-sm shadow"
                    >
                      Reiniciar Agente Red
                    </button>
                    {mockMode && (
                      <div className="text-xs text-slate-400 self-center">
                        * Ejecutado en modo simulador sin consumir APIs.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Status Panel */}
            {currentStep !== 'completed' && currentStep !== 'welcome' && (
              <div className="border-t border-slate-100 pt-4 mt-6 flex justify-between items-center">
                <button
                  onClick={resetAgent}
                  className="text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reiniciar Proceso
                </button>
                <div className="text-xs text-slate-400">
                  Transcribiendo en: <span className="font-semibold text-slate-600">es-MX</span>
                </div>
              </div>
            )}
          </div>

          {/* SIMULATION & API MONITOR (Only visible or active during mockMode or loading) */}
          <div className="bg-slate-900 text-slate-200 rounded-2xl shadow-md p-6 border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-bold flex items-center gap-2 text-white">
                <Database className="w-5 h-5 text-amber-400" /> Monitor del Backend y JSON Payload
              </h3>
              <span className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold ${mockMode ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'}`}>
                {mockMode ? 'MODO SIMULADO' : 'CONEXIÓN EN VIVO'}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              A continuación se muestra el esquema JSON deterministicamente estructurado para ser enviado al endpoint Netlify
              y procesado por Gemini-flash-lite para estructurar las secciones del Google Doc:
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs overflow-x-auto max-h-[160px]">
              <pre>{JSON.stringify(backendPayload || {
                info: "El payload del JSON aparecerá aquí una vez completes las preguntas de Agente Red.",
                estado_actual_de_respuestas: responses,
                mock_activo: mockMode,
                doc_id_destino: docId || "Utilizando ID por defecto o demo"
              }, null, 2)}</pre>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: SETUP INSTRUCTIONS & KEYS DOCUMENTATION */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {/* CONFIGURATION BAR */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Settings className="w-5 h-5 text-red-600" /> Configuración de Enlace
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Google Doc ID (Destino)
                </label>
                <input
                  type="text"
                  placeholder="Introduce el ID de tu Google Doc"
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 focus:border-red-500 rounded-lg py-2 px-3 focus:outline-none"
                />
                <p className="text-slate-400 text-[11px] mt-1">
                  Si se deja vacío, el backend simulará la inserción o usará la clave demo.
                </p>
              </div>
            </div>
          </div>

          {/* DOCUMENT SETUP INSTRUCTIONS */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileText className="w-5 h-5 text-red-600" /> Configuración del Documento
            </h3>

            <ol className="space-y-4 text-xs text-slate-600 list-decimal pl-4">
              <li>
                <strong>Crea un documento de Google Docs:</strong>
                <p className="mt-1">
                  Ve a <a href="https://docs.new" target="_blank" rel="noreferrer" className="text-red-600 underline">docs.new</a> y crea un documento nuevo.
                </p>
              </li>
              <li>
                <strong>Obtén el ID del Documento:</strong>
                <p className="mt-1">
                  Copia el código alfanumérico largo en la URL entre <code>/d/</code> y <code>/edit</code>. Por ejemplo:
                  <br />
                  <code className="block bg-slate-100 p-1 rounded font-mono text-[10px] select-all my-1 overflow-x-auto">
                    1uB6pZ8Qo7H_MOCK_DOCUMENT_ID
                  </code>
                </p>
              </li>
              <li>
                <strong>Comparte el acceso con el Service Account:</strong>
                <p className="mt-1">
                  Haz clic en "Compartir" en Google Docs y agrega con permisos de <strong>Editor</strong> al correo de la Cuenta de Servicio de Google:
                  <code className="block bg-slate-100 p-1.5 rounded font-mono text-[10px] select-all mt-1 flex justify-between items-center overflow-x-auto text-slate-700">
                    <span>agente-red-service@agente-red-42.iam.gserviceaccount.com</span>
                    <button
                      onClick={() => copyText('agente-red-service@agente-red-42.iam.gserviceaccount.com', 'serv_acc')}
                      className="ml-2 hover:bg-slate-200 p-1 rounded text-red-600"
                    >
                      {copiedText === 'serv_acc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </code>
                </p>
              </li>
            </ol>
          </div>

          {/* BACKEND KEYS & ENV VARIABLES DOCUMENTATION */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Info className="w-5 h-5 text-red-600" /> Llaves y Variables del Servidor
            </h3>

            <p className="text-xs text-slate-500 mb-3">
              Para desplegar en producción con Netlify y enlazar con Gemini-flash lite 3.1 y Google Docs API real, debes configurar las siguientes variables de entorno:
            </p>

            <div className="space-y-3">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-xs font-bold text-slate-700">GEMINI_API_KEY</span>
                  <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">Requerida</span>
                </div>
                <p className="text-[10px] text-slate-500">API Key para conectar con el modelo Gemini-flash-lite de Google AI Studio para limpiar e interpretar la entrada por voz de forma JSON estructurada.</p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-xs font-bold text-slate-700">GOOGLE_SERVICE_ACCOUNT_EMAIL</span>
                  <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">Requerida</span>
                </div>
                <p className="text-[10px] text-slate-500">El correo de tu cuenta de servicio de Google Cloud Console con acceso habilitado a la Google Docs API.</p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-xs font-bold text-slate-700">GOOGLE_PRIVATE_KEY</span>
                  <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">Requerida</span>
                </div>
                <p className="text-[10px] text-slate-500">La llave privada provista por el archivo JSON de credenciales de Google Service Account (recuerda escapar los saltos de línea \n correctamente).</p>
              </div>
            </div>
          </div>

          {/* TODO LIST AND PENDING TASKS */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900">
            <h4 className="font-bold text-sm mb-2 flex items-center gap-1.5 text-amber-800">
              <AlertCircle className="w-4.5 h-4.5" /> Tareas Pendientes (TODOs) para Producción
            </h4>
            <ul className="list-disc pl-4 text-xs space-y-1.5 text-amber-800">
              <li>Configurar variables reales en el dashboard de Netlify.</li>
              <li>Habilitar Google Docs API y Google Drive API en la consola de Google Cloud.</li>
              <li>Habilitar persistencia o validación de ID de documento para evitar que cualquiera edite documentos ajenos.</li>
              <li>Soportar comandos de voz interactivos como "Siguiente", "Limpiar" o "Guardar".</li>
            </ul>
          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer className="bg-slate-100 border-t border-slate-200 py-6 px-4 mt-auto text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="m-0">Agente Red v1.0.0 - Todos los derechos reservados.</p>
          <p className="m-0">Desarrollado con React 19 y Google Chrome Speech Recognition.</p>
        </div>
      </footer>
    </div>
  );
}
