import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  LayoutDashboard,
  Link2,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { entrarComGoogle } from './firebase';
import { toast } from 'react-hot-toast';

const LoginCliente = ({ aoLogar }) => {
  const [carregando, setCarregando] = useState(false);

  const handleGoogle = async () => {
    if (carregando) return;
    setCarregando(true);

    try {
      const usuario = await entrarComGoogle();
      if (usuario) aoLogar(usuario);
    } catch (error) {
      console.error('Falha no login:', error);
      if (error?.code === 'auth/unauthorized-domain') {
        toast.error('Domínio não autorizado no Firebase. Adicione localhost e 127.0.0.1 em Authentication > Settings.');
      } else if (error?.code === 'auth/popup-closed-by-user') {
        toast.error('Login cancelado antes de concluir.');
      } else if (error?.code === 'auth/popup-blocked') {
        toast.error('Popup bloqueado pelo navegador. Libere popups para este site.');
      } else {
        toast.error('Não deu para entrar com Google agora. Tente novamente.');
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-950 font-sans overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_34%),radial-gradient(circle_at_top_right,#ede9fe,transparent_30%)]" />

      <main className="relative min-h-screen grid lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-16">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-slate-950 text-white flex items-center justify-center shadow-xl shadow-slate-300">
                <CalendarCheck2 size={22} />
              </div>
              <div>
                <p className="text-lg font-black tracking-tight">AgendaLink</p>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Premium booking</p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
              <ShieldCheck size={14} className="text-emerald-500" />
              Login seguro
            </div>
          </nav>

          <div className="max-w-2xl py-14 lg:py-20">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-widest text-indigo-600 shadow-sm">
                <Sparkles size={14} />
                Sua agenda em um link
              </div>

              <div className="space-y-5">
                <h1 className="max-w-xl text-5xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
                  Agendamentos simples para negócios sérios.
                </h1>
                <p className="max-w-xl text-base font-medium leading-8 text-slate-500 sm:text-lg">
                  Crie um link profissional para seus clientes agendarem, enquanto você controla horários, serviços, aprovações e pagamentos em um painel fácil de usar.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleGoogle}
                  disabled={carregando}
                  className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-2xl shadow-slate-300 transition-all hover:-translate-y-0.5 hover:bg-indigo-600 active:scale-95 disabled:cursor-wait disabled:opacity-70"
                >
                  {carregando ? 'Entrando...' : 'Entrar no painel'}
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </button>

                <button
                  onClick={handleGoogle}
                  disabled={carregando}
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black uppercase tracking-widest text-slate-700 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-600 active:scale-95 disabled:cursor-wait disabled:opacity-70"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="" aria-hidden="true" />
                  Google
                </button>
              </div>

              <div className="grid max-w-xl gap-3 sm:grid-cols-3">
                {[
                  ['Link público', Link2],
                  ['Painel premium', LayoutDashboard],
                  ['Multiagenda', Building2],
                ].map(([label, Icon]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                    <Icon size={18} className="mb-3 text-indigo-600" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-600">{label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <p className="text-xs font-bold text-slate-400">Clientes finais acessam pelo link da empresa. Esta entrada é para donos e equipes.</p>
        </section>

        <section className="hidden items-center justify-center p-8 lg:flex">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.12)]"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Hoje</p>
                <h2 className="text-2xl font-black tracking-tight">Painel da agenda</h2>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-600">Online</div>
            </div>

            <div className="space-y-3">
              {[
                ['09:00', 'Consulta inicial', 'Confirmado'],
                ['10:30', 'Corte premium', 'Aguardando'],
                ['14:00', 'Retorno clínico', 'Confirmado'],
              ].map(([hora, titulo, status]) => (
                <div key={`${hora}-${titulo}`} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-900 shadow-sm">{hora}</div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-900">{titulo}</p>
                    <p className="text-xs font-bold text-slate-400">{status}</p>
                  </div>
                  <CheckCircle2 size={19} className={status === 'Confirmado' ? 'text-emerald-500' : 'text-amber-500'} />
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl bg-slate-950 p-5 text-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Link ativo</p>
              <div className="mt-3 flex items-center gap-3">
                <Link2 size={18} className="text-indigo-300" />
                <p className="truncate text-sm font-bold">agendalink.com/sua-agenda</p>
              </div>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
};

export default LoginCliente;
