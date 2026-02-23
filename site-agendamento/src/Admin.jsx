import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Plus, Scissors as ScissorsIcon, 
  Clock, Trash2, UserPlus, RefreshCw, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'react-hot-toast';

const API_URL = "https://iamjoaozin.onrender.com";

const Admin = () => {
  const [abaAtiva, setAbaAtiva] = useState('agenda');
  const [modalNovoServico, setModalNovoServico] = useState(false);
  const [modalNovoAgendamento, setModalNovoAgendamento] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const [agendamentos, setAgendamentos] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [financeiro, setFinanceiro] = useState({ hoje: 0, previsao: 0 });

  const [novoNomeS, setNovoNomeS] = useState('');
  const [novoPrecoS, setNovoPrecoS] = useState('');
  const [novoTempoNumS, setNovoTempoNumS] = useState('');
  const [unidadeS, setUnidadeS] = useState('min');
  const [clienteA, setClienteA] = useState('');
  const [horaA, setHoraA] = useState('');

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
      toast.error("Erro de conexão");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { buscarTudo(); }, []);

  const handleAddServico = async () => {
    if (!novoNomeS || !novoPrecoS) return toast.error("Preencha tudo!");
    const res = await fetch(`${API_URL}/servicos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: novoNomeS, preco: parseFloat(novoPrecoS), tempo: `${novoTempoNumS} ${unidadeS}` })
    });
    if (res.ok) { setModalNovoServico(false); buscarTudo(); toast.success("Serviço Salvo!"); }
  };

  const deletarAgenda = async (id) => {
    await fetch(`${API_URL}/admin/agendamentos/${id}`, { method: 'DELETE' });
    buscarTudo();
    toast.success("Removido");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <Toaster position="top-center" />
      <header className="p-4 flex justify-between items-center bg-black/60 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <LayoutDashboard size={20} />
          </div>
          <h1 className="text-xl font-black italic uppercase">Nex <span className="text-indigo-500">Admin</span></h1>
        </div>
        <button onClick={buscarTudo} className={`p-2 bg-white/5 rounded-xl ${carregando && 'animate-spin'}`}><RefreshCw size={20} /></button>
      </header>

      <main className="p-4 max-w-7xl mx-auto">
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {['agenda', 'servicos', 'financeiro'].map(aba => (
            <button key={aba} onClick={() => setAbaAtiva(aba)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${abaAtiva === aba ? 'bg-indigo-600' : 'bg-white/5 text-slate-500'}`}>{aba}</button>
          ))}
        </div>

        {abaAtiva === 'agenda' && (
          <div className="space-y-4">
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
                <button onClick={() => deletarAgenda(ag.id)} className="p-3 text-red-500"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
        )}

        {abaAtiva === 'servicos' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {servicos.map(s => (
              <div key={s.id} className="bg-white/5 border border-white/10 p-6 rounded-[32px]">
                <h3 className="font-bold text-lg">{s.nome}</h3>
                <p className="text-xl font-black italic text-white mt-2">R$ {s.preco.toFixed(2)}</p>
                <button onClick={async () => { await fetch(`${API_URL}/servicos/${s.id}`, {method:'DELETE'}); buscarTudo(); }} className="mt-4 text-red-500"><Trash2 size={16}/></button>
              </div>
            ))}
            <button onClick={() => setModalNovoServico(true)} className="border-2 border-dashed border-white/10 p-8 rounded-[32px] flex flex-col items-center justify-center text-slate-500">+</button>
          </div>
        )}

        {abaAtiva === 'financeiro' && (
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-[40px]">
            <p className="text-indigo-200 text-[10px] font-black uppercase mb-2 flex items-center gap-2"><DollarSign size={14}/> Faturamento de Hoje</p>
            <h2 className="text-5xl font-black italic tracking-tighter">R$ {financeiro.hoje.toFixed(2)}</h2>
          </div>
        )}
      </main>

      {/* Modal Simplificado */}
      <AnimatePresence>
        {modalNovoServico && (
          <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} className="fixed bottom-0 inset-x-0 bg-[#0A0A0A] p-8 z-[101] rounded-t-[40px] border-t border-white/10">
            <input value={novoNomeS} onChange={e=>setNovoNomeS(e.target.value)} placeholder="Nome do Serviço" className="w-full p-4 bg-white/5 rounded-2xl mb-4" />
            <input value={novoPrecoS} onChange={e=>setNovoPrecoS(e.target.value)} type="number" placeholder="Preço" className="w-full p-4 bg-white/5 rounded-2xl mb-4" />
            <button onClick={handleAddServico} className="w-full bg-indigo-600 py-5 rounded-2xl font-black">SALVAR</button>
            <button onClick={() => setModalNovoServico(false)} className="w-full py-4 text-slate-500">FECHAR</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Admin;