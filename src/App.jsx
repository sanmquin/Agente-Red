import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import DocSetup from './components/DocSetup';
import VoiceAgent from './components/VoiceAgent';
import JsonMonitor from './components/JsonMonitor';
import EnvDocs from './components/EnvDocs';

export default function App() {
  const [script, setScript] = useState(null);
  const [docId, setDocId] = useState('');
  const [isDocValidated, setIsDocValidated] = useState(false);
  const [responses, setResponses] = useState({
    projects: '',
    income: '',
    growth: ''
  });

  useEffect(() => {
    fetch('/script.json')
      .then(res => res.json())
      .then(data => {
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
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {!isDocValidated ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-900 shadow-sm">
              <h2 className="text-xl font-bold mb-2 text-amber-800">Document Setup Required</h2>
              <p className="text-sm">
                Before starting the voice assistant, you must set up your Google Doc ID and validate writing access to avoid losing captured interview questions later.
              </p>
            </div>
          ) : (
            <VoiceAgent
              script={script}
              docId={docId}
              responses={responses}
              setResponses={setResponses}
              onResetSetup={handleResetSetup}
            />
          )}

          <JsonMonitor
            responses={responses}
            docId={docId}
          />
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <DocSetup
            docId={docId}
            setDocId={setDocId}
            isDocValidated={isDocValidated}
            setIsDocValidated={setIsDocValidated}
          />

          <EnvDocs />
        </div>

      </main>

      <Footer />
    </div>
  );
}
