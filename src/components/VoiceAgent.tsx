import { useState, useEffect, useRef } from 'react';
import { Play, Mic, MicOff, RefreshCw, ArrowRight, Volume2, CheckCircle, AlertCircle } from 'lucide-react';
import { Script, Responses } from '../App';

interface VoiceAgentProps {
  script: Script | null;
  docId: string;
  responses: Responses;
  setResponses: React.Dispatch<React.SetStateAction<Responses>>;
  onResetSetup: () => void;
  selectedVoiceName: string;
  updateMode: 'single' | 'realtime';
}

export default function VoiceAgent({
  script,
  docId,
  responses,
  setResponses,
  onResetSetup,
  selectedVoiceName,
  updateMode
}: VoiceAgentProps) {
  const [currentStep, setCurrentStep] = useState<string>('welcome'); // 'welcome', 'question_0', 'question_1', 'question_2', 'processing', 'completed'
  const [editedResponse, setEditedResponse] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [backendStatus, setBackendStatus] = useState<'success' | 'error' | 'loading' | null>(null);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);

  const isListeningRef = useRef(isListening);
  const editedResponseRef = useRef(editedResponse);
  const baseTranscriptRef = useRef(editedResponse);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    editedResponseRef.current = editedResponse;
    if (!isListening) {
      baseTranscriptRef.current = editedResponse;
    }
  }, [editedResponse, isListening]);

  // STT Speech Recognition Initialization
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'es-MX';

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentSpeech = finalTranscript || interimTranscript;
        if (currentSpeech.trim()) {
          const base = baseTranscriptRef.current;
          const separator = base && !base.endsWith(' ') && !currentSpeech.startsWith(' ') ? ' ' : '';
          setEditedResponse(base + separator + currentSpeech);
        }
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setErrorMessage(`Error de transcripción: ${event.error}`);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setIsListening(false);
          }
        }
      };

      rec.onend = () => {
        if (isListeningRef.current) {
          baseTranscriptRef.current = editedResponseRef.current;
          try {
            rec.start();
          } catch (e) {
            console.error('Failed restarting speech recognition:', e);
          }
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, []);

  // Read Text Out Loud
  const speakText = (text: string, callback?: () => void) => {
    if (!synthRef.current) return;

    synthRef.current.cancel();
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';

    const voices = synthRef.current.getVoices();

    // Use selectedVoiceName if configured, otherwise look for Paulina, then other standard female voices
    let selectedVoice = voices.find(v => v.name === selectedVoiceName);

    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.name.toLowerCase().includes('paulina'));
    }
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.includes('es-MX') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('sabin') || v.name.toLowerCase().includes('microsoft sabina') || v.name.toLowerCase().includes('google')));
    }
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.includes('es-MX')) || voices.find(v => v.lang.includes('es-ES')) || voices.find(v => v.lang.includes('es'));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.pitch = 1.05; // Slightly higher pitch for a friendly, helpful persona
    utterance.rate = 1.0;

    utterance.onend = () => {
      setIsSpeaking(false);
      if (callback) callback();
    };

    utterance.onerror = (e) => {
      console.error('Speech synthesis error:', e);
      setIsSpeaking(false);
      if (callback) callback();
    };

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const startAssistant = () => {
    if (!script) return;
    setCurrentStep('welcome');
    speakText(script.welcomeMessage, () => {
      goToQuestion(0);
    });
  };

  const goToQuestion = (index: number) => {
    if (!script) return;
    const q = script.questions[index];
    setCurrentStep(`question_${index}`);

    const currentKey = q.key;
    setEditedResponse(responses[currentKey] || '');

    speakText(q.ttsPrompt, () => {
      startListening();
    });
  };

  const startListening = () => {
    stopSpeaking();
    if (recognitionRef.current) {
      setErrorMessage('');
      baseTranscriptRef.current = editedResponse;
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed starting mic:', err);
      }
    } else {
      setErrorMessage('Tu navegador no soporta transcripción por voz nativa. Escribe tu respuesta de forma manual.');
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

  const saveResponseAndNext = async (index: number) => {
    if (!script) return;
    stopListening();
    stopSpeaking();

    const q = script.questions[index];
    const updatedResponses = {
      ...responses,
      [q.key]: editedResponse
    };
    setResponses(updatedResponses);

    // If real-time mode is selected, update Google Doc for this question immediately
    if (updateMode === 'realtime') {
      setBackendStatus('loading');
      try {
        const response = await fetch('/.netlify/functions/process-response', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            documentId: docId,
            action: 'update-question',
            questionKey: q.key,
            questionTitle: q.title,
            responseValue: editedResponse
          })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          console.error('Failed to update question in real-time:', data.error);
        }
      } catch (err) {
        console.error('Real-time question update error:', err);
      } finally {
        setBackendStatus(null);
      }
    }

    if (index < script.questions.length - 1) {
      goToQuestion(index + 1);
    } else {
      if (updateMode === 'single') {
        setCurrentStep('processing');
        speakText(script.completionMessage, () => {
          submitToGoogleDocs(updatedResponses);
        });
      } else {
        // For real-time mode, since we already updated everything individually,
        // we can just conclude directly
        setCurrentStep('completed');
        setBackendStatus('success');
        speakText(script.completionMessage);
      }
    }
  };

  const submitToGoogleDocs = async (finalResponses: Responses) => {
    setBackendStatus('loading');

    const payload = {
      documentId: docId,
      responses: finalResponses
    };

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
        setErrorMessage(data.error || 'Ocurrió un error al guardar los datos.');
        setCurrentStep('completed');
      }
    } catch (err) {
      console.error('Submission error:', err);
      setBackendStatus('error');
      setErrorMessage('Fallo al conectar con el servidor.');
      setCurrentStep('completed');
    }
  };

  const resetAgent = () => {
    stopListening();
    stopSpeaking();
    setResponses({ projects: '', income: '', growth: '' });
    setEditedResponse('');
    setBackendStatus(null);
    setErrorMessage('');
    setCurrentStep('welcome');
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 flex flex-col justify-between min-h-[480px]">
      <div>
        {/* Status Line */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isListening ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isListening ? 'bg-emerald-600' : 'bg-slate-500'}`}></span>
            </span>
            <span className="text-sm font-semibold text-slate-600">
              {isListening ? 'Escuchando...' : isSpeaking ? 'Agente Hablando...' : 'Agente Listo'}
            </span>
          </div>
          <div className="text-xs bg-slate-100 px-2.5 py-1 rounded text-slate-500 font-mono">
            Paso: {currentStep}
          </div>
        </div>

        {/* Current Screen */}
        {currentStep === 'welcome' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Volume2 className="w-10 h-10 animate-bounce" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-3">¡Bienvenido a Agente Red Altruista!</h2>
            <p className="text-slate-600 max-w-md mx-auto mb-8">
              Este agente te guiará con una voz amigable para responder tres preguntas de tu proyecto, procesándolas con IA e insertándolas directamente en tu documento de Google.
            </p>
            <button
              onClick={startAssistant}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2 text-lg transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Play className="fill-current w-5 h-5" /> Iniciar Entrevista
            </button>
          </div>
        )}

        {script && currentStep.startsWith('question_') && (() => {
          const index = parseInt(currentStep.split('_')[1]);
          const q = script!.questions[index];
          return (
            <div>
              <div className="mb-4">
                <span className="text-xs font-bold text-emerald-700 tracking-wider uppercase bg-emerald-50 px-2.5 py-1 rounded">
                  Pregunta {index + 1} de {script!.questions.length}
                </span>
                <h2 className="text-xl font-bold text-slate-800 mt-3 flex items-center gap-2">
                  {q.title}
                  <button
                    onClick={() => speakText(q.ttsPrompt)}
                    title="Escuchar de nuevo"
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
                  >
                    <Volume2 className="w-5 h-5 text-emerald-600" />
                  </button>
                </h2>
                <p className="text-slate-500 text-sm italic mt-1">{q.instructions}</p>
              </div>

              {/* Editing & Transcription */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 relative min-h-[140px] flex flex-col justify-between">
                <textarea
                  value={editedResponse}
                  onChange={(e) => setEditedResponse(e.target.value)}
                  placeholder={q.placeholder}
                  className="w-full bg-transparent border-0 resize-none focus:outline-none focus:ring-0 text-slate-700 text-base"
                  rows={4}
                />

                {isListening && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-emerald-50 border border-emerald-250 px-3 py-1 rounded-full text-xs text-emerald-700 animate-pulse font-semibold">
                    <Mic className="w-3.5 h-3.5" /> Grabando...
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 items-center justify-between border-t border-slate-100 pt-4">
                <div className="flex gap-2">
                  {isListening ? (
                    <button
                      onClick={stopListening}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <MicOff className="w-4 h-4" /> Pausar Micrófono
                    </button>
                  ) : (
                    <button
                      onClick={startListening}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 text-sm shadow cursor-pointer"
                    >
                      <Mic className="w-4 h-4 animate-bounce" /> Activar Micrófono
                    </button>
                  )}

                  <button
                    onClick={() => setEditedResponse('')}
                    className="border border-slate-300 hover:bg-slate-50 text-slate-600 font-semibold py-2 px-3 rounded-lg flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" /> Limpiar
                  </button>
                </div>

                <button
                  onClick={() => saveResponseAndNext(index)}
                  disabled={!editedResponse.trim()}
                  className={`font-bold py-2.5 px-5 rounded-lg flex items-center gap-2 text-sm transition-all ${
                    editedResponse.trim()
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Siguiente <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })()}

        {currentStep === 'processing' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Procesando respuestas</h3>
            <p className="text-slate-600">
              El Agente Red Altruista está estructurando tus respuestas e ingresándolas de forma segura en Google Docs...
            </p>
          </div>
        )}

        {currentStep === 'completed' && (
          <div className="py-4">
            <div className="text-center mb-6">
              {backendStatus === 'success' ? (
                <>
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <CheckCircle className="w-10 h-10 text-emerald-650" />
                  </div>
                  <h2 className="text-2xl font-bold text-emerald-700 mb-1">¡Guardado con éxito!</h2>
                  <p className="text-slate-600 text-sm max-w-md mx-auto">
                    Tus respuestas han sido procesadas con IA de forma ejecutiva y estilizada e insertadas en tu Google Doc.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <AlertCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-red-700 mb-1">Error al registrar datos</h2>
                  <p className="text-slate-600 text-sm max-w-md mx-auto">
                    Se completó la entrevista pero no se pudieron insertar los datos en el documento.
                  </p>
                </>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 border-b pb-1">
                Respuestas Capturadas:
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-bold text-slate-700">1. Proyectos:</span>
                  <p className="text-slate-600 pl-3 border-l-2 border-emerald-500 mt-1">{responses.projects || 'Sin respuesta'}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-700">2. Fuentes de Ingreso:</span>
                  <p className="text-slate-600 pl-3 border-l-2 border-emerald-500 mt-1">{responses.income || 'Sin respuesta'}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-700">3. Ideas de Crecimiento:</span>
                  <p className="text-slate-600 pl-3 border-l-2 border-emerald-500 mt-1">{responses.growth || 'Sin respuesta'}</p>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Detalles:</span>
                  <p className="mt-1">{errorMessage}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-center border-t border-slate-100 pt-4">
              <button
                onClick={resetAgent}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all text-sm shadow cursor-pointer"
              >
                Reiniciar Entrevista
              </button>
              <button
                onClick={onResetSetup}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-6 rounded-lg transition-all text-sm shadow cursor-pointer"
              >
                Cambiar Documento
              </button>
            </div>
          </div>
        )}
      </div>

      {currentStep !== 'completed' && currentStep !== 'welcome' && (
        <div className="border-t border-slate-100 pt-4 mt-6 flex justify-between items-center">
          <button
            onClick={resetAgent}
            className="text-xs font-semibold text-slate-500 hover:text-emerald-600 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reiniciar Proceso
          </button>
          <div className="text-xs text-slate-400">
            Idioma: <span className="font-semibold text-slate-600">es-MX</span>
          </div>
        </div>
      )}
    </div>
  );
}
