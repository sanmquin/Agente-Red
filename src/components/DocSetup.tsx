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
      setErrorMsg('Please enter a valid Google Doc ID.');
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
        setErrorMsg(data.error || 'Failed to write validation message to Google Doc. Check sharing permissions.');
        setIsDocValidated(false);
      }
    } catch (err) {
      console.error('Validation error:', err);
      setErrorMsg('Could not connect to Netlify function. Please ensure local server is running.');
      setIsDocValidated(false);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Step-by-Step Document Setup */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
          <FileText className="w-5 h-5 text-emerald-600" /> Document Configuration Steps
        </h3>

        <ol className="space-y-4 text-xs text-slate-600 list-decimal pl-4">
          <li>
            <strong>Create a new Google Doc:</strong>
            <p className="mt-1">
              Go to <a href="https://docs.new" target="_blank" rel="noreferrer" className="text-emerald-600 underline font-semibold">docs.new</a> and create a fresh document.
            </p>
          </li>
          <li>
            <strong>Share the Doc with Service Account:</strong>
            <p className="mt-1">
              Click <strong>Share</strong> and grant <strong>Editor</strong> rights to the Google Service Account:
              <code className="block bg-slate-100 p-1.5 rounded font-mono text-[10px] select-all mt-1 flex justify-between items-center overflow-x-auto text-slate-700">
                <span>agente-red-service@agente-red-42.iam.gserviceaccount.com</span>
                <button
                  onClick={() => copyText('agente-red-service@agente-red-42.iam.gserviceaccount.com', 'serv_acc')}
                  className="ml-2 hover:bg-slate-200 p-1 rounded text-emerald-600"
                  type="button"
                >
                  {copiedText === 'serv_acc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </code>
            </p>
          </li>
          <li>
            <strong>Retrieve and Paste the Google Doc ID:</strong>
            <p className="mt-1">
              Copy the long alphanumeric ID between <code>/d/</code> and <code>/edit</code> from the document's URL.
            </p>
          </li>
        </ol>
      </div>

      {/* Connection Enabler Form & Verification */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
          <Settings className="w-5 h-5 text-emerald-600" /> Google Doc Integration
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Google Doc ID
            </label>
            <input
              type="text"
              placeholder="Enter your Google Doc ID"
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              disabled={isDocValidated}
              className="w-full text-sm bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-lg py-2 px-3 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
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
                  <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Permission...
                </>
              ) : (
                'Validate and Open Document'
              )}
            </button>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 flex items-start gap-2 text-xs">
              <CheckCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <span className="font-bold">Verified & Connected!</span>
                <p className="mt-0.5">We wrote a validation tag to your doc. You may now start the voice interview flow.</p>
                <button
                  onClick={() => setIsDocValidated(false)}
                  className="mt-1.5 text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Change Document ID
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-150 rounded-lg p-3 text-red-850 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-600" />
              <div>
                <span className="font-bold">Validation Failed</span>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
