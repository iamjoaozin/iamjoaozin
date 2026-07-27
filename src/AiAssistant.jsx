import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Loader2, Sparkles, AlertTriangle } from 'lucide-react';

const AiAssistant = ({ contexto }) => {
  const [aberto, setAberto] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erroOllama, setErroOllama] = useState(false);
  const messagesEndRef = useRef(null);

  const sugestoes = [
    'Qual meu faturamento de hoje?',
    'Crie um texto de marketing para o Instagram',
    'Como posso melhorar meu movimento nas terças?',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (aberto) {
      scrollToBottom();
    }
  }, [historico, aberto]);

  const enviarMensagem = async (textoParaEnviar) => {
    const msg = textoParaEnviar || inputMsg;
    if (!msg.trim() || carregando) return;

    if (!textoParaEnviar) {
      setInputMsg('');
    }

    const novasMensagens = [...historico, { role: 'user', content: msg }];
    setHistorico(novasMensagens);
    setCarregando(true);
    setErroOllama(false);

    try {
      const response = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: msg,
          contexto,
          historico
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.erro || 'Erro desconhecido no servidor');
      }

      setHistorico([...novasMensagens, { role: 'assistant', content: data.resposta }]);
    } catch (error) {
      console.error(error);
      setErroOllama(true);
      setHistorico([...novasMensagens, { 
        role: 'assistant', 
        content: `⚠️ ${error.message || 'Não foi possível conectar à IA. Verifique se a variável OPENROUTER_API_KEY está configurada na Vercel e faça um novo deploy.'}`
      }]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      {/* Botão Flutuante */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setAberto(!aberto)}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
          style={{ boxShadow: '0 20px 40px rgba(15,23,42,0.3)' }}
        >
          <span className="absolute -inset-0.5 animate-ping rounded-full bg-indigo-500/20 opacity-75" />
          <AnimatePresence mode="wait">
            {aberto ? (
              <motion.div
                key="x"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
              >
                <X size={22} />
              </motion.div>
            ) : (
              <motion.div
                key="bot"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center justify-center"
              >
                <Bot size={22} />
                <Sparkles size={10} className="absolute top-3 right-3 text-indigo-400 animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Painel do Chat */}
      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="fixed bottom-24 right-6 z-50 flex h-[580px] w-[380px] flex-col overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950 text-white shadow-[0_30px_90px_rgba(15,23,42,0.4)]"
          >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-slate-900 bg-slate-900/50 px-6 py-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
                  <Bot size={18} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-indigo-400">Assistente IA</p>
                  <h3 className="text-sm font-black">AgendaLink Copilot</h3>
                </div>
              </div>
              <button 
                onClick={() => setAberto(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white"
              >
                <X size={16} />
              </button>
            </header>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {historico.length === 0 ? (
                <div className="flex h-full flex-col justify-center text-center space-y-6">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-indigo-400">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black">Olá! Como posso te ajudar hoje?</h4>
                    <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                      Sou alimentado pelo Ollama rodando localmente. Posso ler sua agenda do dia, sugerir textos e ajudar na gestão.
                    </p>
                  </div>
                  <div className="grid gap-2 text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 px-1">Sugestões de perguntas</p>
                    {sugestoes.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => enviarMensagem(sug)}
                        className="rounded-xl border border-slate-900 bg-slate-900/30 px-3 py-2.5 text-left text-xs font-bold text-slate-300 hover:bg-slate-900 transition-colors"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                historico.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs font-bold leading-5 ${
                        m.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-slate-900 text-slate-100 rounded-bl-none border border-slate-800'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}

              {carregando && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-400 rounded-bl-none">
                    <Loader2 size={14} className="animate-spin" />
                    Digitando...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarMensagem();
              }}
              className="border-t border-slate-900 bg-slate-900/20 p-4"
            >
              <div className="flex items-center gap-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 focus-within:border-indigo-600 px-1.5 py-1.5">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  placeholder="Escreva sua pergunta..."
                  className="flex-1 bg-transparent px-3 py-2 text-xs font-bold text-white outline-none placeholder:text-slate-600"
                />
                <button
                  type="submit"
                  disabled={!inputMsg.trim() || carregando}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                >
                  <Send size={14} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AiAssistant;
