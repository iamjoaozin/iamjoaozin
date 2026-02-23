import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  LayoutDashboard, Plus, Scissors as ScissorsIcon, 
  Trash2, DollarSign, Calendar, Image as ImageIcon, Clock, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'react-hot-toast';
import { db } from './firebase'; 
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, getDoc } from 'firebase/firestore';

const Admin = ({ user, onSair }) => {
  const { lojaId } = useParams(); // Pega o slug da URL
  const [dadosEmpresa, setDadosEmpresa] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('agenda');
  const [modalNovoServico, setModalNovoServico] = useState(false);
  const [agendamentos, setAgendamentos] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [financeiro, setFinanceiro] = useState({ hoje: 0 });

  const [novoNomeS, setNovoNomeS] = useState('');
  const [novoPrecoS, setNovoPrecoS] = useState('');
  const [novoTempoS, setNovoTempoS] = useState('');
  const [novaFotoUrl, setNovaFotoUrl] = useState('');

  const corPrincipal = dadosEmpresa?.corPrincipal || '#6366f1';

  useEffect(() => {
    if (!lojaId || !user) return;

    // 1. BUSCAR CONFIGURAÇÕES DA LOJA (LOGO, NOME, COR)
    const buscarDadosLoja = async () => {
        const docRef = doc(db, "empresas", user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) setDadosEmpresa(snap.data());
    };
    buscarDadosLoja();

    // 2. ESCUTAR SERVIÇOS (FILTRADO POR LOJA)
    const qServicos = query(collection(db, "servicos"), where("lojaId", "==", lojaId), orderBy("nome", "asc"));
    const unsubServ = onSnapshot(qServicos, (snap) => {
      setServicos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. ESCUTAR AGENDAMENTOS (FILTRADO POR LOJA)
    const qAgendas = query(collection(db, "agendamentos"), where("lojaId", "==", lojaId), orderBy("data", "desc"));
    const unsubAgend = onSnapshot(qAgendas, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAgendamentos(lista);
      const total = lista.reduce((acc, curr) => acc + (Number(curr.preco) || 0), 0);
      setFinanceiro({ hoje: total });
    });

    // 4. ESCUTAR GALERIA (FILTRADO POR LOJA)
    const qGaleria = query(collection(db, "galeria"), where("lojaId", "==", lojaId));
    const unsubGal = onSnapshot(qGaleria, (snap) => {
      setFotos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubServ(); unsubAgend(); unsubGal(); };
  }, [lojaId, user]);

  const handleAddServico = async () => {
    if (!novoNomeS || !novoPrecoS || !novoTempoS) return toast.error("Preencha tudo!");
    try {
      await addDoc(collection(db, "servicos"), {
        nome: novoNomeS,
        preco: parseFloat(novoPrecoS),
        tempo: `${novoTempoS} min`,
        lojaId: lojaId
      });
      setModalNovoServico(false);
      setNovoNomeS(''); setNovoPrecoS(''); setNovoTempoS('');
      toast.success("Serviço Salvo!");
    } catch (e) { toast.error("Erro ao salvar"); }
  };

  const handleAddFoto = async () => {
    if (!novaFotoUrl) return toast.error("Cole o link!");
    await addDoc(collection(db, "galeria"), { url: novaFotoUrl, lojaId: lojaId });
    setNovaFotoUrl('');
    toast.success("Foto adicionada!");
  };

  const deletarDoc = async (colecao, id) => {
    if(!window.confirm("Deseja excluir permanentemente?")) return;
    await deleteDoc(doc(db, colecao, id));
    toast.success("Removido!");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24 font-sans select-none">
      <Toaster position="top-center" />
      
      {/* HEADER DINÂMICO */}
      <header className="p-4 flex justify-between items-center bg-black/60 border-b border-white/5 sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-3 text-left">
          {dadosEmpresa?.logoUrl ? (
            <img src={dadosEmpresa.logoUrl} className="w-12 h-12 rounded-2xl object-cover border-2 shadow-lg" style={{ borderColor: corPrincipal }} alt="Logo" />
          ) : (
            <div style={{ backgroundColor: corPrincipal }} className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"><LayoutDashboard size={20} /></div>
          )}
          <div>
            <h1 className="text-xl font-black italic uppercase leading-none">{dadosEmpresa?.nomeLoja || 'Nex'} <span style={{ color: corPrincipal }}>Admin</span></h1>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Link: /{lojaId}</p>
          </div>
        </div>
        <button onClick={onSair} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><LogOut size={18}/></button>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'agenda', label: 'Agenda', icon: <Calendar size={14}/> },
            { id: 'servicos', label: 'Serviços', icon: <ScissorsIcon size={14}/> },
            { id: 'galeria', label: 'Galeria', icon: <ImageIcon size={14}/> },
            { id: 'financeiro', label: 'Financeiro', icon: <DollarSign size={14}/> }
          ].map(aba => (
            <button key={aba.id} onClick={() => setAbaAtiva(aba.id)} 
              style={{ backgroundColor: abaAtiva === aba.id ? corPrincipal : 'rgba(255,255,255,0.05)', borderColor: abaAtiva === aba.id ? corPrincipal : 'transparent' }}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border ${abaAtiva === aba.id ? 'text-white' : 'text-slate-500'}`}
            > {aba.icon} {aba.label} </button>
          ))}
        </div>

        {/* CONTEÚDO: AGENDA */}
        {abaAtiva === 'agenda' && (
          <div className="space-y-4">
            {agendamentos.map(ag => (
              <div key={ag.id} className="p-5 rounded-[28px] border border-white/5 bg-[#0A0A0A] flex justify-between items-center group">
                <div className="flex gap-4 items-center text-left">
                  <div style={{ color: corPrincipal, backgroundColor: `${corPrincipal}15`, borderColor: `${corPrincipal}30` }} className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl border font-black italic">
                    <span className="text-xs">{ag.horario}</span>
                    <span className="text-[7px] opacity-50">{ag.data?.split('-').reverse().slice(0,2).join('/')}</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">{ag.clienteNome}</p>
                    <p style={{ color: corPrincipal }} className="text-[9px] font-black uppercase tracking-widest">{ag.servicoNome}</p>
                  </div>
                </div>
                <button onClick={() => deletarDoc("agendamentos", ag.id)} className="p-3 text-slate-800 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
        )}

        {/* CONTEÚDO: SERVIÇOS */}
        {abaAtiva === 'servicos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servicos.map(s => (
              <div key={s.id} className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[32px] flex justify-between items-center text-left">
                <div>
                  <h3 className="font-black italic uppercase text-sm">{s.nome}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <p style={{ color: corPrincipal }} className="text-2xl font-black">R$ {Number(s.preco).toFixed(2)}</p>
                    <span className="text-[9px] bg-white/5 px-2 py-1 rounded-lg text-slate-500 font-black uppercase">{s.tempo}</span>
                  </div>
                </div>
                <button onClick={() => deletarDoc("servicos", s.id)} className="p-2 text-slate-800 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
              </div>
            ))}
            <button onClick={() => setModalNovoServico(true)} className="border-2 border-dashed border-white/5 p-10 rounded-[32px] flex flex-col items-center justify-center text-slate-600 hover:text-white transition-all">
              <Plus size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest mt-2">Novo Serviço</span>
            </button>
          </div>
        )}

        {/* CONTEÚDO: GALERIA */}
        {abaAtiva === 'galeria' && (
          <div className="space-y-6">
            <div className="bg-[#0A0A0A] p-6 rounded-[32px] border border-white/5 text-left">
              <p className="text-[10px] font-black uppercase mb-4 tracking-widest" style={{ color: corPrincipal }}>Nova Foto</p>
              <input value={novaFotoUrl} onChange={e=>setNovaFotoUrl(e.target.value)} placeholder="Link da foto (PostImages)" className="w-full p-5 bg-black border border-white/10 rounded-2xl mb-4 text-white text-xs outline-none focus:border-white/20" />
              <button onClick={handleAddFoto} style={{ backgroundColor: corPrincipal }} className="w-full py-5 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all">Adicionar</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {fotos.map(f => (
                <div key={f.id} className="relative group overflow-hidden rounded-[24px] border border-white/5">
                  <img src={f.url} className="w-full h-40 object-cover" alt="" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                    <button onClick={() => deletarDoc("galeria", f.id)} className="bg-red-600 p-3 rounded-full"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTEÚDO: FINANCEIRO */}
        {abaAtiva === 'financeiro' && (
          <div style={{ background: `linear-gradient(to bottom right, ${corPrincipal}, ${corPrincipal}88)` }} className="p-10 rounded-[40px] shadow-2xl border border-white/10 text-left">
            <p className="text-white/60 text-[10px] font-black uppercase mb-4 tracking-[4px]">Faturamento Acumulado</p>
            <h2 className="text-6xl font-black italic tracking-tighter text-white">R$ {financeiro.hoje.toFixed(2)}</h2>
          </div>
        )}
      </main>

      {/* MODAL NOVO SERVIÇO */}
      <AnimatePresence>
        {modalNovoServico && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed bottom-0 inset-x-0 bg-[#0A0A0A] p-8 z-[101] rounded-t-[40px] border-t border-white/10 shadow-2xl">
             <div className="w-12 h-1 bg-white/10 mx-auto mb-6 rounded-full" />
             <div className="space-y-4 text-left">
               <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Nome do Serviço</label>
               <input value={novoNomeS} onChange={e=>setNovoNomeS(e.target.value)} placeholder="Ex: Corte Degradê" className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl text-white font-bold outline-none" />
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Preço (R$)</label>
                    <input value={novoPrecoS} onChange={e=>setNovoPrecoS(e.target.value)} type="number" placeholder="0.00" className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl text-white font-bold outline-none" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Tempo (Min)</label>
                    <input value={novoTempoS} onChange={e=>setNovoTempoS(e.target.value)} type="number" placeholder="Ex: 30" className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl text-white font-bold outline-none" />
                 </div>
               </div>
               <button onClick={handleAddServico} style={{ backgroundColor: corPrincipal }} className="w-full py-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">Salvar Serviço</button>
               <button onClick={()=>setModalNovoServico(false)} className="w-full py-4 text-slate-500 text-[10px] font-black uppercase mt-2">Cancelar</button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Admin;