import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom'; // IMPORTANTE
import { Scissors, CheckCircle2, LogOut, Calendar as CalendarIcon, Clock, MessageCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'react-hot-toast';
import { db } from './firebase'; 
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, where, getDocs, doc, getDoc } from 'firebase/firestore';

const Cliente = ({ user, onLogout }) => {
  const { lojaId } = useParams(); // Pega o slug da URL
  const [dadosLoja, setDadosLoja] = useState(null);
  const [servicos, setServicos] = useState([]);
  const [fotos, setFotos] = useState([]); 
  const [agendamentosDoDia, setAgendamentosDoDia] = useState([]);
  const [etapa, setEtapa] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [servicoSel, setServicoSel] = useState(null);
  
  const hojeStr = new Date().toISOString().split('T')[0];
  const [dataSel, setDataSel] = useState(hojeStr);
  const [hora, setHora] = useState('');

  // Cor Dinâmica: Pega do banco ou usa Indigo como padrão
  const corApp = dadosLoja?.corPrincipal || '#6366f1';

  // GRADE DE 10 EM 10 MINUTOS
  const gradeHorarios = [];
  for (let h = 8; h <= 19; h++) {
    for (let m = 0; m < 60; m += 10) {
      if (h === 12 || h === 13) continue; 
      const hh = h.toString().padStart(2, '0');
      const mm = m.toString().padStart(2, '0');
      gradeHorarios.push(`${hh}:${mm}`);
    }
  }

  // --- CARREGAR DADOS DA LOJA ESPECÍFICA ---
  useEffect(() => {
    if (!lojaId) return;

    // 1. Busca Configurações da Empresa (Nome, Cor, Logo, Zap)
    const buscarEmpresa = async () => {
      const q = query(collection(db, "empresas"), where("slug", "==", lojaId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setDadosLoja(snap.docs[0].data());
      }
    };
    buscarEmpresa();

    // 2. Serviços da Loja
    const qServicos = query(collection(db, "servicos"), where("lojaId", "==", lojaId), orderBy("preco", "asc"));
    onSnapshot(qServicos, (snap) => {
      setServicos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 3. Galeria da Loja
    const qGaleria = query(collection(db, "galeria"), where("lojaId", "==", lojaId));
    onSnapshot(qGaleria, (snap) => {
      setFotos(snap.docs.map(d => d.data().url));
    });
  }, [lojaId]);

  // --- AGENDAMENTOS DO DIA (FILTRADO POR LOJA) ---
  useEffect(() => {
    if (!dataSel || !lojaId) return setAgendamentosDoDia([]);
    const buscarAgendamentos = async () => {
      const q = query(
        collection(db, "agendamentos"), 
        where("data", "==", dataSel),
        where("lojaId", "==", lojaId)
      );
      const snap = await getDocs(q);
      setAgendamentosDoDia(snap.docs.map(d => d.data()));
    };
    buscarAgendamentos();
  }, [dataSel, lojaId]);

  const scrollRef = useRef(null);
  useEffect(() => {
    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [fotos]);

  const verificarDisponibilidade = (hSugerida) => {
    if (!dataSel) return "bloqueado"; 
    const [h, m] = hSugerida.split(':').map(Number);
    const inicioSugerido = h * 60 + m;
    const duracaoSugerida = parseInt(servicoSel?.tempo) || 30;
    const fimSugerido = inicioSugerido + duracaoSugerida;

    if (dataSel === hojeStr) {
      const agora = new Date();
      if (inicioSugerido <= (agora.getHours() * 60 + agora.getMinutes())) return "passado";
    }

    for (let ag of agendamentosDoDia) {
      const [agH, agM] = ag.horario.split(':').map(Number);
      const agInicio = agH * 60 + agM;
      const agDuracao = parseInt(ag.tempoOriginal) || 30;
      const agFim = agInicio + agDuracao;
      if (inicioSugerido < agFim && fimSugerido > agInicio) return "ocupado";
    }
    return "livre";
  };

  const finalizarAgendamento = async () => {
    if (!dataSel || !hora) return toast.error("Selecione data e hora!");
    setCarregando(true);
    try {
      await addDoc(collection(db, "agendamentos"), {
        lojaId: lojaId, // VINCULA O AGENDAMENTO À LOJA CERTA
        clienteUid: user.uid,
        clienteNome: user.displayName,
        clienteFoto: user.photoURL,
        servicoNome: servicoSel.nome,
        preco: servicoSel.preco,
        tempoOriginal: parseInt(servicoSel.tempo) || 30,
        horario: hora,
        data: dataSel,
        dataCriacao: serverTimestamp()
      });
      setEtapa(3);
    } catch (e) { toast.error("Erro ao salvar"); }
    finally { setCarregando(false); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 font-sans max-w-md mx-auto select-none">
      <Toaster position="top-center" />
      
      <header className="py-6 flex justify-between items-center border-b border-white/5 mb-4 px-2 text-left">
        <div className="flex items-center gap-3">
          <img 
            src={dadosLoja?.logoUrl || user.photoURL} 
            className="w-10 h-10 rounded-full border shadow-lg object-cover" 
            style={{ borderColor: corApp }}
            alt="" 
          />
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                {dadosLoja?.nomeLoja || 'Nex Barber'}
            </p>
            <p className="text-sm font-black italic">{user.displayName.split(' ')[0]}</p>
          </div>
        </div>
        <button onClick={onLogout} className="p-2 bg-white/5 rounded-xl text-slate-500"><LogOut size={18}/></button>
      </header>

      {etapa === 1 && (
        <div ref={scrollRef} className="mb-10 overflow-x-auto flex gap-4 scrollbar-hide py-2 px-1 snap-x snap-mandatory">
          {fotos.map((url, i) => (
            <div key={i} className="flex-shrink-0 snap-center">
              <img src={url} className="w-72 h-56 object-cover rounded-[40px] border border-white/10 shadow-2xl transition-all duration-300" style={{ filter: 'grayscale(85%) contrast(115%) brightness(85%)', WebkitTouchCallout: 'none', userSelect: 'none' }} onTouchStart={(e) => e.currentTarget.style.filter = 'grayscale(0%) contrast(100%) brightness(100%)'} onTouchEnd={(e) => e.currentTarget.style.filter = 'grayscale(85%) contrast(115%) brightness(85%)'} onContextMenu={(e) => e.preventDefault()} draggable="false" alt="" />
            </div>
          ))}
        </div>
      )}

      <main>
        <AnimatePresence mode="wait">
          {etapa === 1 && (
            <motion.div key="e1" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}}>
              <h2 style={{ color: corApp, textDecorationColor: `${corApp}30` }} className="text-[10px] font-black uppercase italic mb-6 tracking-[0.3em] text-center underline underline-offset-8">
                  Nossos Serviços
              </h2>
              <div className="space-y-3">
                {servicos.map(s => (
                  <button key={s.id} onClick={() => { setServicoSel(s); setEtapa(2); }} className="w-full p-6 bg-[#0A0A0A] border border-white/5 rounded-[32px] flex justify-between items-center active:scale-95 group transition-all">
                    <div className="text-left">
                      <p className="font-black italic uppercase text-sm group-hover:text-white" style={{ color: corApp }}>{s.nome}</p>
                      <p className="text-[10px] font-black opacity-60">🕒 {s.tempo || '30 min'}</p>
                    </div>
                    <span className="font-black italic text-white text-lg">R$ {Number(s.preco).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {etapa === 2 && (
            <motion.div key="e2" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} className="space-y-4">
              <button onClick={() => {setEtapa(1); setHora('')}} className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2">← Voltar</button>
              <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5 shadow-2xl space-y-6">
                <div className="text-center">
                    <h3 className="text-2xl font-black italic uppercase" style={{ color: corApp }}>{servicoSel.nome}</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Tempo: {servicoSel.tempo}</p>
                </div>
                
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Escolha o Dia</label>
                  <input type="date" min={hojeStr} value={dataSel} onChange={e => { setDataSel(e.target.value); setHora(''); }} className="w-full p-4 bg-black border border-white/5 rounded-2xl text-center text-white font-bold outline-none transition-all" style={{ borderColor: hora ? corApp : 'rgba(255,255,255,0.05)' }} />
                </div>

                {!dataSel ? (
                   <div className="py-10 text-center text-red-500 text-[10px] font-black uppercase border border-dashed border-red-500/20 rounded-3xl">⚠️ Por favor, escolha um dia</div>
                ) : (
                  <div className="space-y-6">
                    <div className="text-left">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-3 ml-2 tracking-widest">Horários Disponíveis (Manhã)</p>
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
                        {gradeHorarios
                          .filter(h => parseInt(h) < 12)
                          .filter(h => verificarDisponibilidade(h) === "livre")
                          .map(h => (
                            <button 
                                key={h} 
                                onClick={() => setHora(h)} 
                                style={{ 
                                    backgroundColor: hora === h ? corApp : 'rgba(255,255,255,0.05)',
                                    borderColor: hora === h ? corApp : 'rgba(255,255,255,0.05)' 
                                }}
                                className={`flex-shrink-0 w-20 py-4 rounded-2xl font-black text-xs transition-all border ${hora === h ? 'text-white shadow-lg' : 'text-slate-400'}`}
                            > {h} </button>
                          ))}
                      </div>
                    </div>

                    <div className="text-left">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-3 ml-2 tracking-widest">Horários Disponíveis (Tarde)</p>
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
                        {gradeHorarios
                          .filter(h => parseInt(h) >= 14)
                          .filter(h => verificarDisponibilidade(h) === "livre")
                          .map(h => (
                            <button 
                                key={h} 
                                onClick={() => setHora(h)} 
                                style={{ 
                                    backgroundColor: hora === h ? corApp : 'rgba(255,255,255,0.05)',
                                    borderColor: hora === h ? corApp : 'rgba(255,255,255,0.05)' 
                                }}
                                className={`flex-shrink-0 w-20 py-4 rounded-2xl font-black text-xs transition-all border ${hora === h ? 'text-white shadow-lg' : 'text-slate-400'}`}
                            > {h} </button>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
                
                <button 
                    onClick={finalizarAgendamento} 
                    disabled={!hora || !dataSel || carregando} 
                    style={{ backgroundColor: corApp }}
                    className="w-full py-6 rounded-3xl font-black uppercase text-xs mt-8 shadow-lg active:scale-95 transition-all disabled:opacity-20"
                >Confirmar Reserva</button>
              </div>
            </motion.div>
          )}

          {etapa === 3 && (
            <motion.div key="e3" initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} className="text-center p-8 bg-[#0A0A0A] rounded-[40px] border border-white/5 space-y-6 shadow-2xl">
              <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20"><CheckCircle2 size={40} /></div>
              <h2 className="text-2xl font-black italic uppercase tracking-tighter">Reservado!</h2>
              <button 
                onClick={() => {
                    const numeroZap = dadosLoja?.whatsapp || "5587991695672";
                    const msg = encodeURIComponent(`Olá! Agendei um ${servicoSel.nome} na ${dadosLoja?.nomeLoja} para o dia ${dataSel.split('-').reverse().join('/')} às ${hora}. Confirma aí?`);
                    window.open(`https://wa.me/${numeroZap}?text=${msg}`, '_blank');
                }} 
                className="w-full bg-green-600 text-white py-6 rounded-3xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              ><MessageCircle size={20}/> Avisar no WhatsApp</button>
              <button onClick={() => {setEtapa(1); setHora('')}} className="w-full py-4 text-slate-600 text-[10px] font-black uppercase underline">Novo Agendamento</button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Cliente;