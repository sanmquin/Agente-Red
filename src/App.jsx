import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Volume2, Play, Square, Save, Edit3, Settings,
  CheckCircle2, ArrowRight, ArrowLeft, ExternalLink, FileText,
  Sparkles, RefreshCw, AlertTriangle, HelpCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import scriptData from './script.json';

export default function App() {
  // Voice and Speech states
  const [recognition, setRecognition] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [synth, setSynth] = useState(null);

  // Script and Question progress states
  const [currentStep, setCurrentStep] = useState(0); // 0: Welcome, 1, 2, 3: Questions, 4: Wrap-up/Update
  const [answers, setAnswers] = useState({
    proyectos: '',
    ingresos: '',
    crecimiento: ''
  });
  const [polishedAnswers, setPolishedAnswers] = useState({
    proyectos: '',
    ingresos: '',
    crecimiento: ''
  });
  const [editingField, setEditingField] = useState(null);
  const [tempPolished, setTempPolished] = useState('');

  // Config & API states
  const [documentId, setDocumentId] = useState(localStorage.getItem('ar_doc_id') || '');
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('ar_gemini_key') || '');
  const [clientEmail, setClientEmail] = useState(localStorage.getItem('ar_client_email') || '');
  const [privateKey, setPrivateKey] = useState(localStorage.getItem('ar_private_key') || '');

  // UI Panels / Loading states
  const [showInstructions, setShowInstructions] = useState(true);
  const [isLoadingGemini, setIsLoadingGemini] = useState(false);
  const [isLoadingUpdate, setIsLoadingUpdate] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [statusType, setStatusType] = useState('info'); // info, success, error

  // References
  const mediaStreamRef = useRef(null);

  // Initialize Speech APIs
  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'es-MX';

      rec.onstart = () => {
        setIsListening(true);
        setStatusMessage('Escuchando voz...');
        setStatusType('info');
      };

      rec.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (final) {
          setTranscript((prev) => (prev ? prev + ' ' + final : final));
        }
        setInterimTranscript(interim);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onerror = (event) => {
        console.error('Speech Recognition Error:', event.error);
        if (event.error !== 'no-speech') {
          setStatusMessage(`Error de reconocimiento: ${event.error}`);
          setStatusType('error');
        }
        setIsListening(false);
      };

      setRecognition(rec);
    } else {
      console.warn('SpeechRecognition no es soportado en este navegador.');
    }

    // Initialize Speech Synthesis
    if (window.speechSynthesis) {
      setSynth(window.speechSynthesis);
    }
  }, []);

  // Save configs to LocalStorage
  useEffect(() => {
    localStorage.setItem('ar_doc_id', documentId);
    localStorage.setItem('ar_gemini_key', geminiApiKey);
    localStorage.setItem('ar_client_email', clientEmail);
    localStorage.setItem('ar_private_key', privateKey);
  }, [documentId, geminiApiKey, clientEmail, privateKey]);

  // Handle speaking the agent text
  const speakText = (text) => {
    if (!synth) {
      setStatusMessage('Sintetizador de voz no disponible.');
      setStatusType('error');
      return;
    }

    // Stop speaking if already speaking
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';

    // Attempt to find a Spanish voice
    const voices = synth.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith('es') || v.lang.includes('es-MX'));
    if (esVoice) {
      utterance.voice = esVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    synth.speak(utterance);
  };

  // Trigger TTS voice script on step changes
  useEffect(() => {
    if (currentStep === 0) {
      // Welcome
    } else if (currentStep > 0 && currentStep <= scriptData.questions.length) {
      const q = scriptData.questions[currentStep - 1];
      // Automatically read question and instructions if user wants or just question
    } else if (currentStep === scriptData.questions.length + 1) {
      // Goodbye
    }
  }, [currentStep]);

  // Speech Controls
  const startListening = () => {
    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
    }

    if (recognition) {
      setInterimTranscript('');
      recognition.start();
    } else {
      setStatusMessage('Reconocimiento de voz no soportado en este navegador. Por favor use Google Chrome.');
      setStatusType('error');
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  };

  // Process transcript with Gemini-flash
  const processWithGemini = async () => {
    if (!transcript) {
      setStatusMessage('No hay ninguna transcripción para procesar. Por favor graba tu respuesta.');
      setStatusType('error');
      return;
    }

    setIsLoadingGemini(true);
    setStatusMessage('Procesando respuesta con Gemini-flash-lite...');
    setStatusType('info');

    const currentQuestion = scriptData.questions[currentStep - 1];

    try {
      const response = await fetch('/.netlify/functions/process-gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcript: transcript,
          question: currentQuestion.text,
          instruction: currentQuestion.instruction,
          // If Gemini API Key is entered in UI, pass it along. Netlify function will prioritize it.
          apiKey: geminiApiKey
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar la solicitud');
      }

      // Update answer for this question
      const qId = currentQuestion.id;
      setAnswers(prev => ({ ...prev, [qId]: transcript }));
      setPolishedAnswers(prev => ({ ...prev, [qId]: data.answer }));

      setStatusMessage('¡Respuesta pulida con éxito por Gemini!');
      setStatusType('success');
    } catch (error) {
      console.error(error);
      setStatusMessage(`Error de procesamiento: ${error.message}`);
      setStatusType('error');
    } finally {
      setIsLoadingGemini(false);
    }
  };

  // Submit all deterministic updates to Google Doc
  const updateGoogleDoc = async () => {
    if (!documentId) {
      setStatusMessage('Falta el ID del Documento de Google.');
      setStatusType('error');
      return;
    }

    setIsLoadingUpdate(true);
    setStatusMessage('Actualizando documento en Google Docs de forma determinista...');
    setStatusType('info');

    // Mapeamos los ID de preguntas a sus placeholders
    const replacements = {};
    scriptData.questions.forEach(q => {
      replacements[q.placeholder] = polishedAnswers[q.id] || `[Sin respuesta para: ${q.text}]`;
    });

    try {
      const response = await fetch('/.netlify/functions/update-doc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId,
          replacements,
          clientEmail,
          privateKey
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar el documento');
      }

      setStatusMessage('¡Documento de Google actualizado exitosamente con cambios controlados!');
      setStatusType('success');
    } catch (error) {
      console.error(error);
      setStatusMessage(`Error de actualización: ${error.message}`);
      setStatusType('error');
    } finally {
      setIsLoadingUpdate(false);
    }
  };

  // Step navigation helper
  const handleNext = () => {
    if (currentStep < scriptData.questions.length + 1) {
      // Clean up transcript
      setTranscript('');
      setInterimTranscript('');
      setCurrentStep(prev => prev + 1);
      setStatusMessage(null);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setTranscript('');
      setInterimTranscript('');
      setCurrentStep(prev => prev - 1);
      setStatusMessage(null);
    }
  };

  const currentQuestion = currentStep > 0 && currentStep <= scriptData.questions.length
    ? scriptData.questions[currentStep - 1]
    : null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="bg-red-600 p-2.5 rounded-lg animate-pulse shadow-lg shadow-red-900/40">
            <Mic className="text-white h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {scriptData.agentName} <span className="text-xs bg-red-900/60 text-red-400 font-semibold px-2 py-0.5 rounded border border-red-700/50">Voz Activa</span>
            </h1>
            <p className="text-xs text-slate-400">Agente de voz interactivo y estructurado en Español (México)</p>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm px-3.5 py-2 rounded-lg transition-colors border border-slate-600"
          >
            <HelpCircle size={16} />
            {showInstructions ? 'Ocultar Instrucciones' : 'Ver Instrucciones'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Flow & Voice Controls */}
        <div className="lg:col-span-7 flex flex-col space-y-6">

          {/* Instructions Box */}
          {showInstructions && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shadow-lg relative overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 right-0 p-3 text-xs bg-slate-700/50 text-slate-400 font-semibold uppercase tracking-wider rounded-bl border-l border-b border-slate-600">Guía de Configuración</div>
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Settings className="text-red-500 h-5 w-5" /> Configuración de Google Docs
              </h2>
              <div className="text-sm text-slate-300 space-y-3 pr-10">
                <p>Para que el Agente Red actualice su documento automáticamente, siga estos sencillos pasos:</p>
                <ol className="list-decimal list-inside space-y-2.5 bg-slate-900/50 p-3.5 rounded-lg border border-slate-700/50">
                  <li>
                    <strong>Prepare la Plantilla de Google Doc:</strong>
                    <div className="text-xs text-slate-400 ml-5 mt-1 bg-slate-950 p-2 rounded border border-slate-800 font-mono">
                      Cree un Google Doc y agregue estas etiquetas exactamente donde quiera que vaya la información:
                      <br/><span className="text-red-400 font-bold">{"{{PROYECTOS_ACTUALES}}"}</span>
                      <br/><span className="text-red-400 font-bold">{"{{FUENTES_INGRESOS}}"}</span>
                      <br/><span className="text-red-400 font-bold">{"{{IDEAS_CRECIMIENTO}}"}</span>
                    </div>
                  </li>
                  <li>
                    <strong>Cuenta de Servicio de Google:</strong> Cree una cuenta de servicio en Google Cloud Console, descargue la clave privada JSON y active la API de Google Docs y Google Drive.
                  </li>
                  <li>
                    <strong>Comparta el Documento:</strong> Comparta su Google Doc con el correo electrónico de la Cuenta de Servicio de Google dándole permisos de <strong>Editor</strong>.
                  </li>
                  <li>
                    <strong>Claves de Backend (Netlify):</strong> Documente y configure las variables de entorno en Netlify:
                    <ul className="list-disc list-inside ml-5 mt-1 text-slate-400 font-mono text-xs">
                      <li>GEMINI_API_KEY</li>
                      <li>GOOGLE_SERVICE_ACCOUNT_EMAIL</li>
                      <li>GOOGLE_PRIVATE_KEY</li>
                    </ul>
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* Main Voice Agent Widget */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden flex flex-col flex-1">

            {/* Header Stage / Steps */}
            <div className="bg-slate-750 border-b border-slate-700 px-5 py-4 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">Paso actual</span>
              <div className="flex space-x-1.5">
                {[0, 1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-2.5 w-8 rounded-full transition-all duration-300 ${
                      currentStep === step
                        ? 'bg-red-600 ring-2 ring-red-400/40'
                        : currentStep > step
                        ? 'bg-emerald-500'
                        : 'bg-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Conversation Area */}
            <div className="p-6 flex-1 flex flex-col justify-between space-y-6">

              {/* STAGE 0: WELCOME */}
              {currentStep === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6 space-y-4">
                  <div className="bg-red-900/30 text-red-500 p-4 rounded-full border border-red-700/30 animate-bounce">
                    <Volume2 size={44} />
                  </div>
                  <h3 className="text-xl font-bold text-white">¡Bienvenido al Agente Red!</h3>
                  <p className="text-slate-300 max-w-md">
                    {scriptData.greeting}
                  </p>
                  <button
                    onClick={() => {
                      speakText(scriptData.greeting);
                      handleNext();
                    }}
                    className="mt-4 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg flex items-center gap-2 transition-transform active:scale-95"
                  >
                    Iniciar Asistente de Voz <ArrowRight size={18} />
                  </button>
                </div>
              )}

              {/* STAGE 1, 2, 3: QUESTIONS */}
              {currentQuestion && (
                <div className="flex-1 flex flex-col space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold text-red-500 uppercase tracking-widest">Pregunta {currentStep} de 3</span>
                      <h3 className="text-lg font-bold text-white mt-1">{currentQuestion.text}</h3>
                    </div>
                    <button
                      onClick={() => speakText(currentQuestion.text + ". " + currentQuestion.instruction)}
                      disabled={isSpeaking}
                      className={`p-2.5 rounded-lg border transition-colors ${
                        isSpeaking
                          ? 'bg-red-950 text-red-400 border-red-800'
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600'
                      }`}
                      title="Escuchar pregunta"
                    >
                      <Volume2 className={isSpeaking ? 'animate-pulse' : ''} size={20} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 italic bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                    💡 <strong>Instrucción:</strong> {currentQuestion.instruction}
                  </p>

                  {/* Realtime voice capture interface */}
                  <div className="bg-slate-900 rounded-xl p-4.5 border border-slate-750 flex flex-col space-y-3.5 relative min-h-[140px]">
                    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${isListening ? 'bg-red-500 animate-ping' : 'bg-slate-500'}`} />
                        {isListening ? 'Grabando tu voz...' : 'Micrófono inactivo'}
                      </span>
                      {isListening && (
                        <span className="text-red-400 animate-pulse font-mono">EN VIVO</span>
                      )}
                    </div>

                    <div className="flex-1 text-sm text-slate-200 max-h-[120px] overflow-y-auto whitespace-pre-wrap">
                      {transcript || interimTranscript ? (
                        <>
                          <span>{transcript}</span>
                          <span className="text-slate-500 italic"> {interimTranscript}</span>
                        </>
                      ) : (
                        <span className="text-slate-500 italic">Haz clic en el botón de abajo para empezar a hablar en español...</span>
                      )}
                    </div>

                    {/* Microphone Controls */}
                    <div className="flex justify-center space-x-3 mt-2">
                      {!isListening ? (
                        <button
                          onClick={startListening}
                          className="bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-4.5 py-2 rounded-lg flex items-center gap-2 shadow-md shadow-red-950/40 active:scale-95 transition-all"
                        >
                          <Mic size={16} /> Grabar Respuesta
                        </button>
                      ) : (
                        <button
                          onClick={stopListening}
                          className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold px-4.5 py-2 rounded-lg flex items-center gap-2 shadow-md active:scale-95 transition-all border border-slate-600"
                        >
                          <MicOff size={16} /> Detener Grabación
                        </button>
                      )}

                      {(transcript || interimTranscript) && (
                        <button
                          onClick={() => {
                            setTranscript('');
                            setInterimTranscript('');
                          }}
                          className="bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 text-sm px-3.5 py-2 rounded-lg border border-slate-700 active:scale-95 transition-all"
                        >
                          Reiniciar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Gemini polished output */}
                  <div className="bg-slate-850 rounded-xl p-4 border border-slate-750 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Sparkles size={14} className="text-amber-500" /> Respuesta Pulida por Gemini
                      </span>
                      {polishedAnswers[currentQuestion.id] && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Procesado
                        </span>
                      )}
                    </div>

                    <div className="text-sm bg-slate-900/60 p-3 rounded border border-slate-800/60 text-slate-200 min-h-[60px]">
                      {polishedAnswers[currentQuestion.id] ? (
                        editingField === currentQuestion.id ? (
                          <textarea
                            value={tempPolished}
                            onChange={(e) => setTempPolished(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:ring-1 focus:ring-red-500 focus:outline-none"
                            rows={3}
                          />
                        ) : (
                          <span>{polishedAnswers[currentQuestion.id]}</span>
                        )
                      ) : (
                        <span className="text-slate-500 italic">Presiona "Procesar con Gemini" para pulir tu transcripción.</span>
                      )}
                    </div>

                    <div className="flex justify-end space-x-2">
                      {polishedAnswers[currentQuestion.id] && (
                        editingField === currentQuestion.id ? (
                          <button
                            onClick={() => {
                              setPolishedAnswers(prev => ({ ...prev, [currentQuestion.id]: tempPolished }));
                              setEditingField(null);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition-all active:scale-95"
                          >
                            Guardar Corrección
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingField(currentQuestion.id);
                              setTempPolished(polishedAnswers[currentQuestion.id]);
                            }}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1 transition-all active:scale-95"
                          >
                            <Edit3 size={12} /> Corregir Respuesta
                          </button>
                        )
                      )}

                      <button
                        onClick={processWithGemini}
                        disabled={!transcript || isLoadingGemini}
                        className={`text-xs font-semibold px-4 py-1.5 rounded flex items-center gap-1 shadow-md transition-all active:scale-95 ${
                          !transcript
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                            : 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/20'
                        }`}
                      >
                        {isLoadingGemini ? (
                          <>
                            <RefreshCw size={12} className="animate-spin" /> Procesando...
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} /> Procesar con Gemini-flash
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 4: WRAP-UP */}
              {currentStep === scriptData.questions.length + 1 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6 space-y-4">
                  <div className="bg-emerald-900/30 text-emerald-500 p-4 rounded-full border border-emerald-700/30">
                    <CheckCircle2 size={44} />
                  </div>
                  <h3 className="text-xl font-bold text-white">¡Preguntas completadas con éxito!</h3>
                  <p className="text-slate-300 max-w-md">
                    {scriptData.goodbye}
                  </p>
                  <p className="text-xs text-slate-400">
                    Revisa las respuestas estructuradas en la columna de la derecha antes de actualizar el documento.
                  </p>
                  <button
                    onClick={() => {
                      speakText(scriptData.goodbye);
                      updateGoogleDoc();
                    }}
                    disabled={isLoadingUpdate}
                    className="mt-4 bg-red-600 hover:bg-red-700 text-white font-semibold px-7 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-transform active:scale-95 disabled:bg-slate-700 disabled:cursor-not-allowed"
                  >
                    {isLoadingUpdate ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" /> Actualizando Google Doc...
                      </>
                    ) : (
                      <>
                        <Save size={18} /> Reemplazar Cambios en Google Doc
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Navigation Bar */}
              <div className="border-t border-slate-700 pt-4 flex justify-between">
                <button
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    currentStep === 0
                      ? 'bg-transparent text-slate-600 cursor-not-allowed'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600'
                  }`}
                >
                  <ArrowLeft size={16} /> Atrás
                </button>

                {currentStep <= scriptData.questions.length && (
                  <button
                    onClick={handleNext}
                    disabled={currentStep === scriptData.questions.length + 1}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all"
                  >
                    Siguiente <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Toast / Status Alert */}
          {statusMessage && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-lg ${
              statusType === 'error'
                ? 'bg-red-950/80 text-red-200 border-red-800'
                : statusType === 'success'
                ? 'bg-emerald-950/80 text-emerald-200 border-emerald-800'
                : 'bg-slate-800/90 text-slate-200 border-slate-700'
            }`}>
              {statusType === 'error' && <AlertTriangle className="text-red-500 mt-0.5 flex-shrink-0" size={20} />}
              {statusType === 'success' && <CheckCircle2 className="text-emerald-500 mt-0.5 flex-shrink-0" size={20} />}
              {statusType === 'info' && <RefreshCw className="text-red-400 mt-0.5 flex-shrink-0 animate-spin" size={20} />}
              <div className="text-sm">
                <p className="font-semibold capitalize">{statusType === 'info' ? 'Procesando' : statusType}</p>
                <p className="text-slate-300 mt-0.5">{statusMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Google Doc Config & Structured JSON Replacements Preview */}
        <div className="lg:col-span-5 flex flex-col space-y-6">

          {/* Document configuration and keys */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg flex flex-col space-y-4">
            <h2 className="text-md font-bold text-white flex items-center gap-2 border-b border-slate-700 pb-2.5">
              <Settings className="text-slate-400 h-4.5 w-4.5" /> Claves y Configuración Local
            </h2>

            <div className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  ID de Documento de Google
                </label>
                <input
                  type="text"
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                  placeholder="Ej. 1a2b3c4d5e6f7g8h9i..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <span className="text-xxs text-slate-500 mt-1 block">Extraído de la URL: docs.google.com/document/d/<span className="text-red-400 font-bold">ID_AQUÍ</span>/edit</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center justify-between">
                  <span>Cuenta Servicio Client Email (Opcional)</span>
                  <span className="text-xxs bg-slate-700 text-slate-300 px-1 py-0.5 rounded font-normal uppercase">Opcional si usa env vars</span>
                </label>
                <input
                  type="text"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="Ej. agente-red@proyecto.iam.gserviceaccount.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center justify-between">
                  <span>Clave Privada de Google (Opcional)</span>
                  <span className="text-xxs bg-slate-700 text-slate-300 px-1 py-0.5 rounded font-normal uppercase">Opcional si usa env vars</span>
                </label>
                <textarea
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center justify-between">
                  <span>Gemini API Key (Opcional)</span>
                  <span className="text-xxs bg-slate-700 text-slate-300 px-1 py-0.5 rounded font-normal uppercase">Opcional si usa env vars</span>
                </label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>
          </div>

          {/* Controlled Edits & Deterministic JSON Replacement Preview */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg flex flex-col flex-1">
            <h2 className="text-md font-bold text-white flex items-center gap-2 border-b border-slate-700 pb-2.5">
              <FileText className="text-slate-400 h-4.5 w-4.5" /> Reemplazos Controlados
            </h2>
            <p className="text-xs text-slate-400 mt-2">
              Se realizará un reemplazo exacto y determinista en el Google Doc cuando completes las preguntas.
            </p>

            <div className="mt-4 space-y-4 flex-1">
              {scriptData.questions.map((q) => {
                const answer = polishedAnswers[q.id];
                return (
                  <div key={q.id} className="bg-slate-900/60 rounded-lg p-3.5 border border-slate-750 flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300 font-mono bg-slate-850 px-2 py-0.5 rounded border border-slate-700">{q.placeholder}</span>
                      <span className={`text-xxs px-2 py-0.5 rounded-full font-bold uppercase ${answer ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/30' : 'bg-slate-800 text-slate-500'}`}>
                        {answer ? 'Listo' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-200 mt-1 max-h-[80px] overflow-y-auto whitespace-pre-wrap">
                      {answer ? answer : <span className="text-slate-600 italic">Esperando respuesta del Agente Red...</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {documentId && (
              <div className="mt-4 border-t border-slate-700 pt-4 flex flex-col space-y-2">
                <a
                  href={`https://docs.google.com/document/d/${documentId}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-700 hover:bg-slate-650 text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border border-slate-600 transition-colors shadow-sm"
                >
                  <ExternalLink size={14} /> Abrir Google Doc en Nueva Pestaña
                </a>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span>Agente Red — Sistema de transcripción de voz y relleno determinista de Google Docs</span>
        <div className="flex items-center space-x-4">
          <span>Localización: es-MX</span>
          <span className="h-1.5 w-1.5 bg-red-600 rounded-full" />
          <span>Modelo: Gemini-flash 3.1</span>
        </div>
      </footer>
    </div>
  );
}
