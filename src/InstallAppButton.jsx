import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Share, MoreVertical, Plus } from 'lucide-react';

let globalInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  globalInstallPrompt = e;
});

export default function InstallAppButton({ variant = 'button' }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detecta iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Detecta se já está instalado como PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
    }

    // Pega o prompt salvo globalmente
    if (globalInstallPrompt) {
      setInstallPrompt(globalInstallPrompt);
    }

    // Escuta se o evento chegar depois
    const handler = (e) => {
      e.preventDefault();
      globalInstallPrompt = e;
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        globalInstallPrompt = null;
        setInstallPrompt(null);
      }
    } else {
      // Sem prompt nativo (iOS ou já instalado) → mostra modal com instruções
      setShowModal(true);
    }
  };

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
        <span className="text-emerald-600 text-lg">✅</span>
        <div>
          <p className="text-xs font-black text-emerald-700 uppercase tracking-widest">App instalado</p>
          <p className="text-[10px] text-emerald-600 font-bold">Você já está usando o app nativo!</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-indigo-700 active:scale-95"
      >
        <Smartphone size={18} />
        📲 Baixar como App
      </button>

      {/* Modal de instruções */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.3)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-2xl">
                    📲
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-indigo-600">AgendaLink</p>
                    <p className="text-base font-black text-slate-950">Instalar como App</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-xl bg-slate-100 p-2 text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              {isIOS ? (
                /* Instruções para iPhone */
                <div className="space-y-4">
                  <p className="text-xs font-bold text-slate-500 leading-relaxed">
                    No iPhone, siga estes passos simples no <strong className="text-slate-900">Safari</strong>:
                  </p>

                  {[
                    { icon: <Share size={16} className="text-blue-500" />, step: '1', text: 'Toque no ícone de Compartilhar (o quadrado com seta pra cima) na barra de baixo do Safari' },
                    { icon: <Plus size={16} className="text-blue-500" />, step: '2', text: 'Role para baixo e toque em "Adicionar à Tela de Início"' },
                    { icon: <Smartphone size={16} className="text-blue-500" />, step: '3', text: 'Toque em "Adicionar" no canto superior direito' },
                  ].map(({ icon, step, text }) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                        {icon}
                      </div>
                      <p className="text-sm font-bold text-slate-700 leading-relaxed">{text}</p>
                    </div>
                  ))}

                  <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3 mt-2">
                    <p className="text-[11px] font-bold text-amber-700">
                      ⚠️ Certifique-se de estar usando o <strong>Safari</strong>. No Chrome do iPhone, a instalação não é suportada.
                    </p>
                  </div>
                </div>
              ) : (
                /* Instruções para Android */
                <div className="space-y-4">
                  <p className="text-xs font-bold text-slate-500 leading-relaxed">
                    No Android, siga estes passos no <strong className="text-slate-900">Chrome</strong>:
                  </p>

                  {[
                    { icon: <MoreVertical size={16} className="text-indigo-500" />, step: '1', text: 'Toque nos 3 pontos (⋮) no canto superior direito do Chrome' },
                    { icon: <Plus size={16} className="text-indigo-500" />, step: '2', text: 'Toque em "Adicionar à tela inicial" ou "Instalar aplicativo"' },
                    { icon: <Smartphone size={16} className="text-indigo-500" />, step: '3', text: 'Confirme tocando em "Adicionar" ou "Instalar"' },
                  ].map(({ icon, step, text }) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                        {icon}
                      </div>
                      <p className="text-sm font-bold text-slate-700 leading-relaxed">{text}</p>
                    </div>
                  ))}

                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 mt-2">
                    <p className="text-[11px] font-bold text-slate-500">
                      💡 Se não aparecer a opção, certifique-se de estar usando o <strong>Chrome</strong> e que o site está carregado via HTTPS.
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowModal(false)}
                className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-widest text-white transition-all active:scale-95"
              >
                Entendi!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
