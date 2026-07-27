import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  User, 
  LogOut, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';
import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  doc, 
  setDoc,
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { formatarMoeda } from './configSistema';
import InstallAppButton from './InstallAppButton';

const PainelProfissional = ({ user, onSair }) => {
  const { lojaId } = useParams();
  const [dadosLoja, setDadosLoja] = useState(null);
  const [profissionalData, setProfissionalData] = useState(null);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch store and professional data
  useEffect(() => {
    if (!lojaId || !user?.email) return;

    // Load store data
    const unsubLoja = onSnapshot(doc(db, 'empresas', lojaId), (snap) => {
      if (snap.exists()) setDadosLoja(snap.data());
    });

    // Load professional data linked to user's email
    const qProf = query(
      collection(db, 'profissionais'), 
      where('lojaId', '==', lojaId),
      where('emailVinculado', '==', user.email)
    );

    const unsubProf = onSnapshot(qProf, (snap) => {
      if (!snap.empty) {
        const docProf = snap.docs[0];
        setProfissionalData({ id: docProf.id, ...docProf.data() });
      } else {
        setProfissionalData(null);
      }
      setLoading(false);
    });

    return () => {
      unsubLoja();
      unsubProf();
    };
  }, [lojaId, user?.email]);

  // 2. Fetch professional's appointments
  useEffect(() => {
    if (!lojaId || !profissionalData?.id) return;

    const qAgend = query(
      collection(db, 'agendamentos'),
      where('lojaId', '==', lojaId),
      where('profissionalId', '==', profissionalData.id),
      orderBy('data', 'desc')
    );

    const unsubAgend = onSnapshot(qAgend, (snap) => {
      setAgendamentos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsubAgend();
  }, [lojaId, profissionalData?.id]);

  const mudarStatusAgendamento = async (ag, novoStatus) => {
    try {
      await setDoc(doc(db, 'agendamentos', ag.id), { status: novoStatus }, { merge: true });
      toast.success(`Agendamento ${novoStatus === 'concluido' ? 'concluído' : novoStatus === 'confirmado' ? 'confirmado' : 'cancelado'}!`);
    } catch (e) {
      toast.error('Erro ao atualizar status');
    }
  };

  const enviarLembrete = (ag) => {
    const numLimpo = ag.clienteWhatsapp?.replace(/\D/g, '');
    if (!numLimpo) return toast.error('WhatsApp não cadastrado!');
    const numFinal = numLimpo.startsWith('55') ? numLimpo : `55${numLimpo}`;
    const msg = encodeURIComponent(`Olá ${ag.clienteNome}! Confirmando seu horário com ${profissionalData?.nome} às ${ag.horario}.`);
    window.open(`https://wa.me/${numFinal}?text=${msg}`, '_blank');
  };

  // Derive stats
  const hojeStr = new Date().toLocaleDateString('en-CA');
  
  const agendamentosHoje = useMemo(() => {
    return agendamentos.filter(ag => ag.data === hojeStr && (ag.status === 'pendente' || ag.status === 'confirmado' || !ag.status));
  }, [agendamentos, hojeStr]);

  const receitaMes = useMemo(() => {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    return agendamentos
      .filter(ag => ag.status === 'concluido' && ag.data && ag.data.startsWith(mesAtual))
      .reduce((acc, curr) => acc + (Number(curr.preco) || 0), 0);
  }, [agendamentos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] flex flex-col items-center justify-center text-slate-950">
        <div className="h-10 w-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Carregando painel...</p>
      </div>
    );
  }

  if (!profissionalData) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] p-4 text-slate-950 font-sans grid place-items-center">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_25px_80px_rgba(15,23,42,0.10)]">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-red-50 text-red-500 ring-8 ring-red-50/70">
            <ShieldAlert size={38} />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Acesso não autorizado</h1>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-500">
            Seu e-mail <strong>{user?.email}</strong> não está vinculado a nenhum profissional da loja <strong>{dadosLoja?.nomeLoja || 'AgendaLink'}</strong>.
          </p>
          <p className="mt-2 text-xs text-slate-400">Solicite ao administrador da loja que vincule seu e-mail no painel administrativo.</p>
          <button onClick={onSair} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-red-500 active:scale-95">
            <LogOut size={15} /> Sair da conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-950 font-sans p-4 sm:p-6 lg:p-8">
      <Toaster position="top-center" />
      
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-200">
              {profissionalData.fotoUrl ? (
                <img src={profissionalData.fotoUrl} alt={profissionalData.nome} className="h-full w-full object-cover" />
              ) : (
                <User className="m-auto h-full text-slate-400" />
              )}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Painel Profissional · {dadosLoja?.nomeLoja}</p>
              <h1 className="text-2xl font-black text-slate-950">{profissionalData.nome}</h1>
            </div>
          </div>
          <button onClick={onSair} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-red-500 active:scale-95 sm:w-auto">
            <LogOut size={16} /> Sair
          </button>
        </header>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <Calendar size={18} className="text-indigo-600" />
            <p className="mt-4 text-3xl font-black text-slate-950">{agendamentosHoje.length}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-widest text-slate-400">Agendamentos hoje</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <DollarSign size={18} className="text-emerald-600" />
            <p className="mt-4 text-3xl font-black text-emerald-600">{formatarMoeda(receitaMes)}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-widest text-slate-400">Minha comissão / Receita (Mês)</p>
          </div>
        </div>

        {/* Agenda */}
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Fila de atendimento</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Meus horários de hoje</h2>
          </div>

          {agendamentosHoje.length === 0 ? (
            <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <div>
                <Calendar className="mx-auto mb-4 text-slate-300" size={38} />
                <h3 className="text-lg font-black text-slate-900">Sem horários agendados</h3>
                <p className="mt-2 max-w-sm text-sm font-medium text-slate-500">Você não tem agendamentos pendentes ou confirmados para hoje.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {agendamentosHoje.map((ag) => (
                <div key={ag.id} className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white shadow-sm">
                      <span className="text-sm font-black text-slate-950">{ag.horario || '--:--'}</span>
                      {ag.status === 'confirmado' && <span className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-500">Conf</span>}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-950">{ag.clienteNome || 'Cliente'}</h3>
                      <p className="mt-1 text-sm font-bold text-slate-500">{ag.servicoNome || 'Serviço'} · R$ {Number(ag.preco || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 sm:flex">
                    <button title="Enviar lembrete" onClick={() => enviarLembrete(ag)} className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 transition-all hover:bg-indigo-100 active:scale-95">
                      <MessageSquare size={19} />
                    </button>
                    {ag.status !== 'confirmado' && (
                      <button title="Confirmar" onClick={() => mudarStatusAgendamento(ag, 'confirmado')} className="rounded-2xl bg-blue-50 p-3 text-blue-500 transition-all hover:bg-blue-100 active:scale-95">
                        <CheckCircle size={19} />
                      </button>
                    )}
                    <button title="Concluir" onClick={() => mudarStatusAgendamento(ag, 'concluido')} className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 transition-all hover:bg-emerald-100 active:scale-95">
                      <CheckCircle size={19} />
                    </button>
                    <button title="Cancelar" onClick={() => mudarStatusAgendamento(ag, 'cancelado')} className="rounded-2xl bg-red-50 p-3 text-red-500 transition-all hover:bg-red-100 active:scale-95">
                      <XCircle size={19} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Instalar App */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">📲 Aplicativo</p>
          <p className="text-sm font-bold text-slate-600">Instale o app no seu celular para acessar rapidamente e receber notificações.</p>
          <InstallAppButton />
        </div>

        {/* Info footer */}
        <p className="text-center text-xs text-slate-400">
          Painel restrito a profissionais. Dúvidas ou alterações cadastrais, fale com o proprietário do estabelecimento.
        </p>

      </div>
    </div>
  );
};

export default PainelProfissional;
