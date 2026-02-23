import { useState, useEffect } from 'react';
import { 
  Users, DollarSign, Calendar, Star, CheckCircle, XCircle, 
  Menu, X, LayoutDashboard, Plus, Scissors as ScissorsIcon, 
  TrendingUp, Clock, Trash2, Check, UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

// 🔗 LINK DO SEU SERVIDOR NO RENDER
const API_URL = "https://iamjoaozin.onrender.com";

export default function AdminDashboard() {
  const [abaAtiva, setAbaAtiva] = useState('agenda');
  const [modalNovoServico, setModalNovoServico] = useState(false);
  const [modalNovoAgendamento, setModalNovoAgendamento] = useState(false);

  // --- ESTADOS REAIS ---
  const [agendamentos, setAgendamentos] = useState([]);
  const [financeiro, setFinanceiro] = useState({ hoje: 0, previsao: 0 });
  const [servicos, setServicos] = useState([
    { id: 1, nome: "Corte Social", preco: 40.0, tempo: "30 min" },
    { id: 2, nome: "Combo NEX", preco: 65.0, tempo: "1h" },
  ]);

  // Estados dos Forms
  const [novoNomeS, setNovoNomeS] = useState('');
  const [novoPrecoS, setNovoPrecoS] = useState('');
  const [novoTempoNumS, setNovoTempoNumS] = useState('');
  const [unidadeS, setUnidadeS] = useState('min');
  const [clienteA, setClienteA] = useState('');
  const [horaA, setHoraA] = useState('');

  // --- BUSCAR DADOS DO SERVIDOR ---
  const carregarDados = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/agendamentos`);
      const data = await res.json();
      if (data.agendamentos) {
        setAgendamentos(data.agendamentos);
        setFinanceiro({ hoje: data.faturamento, previsao: data.previsao });
      }
    } catch (error) {
      toast.error("Erro ao conectar com o servidor!");
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // --- FUNÇÕES DE AÇÃO ---
  const concluirAtendimento = async (id) => {
    // Aqui no futuro faremos um PATCH, por enquanto simulamos a conclusão visual
    // e atualizamos o estado local
    setAgendamentos(agendamentos.map(a => a.id === id ? {...a, status: 'Concluído'} : a));
    toast.success("Atendimento concluído!");
  };

  const deletarAgendamento = async (id) => {
    try {
      const res = await fetch(`${API_URL}/admin/agendamentos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAgendamentos(agendamentos.filter(a => a.id !== id));
        toast.success("Removido com sucesso!");
      }
    } catch (error) {
      toast.error("Erro ao deletar.");
    }
  };

  const addAgendamentoManual = async () => {
    if (!clienteA || !horaA) return toast.error("Preencha nome e hora!");
    
    // Simulando a criação para o banco
    const novo = {
      userId: "ADMIN_MANUAL",
      userName: clienteA,
      service: "Manual",
      price: 0,
      date: new Date().toISOString().split('T')[0] + `T${horaA}:00.000Z`
    };

    try {
      const res = await fetch(`${API_URL}/agendamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novo)
      });
      if (res.ok) {
        carregarDados(); // Recarrega a lista do banco
        setModalNovoAgendamento(false);
        setClienteA(''); setHoraA('');
        toast.success("Agendado no Banco!");
      }
    } catch (error) {
      toast.error("Erro ao salvar agendamento.");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-20 md:pb-0">
      <header className="p-4 md:p-6 flex justify-between items-center bg-black/60 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
            <LayoutDashboard size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-black italic tracking-tighter text-indigo-500">NEX <span className="text-white">ADMIN</span></h1>
        </div>
        <button onClick={() => carregarDados()} className="p-2 bg-white/5 rounded-xl text-[10px] font-bold">RECARREGAR</button>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {['agenda', 'servicos', 'financeiro'].map(aba => (
            <button key={aba} onClick={() => setAbaAtiva(aba)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${abaAtiva === aba ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-500'}`}>{aba}</button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {abaAtiva === 'agenda' && (
            <motion.div key="a" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 italic">Próximos Clientes (Banco Real)</h2>
                <button onClick={() => setModalNovoAgendamento(true)} className="bg-indigo-600 p-2 rounded-lg"><UserPlus size={18}/></button>
              </div>
              
              {agendamentos.length === 0 && <p className="text-center text-slate-600 py-10 italic">Nenhum agendamento encontrado...</p>}

              {agendamentos.map(ag => (
                <div key={ag.id} className={`p-5 rounded-[28px] border flex justify-between items-center transition-all ${ag.status === 'Concluído' ? 'bg-white/[0.02] border-white/5 opacity-40' : 'bg-white/5 border-white/10 shadow-xl'}`}>
                  <div className="flex gap-4 items-center">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex flex-col items-center justify-center font-black italic text-[10px]">
                       <span>{new Date(ag.date).getHours()}:{String(new Date(ag.date).getMinutes()).padStart(2, '0')}</span>
                    </div>
                    <div>
                      <p className={`font-bold ${ag.status === 'Concluído' && 'line-through'}`}>{ag.nome || 'Cliente Nex'}</p>
                      <p className="text-[9px] font-black uppercase text-indigo-400">{ag.service} • R$ {ag.price}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {ag.status !== 'Concluído' && <button onClick={() => concluirAtendimento(ag.id)} className="p-3 bg-green-500/10 text-green-500 rounded-xl"><Check size={18}/></button>}
                    <button onClick={() => deletarAgendamento(ag.id)} className="p-3 bg-red-500/10 text-red-500 rounded-xl"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {abaAtiva === 'financeiro' && (
            <motion.div key="f" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-[40px] shadow-2xl mb-6">
                <p className="text-[10px] font-black uppercase text-indigo-200 mb-2">Faturamento Hoje (Confirmado)</p>
                <h2 className="text-4xl font-black italic tracking-tighter">R$ {financeiro.hoje.toFixed(2)}</h2>
              </div>
              <div className="bg-white/5 border border-white/10 p-8 rounded-[40px]">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Previsão para Amanhã</p>
                <h2 className="text-2xl font-black italic tracking-tighter text-white">R$ {financeiro.previsao.toFixed(2)}</h2>
              </div>
            </motion.div>
          )}

          {/* ABA SERVIÇOS (Aqui você pode manter a lógica de adicionar local ou criar rota no banco) */}
          {abaAtiva === 'servicos' && (
             <p className="text-center text-slate-500 py-20">Gestão de serviços online em breve...</p>
          )}
        </AnimatePresence>
      </main>

      {/* MODAL AGENDAMENTO MANUAL */}
      <AnimatePresence>
        {modalNovoAgendamento && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setModalNovoAgendamento(false)} className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200]" />
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A] border-t border-white/10 p-8 z-[201] rounded-t-[40px] md:max-w-md md:mx-auto md:bottom-10 md:rounded-[40px] md:border">
               <h2 className="text-lg font-black italic uppercase mb-6 text-indigo-500">Agendar Cliente na Hora</h2>
               <div className="space-y-4">
                 <input value={clienteA} onChange={e=>setClienteA(e.target.value)} placeholder="Nome do Cliente" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-indigo-500 transition-all" />
                 <input value={horaA} onChange={e=>setHoraA(e.target.value)} placeholder="Ex: 14:00" type="time" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-indigo-500 transition-all text-white" />
                 <button onClick={addAgendamentoManual} className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase text-xs shadow-[0_0_20px_rgba(79,70,229,0.4)]">Confirmar e Salvar no Banco</button>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}