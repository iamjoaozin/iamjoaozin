import React, { useState, useEffect } from 'react';
import { Scissors, Clock, CheckCircle2, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'react-hot-toast';

const API_URL = "https://iamjoaozin.onrender.com";

const Cliente = () => {
  const [servicos, setServicos] = useState([]);
  const [etapa, setEtapa] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [servicoSel, setServicoSel] = useState(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [hora, setHora] = useState('');
  const [pixData, setPixData] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/servicos`)
      .then(res => res.json())
      .then(data => setServicos(data));
  }, []);

  const finalizarAgendamento = async () => {
    if (!nome || !telefone || !hora) return toast.error("Preencha tudo!");
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/agendamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: nome, service: servicoSel.nome, price: servicoSel.preco, date: new Date().toISOString().split('T')[0] + `T${hora}:00.000Z`, userId: telefone })
      });
      const data = await res.json();
      if (data.pixCopiaECola) { setPixData(data); setEtapa(3); }
    } catch (e) { toast.error("Erro ao gerar PIX"); }
    setCarregando(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4">
      <Toaster />
      <header className="py-8 text-center">
        <h1 className="text-3xl font-black italic text-indigo-500 uppercase">Nex <span className="text-white">Barber</span></h1>
      </header>

      <main className="max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {etapa === 1 && (
            <motion.div key="e1" className="space-y-4">
              {servicos.map(s => (
                <button key={s.id} onClick={() => { setServicoSel(s); setEtapa(2); }} className="w-full p-6 bg-white/5 border border-white/10 rounded-[32px] flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <Scissors size={20} className="text-indigo-400" />
                    <div className="text-left"><p className="font-bold">{s.nome}</p><p className="text-[10px] text-slate-500 uppercase">{s.tempo}</p></div>
                  </div>
                  <span className="font-black italic text-indigo-400">R$ {s.preco.toFixed(2)}</span>
                </button>
              ))}
            </motion.div>
          )}

          {etapa === 2 && (
            <motion.div key="e2" className="space-y-4">
              <input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Seu Nome" className="w-full p-4 bg-white/5 rounded-2xl outline-none" />
              <input value={telefone} onChange={e=>setTelefone(e.target.value)} placeholder="Seu WhatsApp" className="w-full p-4 bg-white/5 rounded-2xl outline-none" />
              <input value={hora} onChange={e=>setHora(e.target.value)} type="time" className="w-full p-4 bg-white/5 rounded-2xl outline-none" />
              <button onClick={finalizarAgendamento} className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase">{carregando ? "Gerando..." : "Pagar e Agendar"}</button>
            </motion.div>
          )}

          {etapa === 3 && (
            <motion.div key="e3" className="text-center p-8 bg-white/5 rounded-[40px] border border-white/10 space-y-6">
              <CheckCircle2 size={48} className="mx-auto text-green-500" />
              <div className="bg-white p-4 rounded-3xl inline-block">
                <img src={`data:image/jpeg;base64,${pixData.qrCodeBase64}`} alt="QR PIX" className="w-48 h-48" />
              </div>
              <button onClick={() => { navigator.clipboard.writeText(pixData.pixCopiaECola); toast.success("Copiado!"); }} className="w-full bg-white/10 py-4 rounded-2xl font-bold">Copiar Código PIX</button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Cliente;