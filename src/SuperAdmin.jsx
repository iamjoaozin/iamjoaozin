import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  FileText,
  Link2,
  LockKeyhole,
  LogOut,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { isSuperAdmin } from './admins';
import { CONFIG_SISTEMA_PADRAO, formatarMoeda, sanitizarConfigSistema } from './configSistema';
import { db } from './firebase';

const calcularExpiracao = (dias = 30) => {
  const hoje = new Date();
  const dataFechamento = new Date(hoje.getTime() + (Number(dias || 30) * 24 * 60 * 60 * 1000));
  return dataFechamento.toISOString();
};

const limpar = (valor) => String(valor || '').trim();

const formatarWhatsApp = (valor) => {
  const n = String(valor || '').replace(/\D/g, '');
  if (!n) return 'Não informado';
  if (n.length <= 2) return `(${n}`;
  if (n.length <= 6) return `(${n.substring(0, 2)}) ${n.substring(2)}`;
  if (n.length <= 10) return `(${n.substring(0, 2)}) ${n.substring(2, 6)}-${n.substring(6)}`;
  return `(${n.substring(0, 2)}) ${n.substring(2, 7)}-${n.substring(7, 11)}`;
};

const formatarData = (valor) => {
  if (!valor) return 'Sem data';
  const data = typeof valor.toDate === 'function' ? valor.toDate() : new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Sem data';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const SuperAdmin = ({ user, onSair }) => {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [uidDireto, setUidDireto] = useState('');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [processandoId, setProcessandoId] = useState('');
  const [confirmacao, setConfirmacao] = useState(null);
  const [configSistema, setConfigSistema] = useState(CONFIG_SISTEMA_PADRAO);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const isMaster = isSuperAdmin(user);
  const dominioBase = typeof window !== 'undefined' ? window.location.origin : 'https://agendalink.com';

  useEffect(() => {
    if (!isMaster) return undefined;

    const unsub = onSnapshot(
      doc(db, 'configuracoes', 'sistema'),
      (snap) => {
        setConfigSistema(sanitizarConfigSistema(snap.exists() ? snap.data() : CONFIG_SISTEMA_PADRAO));
      },
      (error) => {
        console.error(error);
        toast.error('Nao foi possivel carregar configuracoes.');
      }
    );

    return () => unsub();
  }, [isMaster]);

  useEffect(() => {
    if (!isMaster) {
      setCarregando(false);
      return undefined;
    }

    const q = query(collection(db, 'usuarios_barbeiros'), where('status', '==', 'pendente'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const dataA = a.dataSolicitacao?.toMillis?.() || 0;
            const dataB = b.dataSolicitacao?.toMillis?.() || 0;
            return dataB - dataA;
          });
        setSolicitacoes(lista);
        setCarregando(false);
      },
      (error) => {
        console.error(error);
        toast.error('Não foi possível carregar solicitações.');
        setCarregando(false);
      }
    );

    return () => unsub();
  }, [isMaster]);

  const solicitacoesFiltradas = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return solicitacoes;

    return solicitacoes.filter((sol) => {
      const campos = [
        sol.id,
        sol.nomeDono,
        sol.nomeLoja,
        sol.nomeEmpresa,
        sol.tipoNegocio,
        sol.whatsapp,
        sol.documento,
        sol.slug,
      ];
      return campos.some((campo) => String(campo || '').toLowerCase().includes(termo));
    });
  }, [busca, solicitacoes]);

  const metricas = useMemo(() => {
    const comDocumento = solicitacoes.filter((sol) => limpar(sol.documento).length >= 11).length;
    const comWhatsApp = solicitacoes.filter((sol) => String(sol.whatsapp || '').replace(/\D/g, '').length >= 10).length;
    const tipos = solicitacoes.reduce((acc, sol) => {
      const tipo = sol.tipoNegocio || 'Outro';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {});
    const tipoMaisComum = Object.entries(tipos).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sem fila';

    return {
      pendentes: solicitacoes.length,
      comDocumento,
      comWhatsApp,
      tipoMaisComum,
    };
  }, [solicitacoes]);

  const abrirWhatsApp = (sol) => {
    const numero = String(sol.whatsapp || '').replace(/\D/g, '');
    if (!numero) return toast.error('Essa solicitação não tem WhatsApp.');
    const final = numero.startsWith('55') ? numero : `55${numero}`;
    const msg = encodeURIComponent(`Olá, ${sol.nomeDono || 'tudo bem'}! Seu cadastro na AgendaLink está em análise.`);
    window.open(`https://wa.me/${final}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  const copiar = async (texto, mensagem = 'Copiado!') => {
    await navigator.clipboard.writeText(texto);
    toast.success(mensagem);
  };

  const atualizarConfig = (campo, valor) => {
    setConfigSistema((atual) => sanitizarConfigSistema({ ...atual, [campo]: valor }));
  };

  const atualizarPlano = (campo, valor) => {
    setConfigSistema((atual) => {
      const plano = {
        ...atual.plano,
        [campo]: campo === 'nome' || campo === 'destaque' ? valor : Number(valor),
      };

      return sanitizarConfigSistema({ ...atual, plano });
    });
  };

  const salvarConfigSistema = async () => {
    if (!isMaster) return toast.error('Acesso negado.');

    setSalvandoConfig(true);
    try {
      const payload = {
        ...sanitizarConfigSistema(configSistema),
        atualizadoEm: serverTimestamp(),
        atualizadoPor: user.uid,
        atualizadoPorEmail: user.email,
      };

      await setDoc(doc(db, 'configuracoes', 'sistema'), payload, { merge: true });
      toast.success('Configuracoes comerciais salvas.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar configuracoes.');
    } finally {
      setSalvandoConfig(false);
    }
  };

  const prepararAtivacaoDireta = async () => {
    if (!isMaster) return toast.error('Acesso negado.');

    const uid = uidDireto.trim();
    if (uid.length < 10) return toast.error('Cole um UID válido.');

    setProcessandoId('uid-direto');
    try {
      const empresaRef = doc(db, 'empresas', uid);
      const empresaSnap = await getDoc(empresaRef);

      if (!empresaSnap.exists()) {
        toast.error('Empresa não encontrada para esse UID.');
        return;
      }

      setConfirmacao({
        tipo: 'uid',
        id: uid,
        dados: {
          id: uid,
          ...empresaSnap.data(),
        },
      });
    } catch (e) {
      console.error(e);
      toast.error('Erro ao validar UID.');
    } finally {
      setProcessandoId('');
    }
  };

  const abrirConfirmacao = (sol) => {
    if (!isMaster) return toast.error('Acesso negado.');
    setConfirmacao({ tipo: 'solicitacao', id: sol.id, dados: sol });
  };

  const confirmarAprovacao = async () => {
    if (!isMaster || !confirmacao?.id) return toast.error('Acesso negado.');

    const dados = confirmacao.dados || {};
    const idUsuario = confirmacao.id;
    const nomeEmpresa = limpar(dados.nomeLoja || dados.nomeEmpresa) || 'Nova agenda';

    setProcessandoId(idUsuario);
    try {
      const batch = writeBatch(db);
      const diasTeste = Number(configSistema.diasTesteGratis || CONFIG_SISTEMA_PADRAO.diasTesteGratis);
      const expiraEm = calcularExpiracao(diasTeste);
      const auditoria = {
        status: 'ativo',
        planoAtivo: false,
        expiraEm,
        expiraEmData: new Date(expiraEm),
        testeGratisDias: diasTeste,
        planoOrigem: 'teste-gratis',
        dataAprovacao: serverTimestamp(),
        aprovadoPor: user.uid,
        aprovadoPorEmail: user.email,
        ultimaAlteracao: serverTimestamp(),
      };

      batch.set(doc(db, 'empresas', idUsuario), {
        uid: idUsuario,
        donoUid: idUsuario,
        nomeDono: limpar(dados.nomeDono) || 'Não informado',
        documento: limpar(dados.documento),
        nomeLoja: nomeEmpresa,
        nomeEmpresa,
        tipoNegocio: dados.tipoNegocio || 'Outro',
        slug: limpar(dados.slug),
        whatsapp: String(dados.whatsapp || '').replace(/\D/g, ''),
        tamanhoOperacao: dados.tamanhoOperacao || '',
        objetivoPrincipal: dados.objetivoPrincipal || '',
        ...auditoria,
      }, { merge: true });

      batch.set(doc(db, 'usuarios_barbeiros', idUsuario), {
        lojaId: dados.lojaId || idUsuario,
        slug: limpar(dados.slug),
        nomeDono: limpar(dados.nomeDono) || 'Não informado',
        nomeLoja: nomeEmpresa,
        nomeEmpresa,
        tipoNegocio: dados.tipoNegocio || 'Outro',
        ...auditoria,
      }, { merge: true });

      await batch.commit();

      toast.success(`${nomeEmpresa} liberado com ${diasTeste} dias gratis.`);
      setUidDireto('');
      setConfirmacao(null);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao ativar empresa.');
    } finally {
      setProcessandoId('');
    }
  };

  if (!isMaster) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] grid place-items-center p-6 text-slate-950">
        <Toaster position="top-center" />
        <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[24px] bg-red-50 text-red-500">
            <LockKeyhole size={30} />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-red-500">Acesso restrito</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Painel master bloqueado.</h1>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-500">Entre com a conta administradora para aprovar empresas.</p>
          <button onClick={onSair} className="mt-6 rounded-2xl bg-slate-950 px-5 py-4 text-xs font-black uppercase tracking-widest text-white active:scale-95">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-950 font-sans">
      <Toaster position="top-center" />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)] lg:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-950 text-white shadow-xl shadow-slate-200">
                <ShieldCheck size={26} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">AgendaLink</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Painel master</h1>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-emerald-700">
                <LockKeyhole size={15} />
                {user.email}
              </div>
              <button onClick={onSair} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:text-red-500 active:scale-95">
                <LogOut size={15} />
                Sair
              </button>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          {[
            ['Pendentes', metricas.pendentes, Clock3],
            ['Com documento', metricas.comDocumento, FileText],
            ['Com WhatsApp', metricas.comWhatsApp, Phone],
            ['Mais comum', metricas.tipoMaisComum, Building2],
          ].map(([label, value, Icon]) => (
            <div key={label} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
              <Icon size={18} className="text-indigo-600" />
              <p className="mt-4 truncate text-2xl font-black text-slate-950">{value}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
            </div>
          ))}
        </section>

        <section className="mb-6 rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)] lg:p-6">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Configuracoes comerciais</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Teste gratis e plano unico</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Esses valores aparecem para empresas com acesso expirado e sao usados no PIX.</p>
            </div>
            <button
              onClick={salvarConfigSistema}
              disabled={salvandoConfig}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95 disabled:cursor-wait disabled:opacity-60"
            >
              <ShieldCheck size={16} />
              {salvandoConfig ? 'Salvando...' : 'Salvar config'}
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="rounded-[28px] border border-indigo-100 bg-indigo-50 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Liberacao inicial</p>
              <label className="mt-5 block text-xs font-black uppercase tracking-widest text-slate-500">Dias de teste gratis</label>
              <input
                type="number"
                min="0"
                max="365"
                value={configSistema.diasTesteGratis}
                onChange={(e) => atualizarConfig('diasTesteGratis', e.target.value)}
                className="mt-2 w-full rounded-2xl border border-indigo-100 bg-white px-4 py-4 text-3xl font-black text-slate-950 outline-none transition-all focus:border-indigo-500"
              />
              <p className="mt-3 text-xs font-bold leading-5 text-indigo-700">Toda empresa aprovada recebe esse tempo antes de precisar pagar.</p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Plano unico</p>
                  <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{formatarMoeda(configSistema.plano.valor)}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{configSistema.plano.dias} dias de acesso apos pagamento</p>
                </div>
                <span className="rounded-full bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 ring-1 ring-indigo-100">
                  PIX automatico
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do plano</label>
                  <input
                    value={configSistema.plano.nome}
                    onChange={(e) => atualizarPlano('nome', e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Preco R$</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={configSistema.plano.valor}
                    onChange={(e) => atualizarPlano('valor', e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Dias pagos</label>
                  <input
                    type="number"
                    min="1"
                    value={configSistema.plano.dias}
                    onChange={(e) => atualizarPlano('dias', e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <label className="mt-3 block text-[10px] font-black uppercase tracking-widest text-slate-400">Texto curto do plano</label>
              <input
                value={configSistema.plano.destaque}
                onChange={(e) => atualizarPlano('destaque', e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-5 lg:grid-cols-[1fr_420px]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Search size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Busca rápida</p>
                <h2 className="text-xl font-black tracking-tight text-slate-950">Encontre uma solicitação</h2>
              </div>
            </div>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por empresa, dono, UID, documento ou WhatsApp"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-indigo-500"
            />
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Zap size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Ativação direta</p>
                <h2 className="text-xl font-black tracking-tight text-slate-950">Liberar por UID</h2>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={uidDireto}
                onChange={(e) => setUidDireto(e.target.value)}
                placeholder="Cole o UID recebido"
                className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-mono text-sm font-bold text-slate-900 outline-none transition-all focus:border-amber-500"
              />
              <button
                onClick={prepararAtivacaoDireta}
                disabled={processandoId === 'uid-direto'}
                className="rounded-2xl bg-slate-950 px-5 py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-amber-600 active:scale-95 disabled:cursor-wait disabled:opacity-60"
              >
                {processandoId === 'uid-direto' ? 'Validando...' : 'Validar'}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)] lg:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Fila de aprovação</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Solicitações pendentes</h2>
            </div>
            <p className="text-xs font-bold text-slate-400">{solicitacoesFiltradas.length} exibidas</p>
          </div>

          {carregando ? (
            <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50">
              <div className="text-center">
                <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Carregando fila</p>
              </div>
            </div>
          ) : solicitacoesFiltradas.length === 0 ? (
            <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <div>
                <ClipboardCheck className="mx-auto mb-4 text-slate-300" size={42} />
                <h3 className="text-lg font-black text-slate-900">Nenhuma solicitação pendente</h3>
                <p className="mt-2 text-sm font-medium text-slate-500">Quando alguém se cadastrar, aparece aqui para aprovação.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {solicitacoesFiltradas.map((sol) => {
                const nomeLoja = sol.nomeLoja || sol.nomeEmpresa || 'Nova agenda';
                const linkPublico = `${dominioBase}/${sol.slug || sol.lojaId || sol.id}`;
                const documentoOk = limpar(sol.documento).length >= 11;
                const whatsappOk = String(sol.whatsapp || '').replace(/\D/g, '').length >= 10;

                return (
                  <motion.article
                    key={sol.id}
                    layout
                    className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 transition-all hover:border-indigo-100 hover:bg-white hover:shadow-[0_18px_50px_rgba(15,23,42,0.07)] sm:p-5"
                  >
                    <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 ring-1 ring-indigo-100">
                            {sol.tipoNegocio || 'Novo negócio'}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 ring-1 ring-slate-200">
                            {formatarData(sol.dataSolicitacao)}
                          </span>
                          {documentoOk && whatsappOk && (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-100">
                              Dados ok
                            </span>
                          )}
                        </div>

                        <h3 className="truncate text-2xl font-black tracking-tight text-slate-950">{nomeLoja}</h3>
                        <p className="mt-1 text-sm font-bold text-slate-500">Responsável: {sol.nomeDono || 'Não informado'}</p>

                        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <InfoPill icon={FileText} label="Documento" value={sol.documento || 'Não informado'} ok={documentoOk} />
                          <InfoPill icon={Phone} label="WhatsApp" value={formatarWhatsApp(sol.whatsapp)} ok={whatsappOk} />
                          <InfoPill icon={Link2} label="Link" value={linkPublico.replace(/^https?:\/\//, '')} />
                          <InfoPill icon={UserRound} label="UID" value={sol.id} mono />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-4 lg:w-52 lg:grid-cols-1">
                        <button onClick={() => abrirConfirmacao(sol)} disabled={processandoId === sol.id} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95 disabled:cursor-wait disabled:opacity-60">
                          <BadgeCheck size={16} />
                          Aprovar
                        </button>
                        <button onClick={() => abrirWhatsApp(sol)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:text-emerald-600 active:scale-95">
                          <Phone size={16} />
                          WhatsApp
                        </button>
                        <button onClick={() => copiar(sol.id, 'UID copiado.')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:text-indigo-600 active:scale-95">
                          <Copy size={16} />
                          UID
                        </button>
                        <button onClick={() => copiar(linkPublico, 'Link copiado.')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:text-indigo-600 active:scale-95">
                          <Link2 size={16} />
                          Link
                        </button>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <AnimatePresence>
        {confirmacao && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }} className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.24)]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Confirmar liberação</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{confirmacao.dados?.nomeLoja || confirmacao.dados?.nomeEmpresa || 'Nova agenda'}</h2>
                </div>
                <button onClick={() => setConfirmacao(null)} className="rounded-2xl bg-slate-50 p-3 text-slate-400 hover:text-red-500">
                  <X size={18} />
                </button>
              </div>

              <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <AlertTriangle size={20} className="shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-black text-amber-950">Aprovacao com {configSistema.diasTesteGratis} dias gratis</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-amber-700">Essa acao ativa o painel, registra auditoria e libera o teste da empresa.</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 rounded-3xl bg-slate-50 p-4">
                <InfoLine label="Responsável" value={confirmacao.dados?.nomeDono || 'Não informado'} />
                <InfoLine label="WhatsApp" value={formatarWhatsApp(confirmacao.dados?.whatsapp)} />
                <InfoLine label="Documento" value={confirmacao.dados?.documento || 'Não informado'} />
                <InfoLine label="UID" value={confirmacao.id} mono />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button onClick={() => setConfirmacao(null)} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-600 active:scale-95">
                  Cancelar
                </button>
                <button onClick={confirmarAprovacao} disabled={processandoId === confirmacao.id} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95 disabled:cursor-wait disabled:opacity-60">
                  <CheckCircle2 size={17} />
                  {processandoId === confirmacao.id ? 'Aprovando...' : 'Aprovar acesso'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InfoPill = ({ icon: Icon, label, value, ok, mono }) => (
  <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <Icon size={13} />
        {label}
      </span>
      {typeof ok === 'boolean' && (
        <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      )}
    </div>
    <p className={`truncate text-xs font-black text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
  </div>
);

const InfoLine = ({ label, value, mono }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
    <span className={`truncate text-right text-sm font-black text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
  </div>
);

export default SuperAdmin;
