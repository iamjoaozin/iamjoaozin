import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Link2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound
} from 'lucide-react';
import { db } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast, Toaster } from 'react-hot-toast';

const tiposNegocio = [
  'Clínica',
  'Hospital',
  'Barbearia',
  'Estética',
  'Consultório',
  'Outro',
];

const tamanhosOperacao = [
  { id: 'solo', label: 'Agenda simples', desc: 'Uma pessoa ou uma agenda principal.' },
  { id: 'equipe', label: 'Equipe', desc: 'Vários profissionais ou atendimentos.' },
  { id: 'unidade', label: 'Operação maior', desc: 'Setores, salas ou múltiplas agendas.' },
];

const objetivos = [
  'Receber agendamentos pelo link',
  'Organizar horários e dias de atendimento',
  'Controlar equipe e agenda',
  'Cobrar ou sinalizar pagamentos',
];

const limparNumero = (valor) => valor.replace(/\D/g, '');

const gerarSlug = (valor) =>
  valor
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const CadastroBarbeiro = ({ user, onFinalizar }) => {
  const [etapa, setEtapa] = useState(1);
  const [tipoNegocio, setTipoNegocio] = useState('Clínica');
  const [nomeResponsavel, setNomeResponsavel] = useState(user?.displayName || '');
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [documento, setDocumento] = useState('');
  const [slug, setSlug] = useState('');
  const [tamanhoOperacao, setTamanhoOperacao] = useState('solo');
  const [objetivoPrincipal, setObjetivoPrincipal] = useState(objetivos[0]);
  const [carregando, setCarregando] = useState(false);
  const [slugFinal, setSlugFinal] = useState('');

  const SEU_WHATSAPP_ADMIN = '5587991695672';
  const DOMINIO_BASE = 'agendalink.com';

  const progresso = useMemo(() => (etapa === 1 ? 50 : 100), [etapa]);

  const atualizarNomeEmpresa = (valor) => {
    setNomeEmpresa(valor);
    if (!slug) setSlug(gerarSlug(valor));
  };

  const validarPrimeiraEtapa = () => {
    if (!nomeResponsavel.trim()) return toast.error('Informe o nome do responsável.');
    if (!nomeEmpresa.trim()) return toast.error('Informe o nome da empresa ou agenda.');
    if (limparNumero(whatsapp).length < 10) return toast.error('Informe um WhatsApp válido.');
    return true;
  };

  const finalizarCadastro = async () => {
    if (!validarPrimeiraEtapa()) {
      setEtapa(1);
      return;
    }

    const documentoLimpo = limparNumero(documento);
    if (documentoLimpo.length > 0 && documentoLimpo.length < 11) {
      return toast.error('Confira o documento informado.');
    }

    const slugLimpo = gerarSlug(slug || nomeEmpresa);
    if (!slugLimpo) return toast.error('Escolha um link válido para sua agenda.');

    setCarregando(true);

    try {
      const payloadComum = {
        uid: user.uid,
        nomeDono: nomeResponsavel.trim(),
        nomeLoja: nomeEmpresa.trim(),
        nomeEmpresa: nomeEmpresa.trim(),
        tipoNegocio,
        documento: documentoLimpo,
        whatsapp: limparNumero(whatsapp),
        slug: slugLimpo,
        tamanhoOperacao,
        objetivoPrincipal,
        status: 'pendente',
      };

      await setDoc(doc(db, 'empresas', user.uid), {
        ...payloadComum,
        email: user.email,
        planoAtivo: false,
        corPrincipal: '#4f46e5',
        criadoEm: serverTimestamp(),
      });

      await setDoc(doc(db, 'usuarios_barbeiros', user.uid), {
        lojaId: user.uid,
        ...payloadComum,
        dataSolicitacao: serverTimestamp(),
      });

      setSlugFinal(slugLimpo);
      setEtapa(3);
      toast.success('Cadastro enviado para análise.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar cadastro.');
    } finally {
      setCarregando(false);
    }
  };

  const abrirWhatsAppParaAtivar = () => {
    const msg = encodeURIComponent(
      `Olá! Quero solicitar a aprovação da minha agenda.\n\n` +
      `Empresa: ${nomeEmpresa}\n` +
      `Responsável: ${nomeResponsavel}\n` +
      `Tipo: ${tipoNegocio}\n` +
      `WhatsApp: ${whatsapp}\n` +
      `Link desejado: ${DOMINIO_BASE}/${slugFinal || gerarSlug(slug || nomeEmpresa)}\n` +
      `ID: ${user.uid}`
    );
    window.open(`https://wa.me/${SEU_WHATSAPP_ADMIN}?text=${msg}`, '_blank');
  };

  const voltarInicio = () => {
    if (onFinalizar) onFinalizar();
    else window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] px-4 py-6 text-slate-950 font-sans sm:px-6">
      <Toaster position="top-center" />

      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-xl shadow-slate-300">
              <Sparkles size={21} />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight">AgendaLink</p>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Cadastro premium</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-500 shadow-sm sm:flex">
            <ShieldCheck size={15} className="text-emerald-500" />
            Aprovação manual
          </div>
        </header>

        <main className="grid flex-1 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <aside className="rounded-[32px] bg-slate-950 p-8 text-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
            <div className="flex h-full flex-col justify-between gap-10">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-100">
                  <Building2 size={14} />
                  Nova agenda
                </div>
                <div className="space-y-4">
                  <h1 className="max-w-md text-4xl font-black tracking-tight sm:text-5xl">Vamos deixar seu link pronto.</h1>
                  <p className="max-w-md text-sm font-medium leading-7 text-slate-300">
                    Responda o básico agora. Depois da aprovação, você configura horários, serviços, dias de atendimento e sua página pública.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${progresso}%` }} />
                </div>
                <div className="grid gap-3 text-sm">
                  {[
                    ['Dados do negócio', etapa >= 1],
                    ['Operação e objetivo', etapa >= 2],
                    ['Aprovação manual', etapa === 3],
                  ].map(([label, ativo]) => (
                    <div key={label} className={`flex items-center gap-3 rounded-2xl p-3 ${ativo ? 'bg-white/10 text-white' : 'text-slate-500'}`}>
                      <CheckCircle2 size={17} className={ativo ? 'text-emerald-300' : 'text-slate-600'} />
                      <span className="font-bold">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_25px_70px_rgba(15,23,42,0.08)] sm:p-8">
            <AnimatePresence mode="wait">
              {etapa === 1 && (
                <motion.div
                  key="etapa-1"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  className="space-y-7"
                >
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Etapa 1 de 2</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight">Dados principais</h2>
                    <p className="mt-2 text-sm font-medium text-slate-500">Essas informações aparecem para aprovação e ajudam a criar o link certo.</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 sm:col-span-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">Tipo de negócio</span>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {tiposNegocio.map((tipo) => (
                          <button
                            key={tipo}
                            type="button"
                            onClick={() => setTipoNegocio(tipo)}
                            className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition-all ${tipoNegocio === tipo ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                          >
                            {tipo}
                          </button>
                        ))}
                      </div>
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">Responsável</span>
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-indigo-500">
                        <UserRound size={18} className="text-slate-400" />
                        <input
                          value={nomeResponsavel}
                          onChange={(e) => setNomeResponsavel(e.target.value)}
                          className="w-full bg-transparent text-sm font-bold outline-none"
                          placeholder="Seu nome"
                        />
                      </div>
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">WhatsApp</span>
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-indigo-500">
                        <MessageCircle size={18} className="text-slate-400" />
                        <input
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                          className="w-full bg-transparent text-sm font-bold outline-none"
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </label>

                    <label className="space-y-2 sm:col-span-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">Nome da empresa ou agenda</span>
                      <input
                        value={nomeEmpresa}
                        onChange={(e) => atualizarNomeEmpresa(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none transition-all focus:border-indigo-500"
                        placeholder="Ex: Clínica Vida, Barbearia João, Hospital São Lucas"
                      />
                    </label>

                    <label className="space-y-2 sm:col-span-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">Link público desejado</span>
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-indigo-500">
                        <Link2 size={18} className="text-slate-400" />
                        <span className="hidden text-sm font-black text-slate-400 sm:block">{DOMINIO_BASE}/</span>
                        <input
                          value={slug}
                          onChange={(e) => setSlug(gerarSlug(e.target.value))}
                          className="w-full bg-transparent text-sm font-bold outline-none"
                          placeholder="minha-agenda"
                        />
                      </div>
                    </label>
                  </div>

                  <button
                    onClick={() => validarPrimeiraEtapa() && setEtapa(2)}
                    className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-slate-200 transition-all hover:bg-indigo-600 active:scale-95"
                  >
                    Continuar
                    <ArrowRight size={18} />
                  </button>
                </motion.div>
              )}

              {etapa === 2 && (
                <motion.div
                  key="etapa-2"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  className="space-y-7"
                >
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Etapa 2 de 2</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight">Como sua agenda vai operar?</h2>
                    <p className="mt-2 text-sm font-medium text-slate-500">Isso ajuda a liberar o painel certo para o seu tipo de negócio.</p>
                  </div>

                  <div className="space-y-5">
                    <div className="grid gap-3">
                      {tamanhosOperacao.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setTamanhoOperacao(item.id)}
                          className={`rounded-2xl border p-4 text-left transition-all ${tamanhoOperacao === item.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                        >
                          <p className="text-sm font-black text-slate-950">{item.label}</p>
                          <p className="mt-1 text-xs font-medium text-slate-500">{item.desc}</p>
                        </button>
                      ))}
                    </div>

                    <label className="space-y-2 block">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">Principal objetivo</span>
                      <select
                        value={objetivoPrincipal}
                        onChange={(e) => setObjetivoPrincipal(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none transition-all focus:border-indigo-500"
                      >
                        {objetivos.map((objetivo) => (
                          <option key={objetivo} value={objetivo}>{objetivo}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 block">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">Documento para aprovação</span>
                      <input
                        value={documento}
                        onChange={(e) => setDocumento(limparNumero(e.target.value))}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none transition-all focus:border-indigo-500"
                        placeholder="CPF ou CNPJ, se quiser informar agora"
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => setEtapa(1)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:border-slate-300 active:scale-95 sm:w-auto"
                    >
                      <ArrowLeft size={17} />
                      Voltar
                    </button>
                    <button
                      onClick={finalizarCadastro}
                      disabled={carregando}
                      className="inline-flex flex-1 items-center justify-center gap-3 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-slate-200 transition-all hover:bg-indigo-600 active:scale-95 disabled:cursor-wait disabled:opacity-70"
                    >
                      {carregando ? 'Enviando...' : 'Enviar para aprovação'}
                      <ShieldCheck size={18} />
                    </button>
                  </div>
                </motion.div>
              )}

              {etapa === 3 && (
                <motion.div
                  key="etapa-3"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex min-h-[560px] flex-col items-center justify-center text-center"
                >
                  <div className="mb-7 flex h-20 w-20 items-center justify-center rounded-[28px] bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
                    <CheckCircle2 size={40} />
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Cadastro recebido</p>
                  <h2 className="mt-3 max-w-md text-4xl font-black tracking-tight">Agora é só aguardar a aprovação.</h2>
                  <p className="mt-4 max-w-md text-sm font-medium leading-7 text-slate-500">
                    Seu acesso ao painel fica bloqueado até a validação manual. Assim que aprovado, você entra direto no admin e configura sua agenda.
                  </p>

                  <div className="mt-8 w-full max-w-md rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Link reservado</p>
                    <p className="mt-2 truncate text-sm font-black text-slate-900">{DOMINIO_BASE}/{slugFinal}</p>
                  </div>

                  <div className="mt-6 grid w-full max-w-md gap-3 sm:grid-cols-2">
                    <button
                      onClick={abrirWhatsAppParaAtivar}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-950 transition-all active:scale-95"
                    >
                      <MessageCircle size={18} />
                      Chamar suporte
                    </button>
                    <button
                      onClick={voltarInicio}
                      className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-600 transition-all active:scale-95"
                    >
                      Voltar ao início
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </main>
      </div>
    </div>
  );
};

export default CadastroBarbeiro;
