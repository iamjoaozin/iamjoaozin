import { useState } from 'react';
import { 
  Users, DollarSign, Calendar, Star, CheckCircle, XCircle, 
  Menu, X, LayoutDashboard, Plus, Scissors as ScissorsIcon, 
  TrendingUp, Clock, Trash2, Check, UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

export default function AdminDashboard() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('agenda');
  const [modalNovoServico, setModalNovoServico] = useState(false);
  const [modalNovoAgendamento, setModalNovoAgendamento] = useState(false);

  // --- ESTADOS ---
  const [agendamentos, setAgendamentos] = useState([
    { id: 1, nome: "Carlos Silva", servico: "Corte Social", data: "14:00", valor: 40.0, status: "Pendente" },
    { id: 2, nome: "Rafael Souza", servico: "Combo NEX", data: "15:30", valor: 65.0, status: "Pendente" },
  ]);

  const [servicos, setServicos] = useState([
    { id: 1, nome: "Corte Social", preco: 40.0, tempo: "30 min" },
    { id: 2, nome: "Progressiva", preco: 180.0, tempo: "2 h" },
  ]);

  // Form Novo Serviço
  const [novoNomeS, setNovoNomeS] = useState('');
  const [novoPrecoS, setNovoPrecoS] = useState('');
  const [novoTempoNumS, setNovoTempoNumS] = useState('');
  const [unidadeS, setUnidadeS] = useState('min');

  // Form Novo Agendamento (Manual)
  const [clienteA, setClienteA] = useState('');
  const [servicoA, setServicoA] = useState('');
  const [horaA, setHoraA] = useState('');

  // --- FUNÇÕES ---
  const addServico = () => {
    if (!novoNomeS || !novoPrecoS || !novoTempoNumS) return toast.error("Preencha tudo!");
    const novo = { id: Date.now(), nome: novoNomeS, preco: parseFloat(novoPrecoS), tempo: `${novoTempoNumS} ${unidadeS}` };
    setServicos([...servicos, novo]);
    setModalNovoServico(false);
    toast.success("Serviço adicionado!");
  };

  const addAgendamento = () => {
    if (!clienteA || !horaA) return toast.error("Preencha o nome e hora!");
    const novo = { id: Date.now(), nome: clienteA, servico: servicoA || "Avulso", data: horaA, valor: 0, status: "Pendente" };
    setAgendamentos([novo, ...agendamentos]);
    setModalNovoAgendamento(false);
    toast.success("Agendado!");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-20 md:pb-0">
      
      {/* HEADER */}
      <header className="p-4 md:p-6 flex justify-between items-center bg-black/60 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
            <LayoutDashboard size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-black italic tracking-tighter text-indigo-500">NEX <span className="text-white">ADMIN</span></h1>
        </div>
        <button onClick={() => setMenuAberto(true)} className="p-2 bg-white/5 rounded-xl"><Menu size={24} /></button>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* TABS */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {['agenda', 'servicos', 'financeiro'].map(aba => (
            <button key={aba} onClick={() => setAbaAtiva(aba)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${abaAtiva === aba ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-500'}`}>{aba}</button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ABA AGENDA */}
          {abaAtiva === 'agenda' && (
            <motion.div key="a" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 italic">Próximos Clientes</h2>
                <button onClick={() => setModalNovoAgendamento(true)} className="bg-indigo-600 p-2 rounded-lg"><UserPlus size={18}/></button>
              </div>
              {agendamentos.map(ag => (
                <div key={ag.id} className={`p-5 rounded-[28px] border flex justify-between items-center transition-all ${ag.status === 'Concluído' ? 'bg-white/2 border-white/5 opacity-40' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center font-black italic text-xs">{ag.data}</div>
                    <div>
                      <p className={`font-bold ${ag.status === 'Concluído' && 'line-through'}`}>{ag.nome}</p>
                      <p className="text-[9px] font-black uppercase text-indigo-400">{ag.servico}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {ag.status === 'Pendente' && <button onClick={() => setAgendamentos(agendamentos.map(a => a.id === ag.id ? {...a, status: 'Concluído'} : a))} className="p-3 bg-green-500/10 text-green-500 rounded-xl"><Check size={18}/></button>}
                    <button onClick={() => setAgendamentos(agendamentos.filter(a => a.id !== ag.id))} className="p-3 bg-red-500/10 text-red-500 rounded-xl"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* ABA SERVICOS */}
          {abaAtiva === 'servicos' && (
            <motion.div key="s" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servicos.map(s => (
                <div key={s.id} className="bg-white/5 border border-white/10 p-6 rounded-[28px] relative group shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400"><ScissorsIcon size={20}/></div>
                    <p className="text-xl font-black italic">R$ {s.preco.toFixed(2)}</p>
                  </div>
                  <h3 className="font-bold text-lg mb-1">{s.nome}</h3>
                  <div className="flex items-center gap-2 text-indigo-400/60 text-[10px] font-black uppercase"><Clock size={12}/> {s.tempo}</div>
                  <button onClick={() => setServicos(servicos.filter(i => i.id !== s.id))} className="absolute top-4 right-4 p-2 text-slate-600 hover:text-red-500"><Trash2 size={16}/></button>
                </div>
              ))}
              <button onClick={() => setModalNovoServico(true)} className="border-2 border-dashed border-white/10 p-6 rounded-[28px] flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-indigo-500 transition-all min-h-[160px]"><Plus size={24} /><span className="text-[10px] font-black uppercase tracking-widest">Novo Serviço</span></button>
            </motion.div>
          )}

          {/* ABA FINANCEIRO */}
          {abaAtiva === 'financeiro' && (
            <motion.div key="f" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-[40px] shadow-2xl mb-6">
                <p className="text-[10px] font-black uppercase text-indigo-200 mb-2">Faturamento Estimado</p>
                <h2 className="text-4xl font-black italic tracking-tighter">R$ 2.840,00</h2>
              </div>
              <div className="p-10 border border-white/5 rounded-[40px] text-center text-slate-600 italic text-xs uppercase font-black">Gráficos de desempenho em breve</div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* MODAIS (SERVIÇO & AGENDAMENTO) */}
      <AnimatePresence>
        {(modalNovoServico || modalNovoAgendamento) && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => {setModalNovoServico(false); setModalNovoAgendamento(false)}} className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200]" />
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A] border-t border-white/10 p-8 z-[201] rounded-t-[40px] md:max-w-md md:mx-auto md:bottom-10 md:rounded-[40px] md:border">
               <h2 className="text-lg font-black italic uppercase mb-6">{modalNovoServico ? "Novo Serviço" : "Agendar Cliente"}</h2>
               {modalNovoServico ? (
                 <div className="space-y-4">
                   <input value={novoNomeS} onChange={e=>setNovoNomeS(e.target.value)} placeholder="Nome" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none" />
                   <div className="grid grid-cols-2 gap-2">
                     <input value={novoPrecoS} onChange={e=>setNovoPrecoS(e.target.value)} placeholder="R$ 0.00" type="number" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none" />
                     <div className="flex bg-white/5 border border-white/10 rounded-2xl overflow-hidden"><input value={novoTempoNumS} onChange={e=>setNovoTempoNumS(e.target.value)} placeholder="1" className="w-1/2 p-4 bg-transparent outline-none"/><select value={unidadeS} onChange={e=>setUnidadeS(e.target.value)} className="w-1/2 bg-white/10 text-[10px] font-black uppercase outline-none px-2"><option value="min">Min</option><option value="h">H</option></select></div>
                   </div>
                   <button onClick={addServico} className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase text-xs">Salvar Serviço</button>
                 </div>
               ) : (
                 <div className="space-y-4">
                   <input value={clienteA} onChange={e=>setClienteA(e.target.value)} placeholder="Nome do Cliente" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none" />
                   <input value={horaA} onChange={e=>setHoraA(e.target.value)} placeholder="Ex: 14:00" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none" />
                   <button onClick={addAgendamento} className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase text-xs">Confirmar Agenda</button>
                 </div>
               )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}