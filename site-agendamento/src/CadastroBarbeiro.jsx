import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Palette, ImageIcon, ArrowRight, ArrowLeft, Check, Sparkles, ShieldCheck, FileText } from 'lucide-react';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { toast, Toaster } from 'react-hot-toast';

const CadastroBarbeiro = ({ user, onFinalizar }) => {
  const [etapa, setEtapa] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState({
    nomeLoja: '',
    whatsapp: '',
    corPrincipal: '#6366f1',
    logoUrl: '',
    tipoDoc: 'CPF', // CPF ou CNPJ
    documento: '',
    categoria: 'Barbearia'
  });

  const coresSugeridas = [
    { nome: 'Indigo', hex: '#6366f1' }, { nome: 'Rosa', hex: '#f472b6' },
    { nome: 'Lavanda', hex: '#a78bfa' }, { nome: 'Tiffany', hex: '#2dd4bf' },
    { nome: 'Dourado', hex: '#fbbf24' }, { nome: 'Pêssego', hex: '#fb923c' },
    { nome: 'Branco', hex: '#ffffff' }
  ];

  const salvarCadastro = async () => {
    if (!dados.documento) return toast.error("O documento é obrigatório!");
    
    setCarregando(true);
    const slugFinal = dados.nomeLoja.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

    // REGRA: CNPJ é automático, CPF fica pendente para sua aprovação
    const statusFinal = dados.tipoDoc === 'CNPJ' ? 'ativo' : 'pendente';

    try {
      // Salva os dados da Empresa
      await setDoc(doc(db, "empresas", user.uid), {
        ...dados,
        slug: slugFinal,
        donoUid: user.uid,
        status: statusFinal,
        dataCriacao: new Date().toISOString()
      });

      // Vincula o usuário ao perfil de barbeiro/parceiro
      await setDoc(doc(db, "usuarios_barbeiros", user.uid), {
        lojaId: user.uid,
        slug: slugFinal,
        status: statusFinal
      });

      if (statusFinal === 'ativo') {
        toast.success("Loja liberada com sucesso!");
        if (onFinalizar) onFinalizar(slugFinal);
      } else {
        setEtapa(5); // Vai para tela de "Aguarde Aprovação"
      }
    } catch (e) {
      toast.error("Erro ao processar cadastro.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 flex flex-col items-center justify-center font-sans">
      <Toaster position="top-center" />
      
      <div className="max-w-md w-full space-y-8">
        {etapa < 5 && (
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
              <Store size={32} />
            </div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">
              Nex <span className="text-indigo-500">Partner</span>
            </h1>
            <div className="flex justify-center gap-2 mt-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1 rounded-full transition-all duration-500 ${etapa >= i ? 'w-8 bg-indigo-500' : 'w-4 bg-white/10'}`} />
              ))}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {etapa === 1 && (
            <motion.div key="e1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="bg-[#0A0A0A] p-6 rounded-[32px] border border-white/5 space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-500 ml-2">Infos Básicas</p>
                <input value={dados.nomeLoja} onChange={e => setDados({...dados, nomeLoja: e.target.value})} placeholder="Nome da Loja" className="w-full p-5 bg-black border border-white/10 rounded-2xl outline-none focus:border-indigo-500 font-bold" />
                <input value={dados.whatsapp} onChange={e => setDados({...dados, whatsapp: e.target.value})} placeholder="WhatsApp (DDD + Número)" className="w-full p-5 bg-black border border-white/10 rounded-2xl outline-none focus:border-indigo-500 font-bold" />
              </div>
              <button onClick={() => setEtapa(2)} disabled={!dados.nomeLoja || !dados.whatsapp} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-xs flex items-center justify-center gap-2">Próximo <ArrowRight size={16}/></button>
            </motion.div>
          )}

          {etapa === 2 && (
            <motion.div key="e2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 text-center">
              <div className="bg-[#0A0A0A] p-6 rounded-[32px] border border-white/5 space-y-6">
                <p className="text-[10px] font-black uppercase text-slate-500">Estilo do App</p>
                <div className="grid grid-cols-4 gap-4 justify-items-center">
                  {coresSugeridas.map(cor => (
                    <button key={cor.hex} onClick={() => setDados({...dados, corPrincipal: cor.hex})} className={`w-12 h-12 rounded-2xl border-2 transition-all flex items-center justify-center ${dados.corPrincipal === cor.hex ? 'border-white scale-110' : 'border-transparent opacity-40'}`} style={{ backgroundColor: cor.hex }}>
                      {dados.corPrincipal === cor.hex && <Check size={20} className={cor.hex === '#ffffff' ? 'text-black' : 'text-white'} />}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setEtapa(3)} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-xs">Continuar</button>
            </motion.div>
          )}

          {etapa === 3 && (
            <motion.div key="e3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="bg-[#0A0A0A] p-6 rounded-[32px] border border-white/5 space-y-6">
                <p className="text-[10px] font-black uppercase text-slate-500 text-center">Documentação</p>
                <div className="flex gap-2 p-1 bg-black rounded-2xl border border-white/5">
                  {['CPF', 'CNPJ'].map(tipo => (
                    <button key={tipo} onClick={() => setDados({...dados, tipoDoc: tipo})} className={`flex-1 py-3 rounded-xl font-black text-[10px] transition-all ${dados.tipoDoc === tipo ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{tipo}</button>
                  ))}
                </div>
                <input value={dados.documento} onChange={e => setDados({...dados, documento: e.target.value})} placeholder={dados.tipoDoc === 'CPF' ? "000.000.000-00" : "00.000.000/0001-00"} className="w-full p-5 bg-black border border-white/10 rounded-2xl outline-none focus:border-indigo-500 font-bold" />
                {dados.tipoDoc === 'CPF' && (
                  <p className="text-[9px] text-amber-500 font-bold text-center italic leading-relaxed">Nota: Cadastros com CPF aguardam aprovação manual do administrador.</p>
                )}
              </div>
              <button onClick={() => setEtapa(4)} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-xs">Próximo</button>
            </motion.div>
          )}

          {etapa === 4 && (
            <motion.div key="e4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="bg-[#0A0A0A] p-6 rounded-[32px] border border-white/5 space-y-4 text-center">
                <p className="text-[10px] font-black uppercase text-slate-500">Logo da Empresa</p>
                <div className="w-20 h-20 bg-black border border-dashed border-white/10 rounded-2xl mx-auto flex items-center justify-center overflow-hidden">
                  {dados.logoUrl ? <img src={dados.logoUrl} className="w-full h-full object-cover" /> : <ImageIcon size={30} className="text-slate-800" />}
                </div>
                <input value={dados.logoUrl} onChange={e => setDados({...dados, logoUrl: e.target.value})} placeholder="Link da imagem (PostImages)" className="w-full p-5 bg-black border border-white/10 rounded-2xl outline-none font-bold" />
              </div>
              <button onClick={salvarCadastro} disabled={carregando} className="w-full bg-indigo-600 py-6 rounded-3xl font-black uppercase text-xs shadow-lg shadow-indigo-500/20">{carregando ? 'Processando...' : 'Finalizar e Ativar'}</button>
            </motion.div>
          )}

          {etapa === 5 && (
            <motion.div key="e5" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
              <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                <ShieldCheck size={40} />
              </div>
              <h2 className="text-2xl font-black italic uppercase">Em Análise</h2>
              <p className="text-slate-400 text-xs px-6 leading-relaxed">
                Obrigado, <strong>{user.displayName.split(' ')[0]}</strong>! Como você cadastrou com CPF, nosso time revisará sua conta em até 24h. Você receberá um aviso quando for liberado.
              </p>
              <button onClick={() => window.location.reload()} className="w-full bg-white/5 py-4 rounded-2xl text-[10px] font-black uppercase">Entendido</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CadastroBarbeiro;