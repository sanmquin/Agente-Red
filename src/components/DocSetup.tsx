import { useState } from 'react';
import { Settings, FileText, Check, Copy, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface DocSetupProps {
  docId: string;
  setDocId: (id: string) => void;
  isDocValidated: boolean;
  setIsDocValidated: (validated: boolean) => void;
}

export default function DocSetup({ docId, setDocId, isDocValidated, setIsDocValidated }: DocSetupProps) {
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(key);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const handleValidate = async () => {
    if (!docId.trim()) {
      setErrorMsg('Por favor ingresa un ID de Google Doc válido.');
      return;
    }

    setIsValidating(true);
    setErrorMsg('');

    try {
      const response = await fetch('/.netlify/functions/process-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId: docId.trim(),
          action: 'validate'
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setIsDocValidated(true);
      } else {
        setErrorMsg(data.error || 'No se pudo escribir el mensaje de validación en Google Doc. Verifica los permisos de edición.');
        setIsDocValidated(false);
      }
    } catch (err) {
      console.error('Validation error:', err);
      setErrorMsg('No se pudo conectar con la función Netlify. Verifica que el servidor esté activo.');
      setIsDocValidated(false);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Pasos de configuración */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
          <FileText className="w-5 h-5 text-emerald-600" /> Pasos para Configurar tu Documento
        </h3>

        <ol className="space-y-4 text-xs text-slate-600 list-decimal pl-4">
          <li>
            <strong>Crea un nuevo Google Doc:</strong>
            <p className="mt-1">
              Ve a <a href="https://docs.new" target="_blank" rel="noreferrer" className="text-emerald-600 underline font-semibold">docs.new</a> y crea un documento en blanco.
            </p>
          </li>
          <li>
            <strong>Comparte el Doc con la cuenta de servicio:</strong>
            <p className="mt-1">
              Haz clic en <strong>Compartir</strong> y otorga permisos de <strong>Editor</strong> a la siguiente cuenta de servicio de Google:
              <code className="block bg-slate-100 p-1.5 rounded font-mono text-[10px] select-all mt-1 flex justify-between items-center overflow-x-auto text-slate-700">
                <span>agente@red-503200.iam.gserviceaccount.com</span>
                <button
                  onClick={() => copyText('agente@red-503200.iam.gserviceaccount.com', 'serv_acc')}
                  className="ml-2 hover:bg-slate-200 p-1 rounded text-emerald-600 cursor-pointer"
                  type="button"
                >
                  {copiedText === 'serv_acc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </code>
            </p>
          </li>
          <li>
            <strong>Copia e ingresa el ID del Google Doc:</strong>
            <p className="mt-1">
              Copia el código alfanumérico largo ubicado entre <code>/d/</code> y <code>/edit</code> en la barra de direcciones de tu documento.
            </p>
          </li>
        </ol>
      </div>

      {/* Integración */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
          <Settings className="w-5 h-5 text-emerald-600" /> Integración con Google Doc
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              ID del Google Doc
            </label>
            <input
              type="text"
              placeholder="Ingresa el ID de tu Google Doc"
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              disabled={isDocValidated}
              className="w-full text-sm bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-lg py-2 px-3 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 font-mono"
            />
          </div>

          {!isDocValidated ? (
            <button
              onClick={handleValidate}
              disabled={isValidating || !docId.trim()}
              className={`w-full py-2.5 px-4 font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2 ${
                isValidating
                  ? 'bg-slate-150 text-slate-400 cursor-not-allowed'
                  : docId.trim()
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-md'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isValidating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Verificando permisos de escritura...
                </>
              ) : (
                'Validar y Abrir Documento'
              )}
            </button>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 flex items-start gap-2 text-xs">
              <CheckCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <span className="font-bold">¡Verificado y Conectado!</span>
                <p className="mt-0.5">Hemos añadido una marca de validación a tu documento. Ya puedes iniciar la entrevista de voz.</p>
                <button
                  onClick={() => setIsDocValidated(false)}
                  className="mt-1.5 text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Cambiar ID de Documento
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-150 rounded-lg p-3 text-red-850 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-600" />
              <div>
                <span className="font-bold">Error de Validación</span>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
