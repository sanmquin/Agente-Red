import { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import DocSetup from './components/DocSetup';
import VoiceAgent from './components/VoiceAgent';

export interface Question {
  id: string;
  key: 'projects' | 'income' | 'growth';
  title: string;
  instructions: string;
  placeholder: string;
  ttsPrompt: string;
}

export interface Script {
  agentName: string;
  languageCode: string;
  description: string;
  welcomeMessage: string;
  questions: Question[];
  completionMessage: string;
}

export interface Responses {
  projects: string;
  income: string;
  growth: string;
}

// Default values as requested
const DEFAULT_DOC_ID = '1jGmp2qSp7Q8q29qGpnaQJwU63ESbABj20lw0BQOSx6o';

export default function App() {
  const [script, setScript] = useState<Script | null>(null);
  const [docId, setDocId] = useState<string>(DEFAULT_DOC_ID);
  const [isDocValidated, setIsDocValidated] = useState<boolean>(false);
  const [responses, setResponses] = useState<Responses>({
    projects: '',
    income: '',
    growth: ''
  });

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [updateMode, setUpdateMode] = useState<'single' | 'realtime'>('single'); // default is single (existing behavior)

  useEffect(() => {
    fetch('/script.json')
      .then(res => res.json())
      .then((data: Script) => {
        setScript(data);
      })
      .catch(err => {
        console.error('Error loading script.json:', err);
      });
  }, []);

  const handleResetSetup = () => {
    setIsDocValidated(false);
    setResponses({ projects: '', income: '', growth: '' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {!isDocValidated ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-900 shadow-sm">
              <h2 className="text-xl font-bold mb-2 text-amber-800">Se requiere la configuración del documento</h2>
              <p className="text-sm">
                Antes de iniciar el asistente de voz, debes validar el acceso de escritura de tu ID de Google Doc para asegurar que tus respuestas se guarden sin problemas.
              </p>
            </div>
          ) : (
            <VoiceAgent
              script={script}
              docId={docId}
              responses={responses}
              setResponses={setResponses}
              onResetSetup={handleResetSetup}
              selectedVoiceName={selectedVoiceName}
              updateMode={updateMode}
            />
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <DocSetup
            docId={docId}
            setDocId={setDocId}
            isDocValidated={isDocValidated}
            setIsDocValidated={setIsDocValidated}
          />
        </div>

      </main>

      <Footer />

      {/* Settings Modal will go here */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          selectedVoiceName={selectedVoiceName}
          setSelectedVoiceName={setSelectedVoiceName}
          updateMode={updateMode}
          setUpdateMode={setUpdateMode}
        />
      )}
    </div>
  );
}

// We'll define SettingsModal helper component below or in a separate file.
// Let's create a modular settings modal component or write it here for simplicity.
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoiceName: string;
  setSelectedVoiceName: (name: string) => void;
  updateMode: 'single' | 'realtime';
  setUpdateMode: (mode: 'single' | 'realtime') => void;
}

function SettingsModal({
  isOpen,
  onClose,
  selectedVoiceName,
  setSelectedVoiceName,
  updateMode,
  setUpdateMode
}: SettingsModalProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingTest, setIsPlayingTest] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;

    const updateVoiceList = () => {
      // Get all Spanish voices
      const allVoices = synth.getVoices();
      const spanishVoices = allVoices.filter(v =>
        v.lang.toLowerCase().includes('es')
      );
      setVoices(spanishVoices);

      // Set default female voice if not already selected
      if (!selectedVoiceName && spanishVoices.length > 0) {
        // Try to find a standard female voice from es-MX first
        const defaultFemale = spanishVoices.find(v =>
          v.lang.includes('es-MX') &&
          (v.name.toLowerCase().includes('female') ||
           v.name.toLowerCase().includes('sabin') ||
           v.name.toLowerCase().includes('microsoft sabina') ||
           v.name.toLowerCase().includes('google'))
        ) || spanishVoices.find(v =>
          v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('sabin') ||
          v.name.toLowerCase().includes('sabina') ||
          v.name.toLowerCase().includes('zira') ||
          v.name.toLowerCase().includes('helena') ||
          v.name.toLowerCase().includes('google')
        ) || spanishVoices[0];

        if (defaultFemale) {
          setSelectedVoiceName(defaultFemale.name);
        }
      }
    };

    updateVoiceList();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = updateVoiceList;
    }
  }, [selectedVoiceName, setSelectedVoiceName]);

  const handlePlayTest = () => {
    if (typeof window === 'undefined' || isPlayingTest) return;
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance('Hola, esta es una prueba de la voz del Agente Verde.');
    utterance.lang = 'es-MX';

    const selectedVoice = voices.find(v => v.name === selectedVoiceName);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.pitch = 1.05;
    utterance.rate = 1.0;

    utterance.onstart = () => setIsPlayingTest(true);
    utterance.onend = () => setIsPlayingTest(false);
    utterance.onerror = () => setIsPlayingTest(false);

    synth.speak(utterance);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-lg">Configuración de Voz y Documento</h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white font-bold text-xl cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Voice Selector */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
              Seleccionar Voz del Asistente (Español)
            </label>
            <div className="flex gap-2">
              <select
                value={selectedVoiceName}
                onChange={(e) => setSelectedVoiceName(e.target.value)}
                className="flex-1 text-sm bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-lg py-2 px-3 focus:outline-none"
              >
                {voices.length === 0 ? (
                  <option value="">Cargando voces disponibles...</option>
                ) : (
                  voices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))
                )}
              </select>
              <button
                onClick={handlePlayTest}
                disabled={isPlayingTest || voices.length === 0}
                className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-semibold px-4 py-2 rounded-lg text-xs transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
              >
                {isPlayingTest ? 'Reproduciendo...' : 'Probar'}
              </button>
            </div>
          </div>

          {/* Update Mode Options */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
              Modo de Actualización de Google Docs
            </label>
            <div className="space-y-3">
              <label className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 cursor-pointer hover:border-emerald-500/50 transition-colors">
                <input
                  type="radio"
                  name="updateMode"
                  value="single"
                  checked={updateMode === 'single'}
                  onChange={() => setUpdateMode('single')}
                  className="mt-1 accent-emerald-600"
                />
                <div>
                  <span className="text-sm font-bold text-slate-800">Un solo pase final (Por defecto)</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Procesa todas las respuestas usando Gemini-flash y las guarda en el documento juntas al terminar toda la entrevista.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 cursor-pointer hover:border-emerald-500/50 transition-colors">
                <input
                  type="radio"
                  name="updateMode"
                  value="realtime"
                  checked={updateMode === 'realtime'}
                  onChange={() => setUpdateMode('realtime')}
                  className="mt-1 accent-emerald-600"
                />
                <div>
                  <span className="text-sm font-bold text-slate-800">En tiempo real (Pregunta por pregunta)</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Envía y guarda de inmediato cada respuesta en el Google Doc después de responder cada pregunta.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-lg text-sm transition-all shadow-md cursor-pointer"
          >
            Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
