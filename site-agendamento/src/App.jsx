import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Plus, Scissors as ScissorsIcon, 
  Clock, Trash2, Check, UserPlus, RefreshCw, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'react-hot-toast';

// 🔗 LINK DO SEU SERVIDOR NO RENDER
const API_URL = "https://iamjoaozin.onrender.com";

function App() {
  const [abaAtiva, setAbaAtiva] = useState('agenda');
  const [modalNovoServico, setModalNovoServico] = useState(false);
  const [modalNovoAgendamento, setModalNovoAgendamento] = useState(false);
  const [carregando, setCarregando] = useState(false);

  // --- ESTADOS DE DADOS ---
  const [agendamentos, setAgendamentos] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [financeiro, setFinanceiro] = useState({ hoje: 0, previsao: 0 });

  // Estados dos Formulários
  const [novoNomeS, setNovoNomeS] = useState('');
  const [novoPrecoS, setNovoPrecoS] = useState('');
  const [novoTempoNumS, setNovoTempoNumS] = useState('');
  const [unidadeS, setUnidadeS] = useState('min');
  const [clienteA, setClienteA] = useState('');
  const [horaA, setHoraA] = useState('');

  // --- BUSCAR DADOS (READ) ---
  const buscarTudo = async () => {
    setCarregando(true);
    try {
      const [resAgendas, resServicos] = await Promise.all([
        fetch(`${API_URL}/admin/agendamentos`),
        fetch(`${API_URL}/servicos`)
      ]);
      
      const dataAgendas = await resAgendas.json();
      const dataServicos = await resServicos.json();

      setAgendamentos(dataAgendas.agendamentos || []);
      setFinanceiro({ hoje: dataAgendas.faturamento || 0, previsao: 0 });
      setServicos(dataServicos || []);
    } catch (error) {
      toast.error("Erro ao sincronizar com o servidor");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    buscarTudo();
  }, []);

  // --- AÇÕES DE SERVIÇOS ---
  const handleAddServico = async () => {
    if (!novoNomeS || !novoPrecoS) return toast.error("Preencha nome e preço!");
    try {
      const res = await fetch(`${API_URL}/servicos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoNomeS,
          preco: parseFloat(novoPrecoS),
          tempo: `${novoTempoNumS} ${unidadeS}`
        })
      });
      if (res.ok) {
        toast.success("Serviço adicionado!");
        setModalNovoServico(false);
        setNovoNomeS(''); setNovoPrecoS(''); setNovoTempoNumS('');
        buscarTudo();
      }
    } catch (e) { toast.error("Erro ao salvar serviço"); }
  };

  const deletarServico = async (id) => {
    if (!confirm("Excluir este serviço?")) return;
    try {
      await fetch(`${API_URL}/servicos/${id}`, { method: 'DELETE' });
      setServicos(servicos.filter(s => s.id !== id));
      toast.success("Serviço removido");
    } catch (e) { toast.error("Erro ao deletar"); }
  };

  // --- AÇÕES DE AGENDA ---
  const handleAddAgendaManual = async () => {
    if (!clienteA || !horaA) return toast.error("Nome e Hora são obrigatórios!");
    try {
      const res = await fetch(`${API_URL}/agendamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: "ADMIN",
          userName: clienteA,
          service: "Manual/Avulso",
          price: 0,
          date: new Date().toISOString().split('T')[0] + `T${horaA}:00.000Z`
        })
      });
      if (res.ok) {
        toast.success("Agendado com sucesso!");
        setModalNovoAgendamento(false);
        setClienteA(''); setHoraA('');
        buscarTudo();
      }
    } catch (e) { toast.error("Erro ao agendar"); }
  };

  const deletarAgenda = async (id) => {
    try {
      await fetch(`${API_URL}/admin/agendamentos/${id}`, { method: 'DELETE' });
      setAgendamentos(agendamentos.filter(a => a.id !== id));
      toast.success("Agendamento cancelado");
    } catch (e) { toast.error("Erro ao remover"); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-24">
      <Toaster position="top-center" />
      
      <header className="p-4 md:p-6 flex justify-between items-center bg-black/60 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
            <LayoutDashboard size={20} />
          </div>
          <h1 className="text-xl font-black italic tracking-tighter uppercase">Nex <span className="text-indigo-500">Admin</span></h1>
        </div>
        <button onClick={buscarTudo} className={`p-2 bg-white/5 rounded-xl transition-all ${carregando && 'animate-spin'}`}>
          <RefreshCw size={20} />
        </button>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {['agenda', 'servicos', 'financeiro'].map(aba => (
            <button 
              key={aba} 
              onClick={() => setAbaAtiva(aba)} 
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${abaAtiva === aba ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-500'}`}
            >
              {aba}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {abaAtiva === 'agenda' && (
            <motion.div key="agenda" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}} className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h2 className="text-xs font-black uppercase text-slate-500 italic">Lista de Espera</h2>
                <button onClick={() => setModalNovoAgendamento(true)} className="bg-indigo-600 p-2 rounded-lg"><UserPlus size={18}/></button>
              </div>
              {agendamentos.map(ag => (
                <div key={ag.id} className="p-5 rounded-[28px] border border-white/10 bg-white/5 flex justify-between items-center">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-black text-xs italic">
                      {new Date(ag.date).getHours()}:{String(new Date(ag.date).getMinutes()).padStart(2, '0')}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{ag.userName || "Cliente"}</p>
                      <p className="text-[9px] font-black uppercase text-indigo-400">{ag.service}</p>
                    </div>
                  </div>
                  <button onClick={() => deletarAgenda(ag.id)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={18}/></button>
                </div>
              ))}
            </motion.div>
          )}

          {abaAtiva === 'servicos' && (
            <motion.div key="serv" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {servicos.map(s => (
                <div key={s.id} className="bg-white/5 border border-white/10 p-6 rounded-[32px] relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-400"><ScissorsIcon size={20}/></div>
                    <button onClick={() => deletarServico(s.id)} className="text-slate-600 hover:text-red-500"><Trash2 size={18}/></button>
                  </div>
                  <h3 className="font-bold text-lg">{s.nome}</h3>
                  <div className="flex items-center gap-4 mt-4">
                    <span className="text-xl font-black italic text-white">R$ {s.preco.toFixed(2)}</span>
                    <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1"><Clock size={12}/> {s.tempo}</span>
                  </div>
                </div>
              ))}
              <button onClick={() => setModalNovoServico(true)} className="border-2 border-dashed border-white/10 p-8 rounded-[32px] flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-indigo-600 hover:text-indigo-600 transition-all min-h-[160px]">
                <Plus size={30} />
                <span className="text-xs font-black uppercase tracking-tighter">Adicionar Serviço</span>
              </button>
            </motion.div>
          )}

          {abaAtiva === 'financeiro' && (
            <motion.div key="fin" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}} className="space-y-6">
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-[40px] shadow-2xl">
                <p className="text-indigo-200 text-[10px] font-black uppercase mb-2 flex items-center gap-2"><DollarSign size={14}/> Faturamento de Hoje</p>
                <h2 className="text-5xl font-black italic tracking-tighter">R$ {financeiro.hoje.toFixed(2)}</h2>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* MODAL NOVO SERVIÇO */}
      <AnimatePresence>
        {modalNovoServico && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setModalNovoServico(false)} className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]" />
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A] border-t border-white/10 p-8 z-[101] rounded-t-[40px] md:max-w-md md:mx-auto md:bottom-10 md:rounded-[40px] border-x">
              <h2 className="text-xl font-black italic uppercase mb-6 text-indigo-500">Novo Serviço</h2>
              <div className="space-y-4">
                <input value={novoNomeS} onChange={e=>setNovoNomeS(e.target.value)} placeholder="Nome do Serviço" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-indigo-500" />
                <div className="flex gap-2">
                  <input value={novoPrecoS} onChange={e=>setNovoPrecoS(e.target.value)} type="number" placeholder="R$ 0,00" className="w-2/3 p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-indigo-500" />
                  <select value={unidadeS} onChange={e=>setUnidadeS(e.target.value)} className="w-1/3 bg-white/5 border border-white/10 rounded-2xl p-4 text-[10px] font-black uppercase outline-none">
                    <option value="min">Min</option>
                    <option value="h">Horas</option>
                  </select>
                </div>
                <input value={novoTempoNumS} onChange={e=>setNovoTempoNumS(e.target.value)} placeholder="Tempo (ex: 30)" type="number" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-indigo-500" />
                <button onClick={handleAddServico} className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase text-xs shadow-lg shadow-indigo-500/40">Salvar Serviço</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL AGENDAMENTO MANUAL */}
      <AnimatePresence>
        {modalNovoAgendamento && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setModalNovoAgendamento(false)} className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]" />
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A] border-t border-white/10 p-8 z-[101] rounded-t-[40px] md:max-w-md md:mx-auto md:bottom-10 md:rounded-[40px] border-x">
              <h2 className="text-xl font-black italic uppercase mb-6 text-indigo-500">Agendar Manual</h2>
              <div className="space-y-4">
                <input value={clienteA} onChange={e=>setClienteA(e.target.value)} placeholder="Nome do Cliente" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-indigo-500" />
                <input value={horaA} onChange={e=>setHoraA(e.target.value)} type="time" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-indigo-500 text-white" />
                <button onClick={handleAddAgendaManual} className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase text-xs">Confirmar Horário</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;