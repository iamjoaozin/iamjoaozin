import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Gift,
  Image as ImageIcon,
  Link2,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Scissors,
  Sparkles,
  Star,
  Store,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';
import { calcularAcessoAgenda } from './acessoAgenda';
import { CONFIG_SISTEMA_PADRAO } from './configSistema';
import { db, entrarComGoogle } from './firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const horariosManha = [];
const horariosTarde = [];

for (let h = 8; h <= 19; h += 1) {
  for (let m = 0; m < 60; m += 30) {
    if (h === 12 || h === 13) continue;
    const hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (h < 12) horariosManha.push(hora);
    else horariosTarde.push(hora);
  }
}

const hojeLocal = () => {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
};

const formatarZap = (valor) => {
  let val = valor.replace(/\D/g, '');
  if (val.length > 11) val = val.substring(0, 11);
  if (val.length > 10) return `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7)}`;
  if (val.length > 6) return `(${val.substring(0, 2)}) ${val.substring(2, 6)}-${val.substring(6)}`;
  if (val.length > 2) return `(${val.substring(0, 2)}) ${val.substring(2)}`;
  return val;
};

const telefoneWhatsApp = (valor) => {
  const limpo = String(valor || '').replace(/\D/g, '');
  if (!limpo) return '';
  return limpo.startsWith('55') ? limpo : `55${limpo}`;
};

const idsDaLoja = (...valores) =>
  [...new Set(valores.map((valor) => String(valor || '').trim()).filter(Boolean))].slice(0, 10);

const Cliente = ({ user, onLogout }) => {
  const { lojaId } = useParams();
  const [dadosLoja, setDadosLoja] = useState(null);
  const [loading, setLoading] = useState(true);
  const [servicos, setServicos] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [fotosGaleria, setFotosGaleria] = useState([]);
  const [identificadoresLoja, setIdentificadoresLoja] = useState([]);
  const [agendamentosDoDia, setAgendamentosDoDia] = useState([]);
  const [meusAgendamentos, setMeusAgendamentos] = useState([]);
  const [etapa, setEtapa] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [servicoSel, setServicoSel] = useState(null);
  const [profissionalSel, setProfissionalSel] = useState(null);
  const [copiou, setCopiou] = useState(false);
  const [showIdentificacao, setShowIdentificacao] = useState(false);
  const [nomeCliente, setNomeCliente] = useState('');
  const [whatsappCliente, setWhatsappCliente] = useState('');
  const [pontosFidelidade, setPontosFidelidade] = useState(0);
  const [dataSel, setDataSel] = useState(hojeLocal());
  const [hora, setHora] = useState('');
  
  const [pacotes, setPacotes] = useState([]);
  const [avaliacoesLoja, setAvaliacoesLoja] = useState([]);
  const [modalAvaliacao, setModalAvaliacao] = useState(false);
  const [avAgendamentoSel, setAvAgendamentoSel] = useState(null);
  const [avNota, setAvNota] = useState(5);
  const [avComentario, setAvComentario] = useState('');
  const [subAba, setSubAba] = useState('catalogo'); // 'catalogo', 'galeria', 'info'
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [storyAtivo, setStoryAtivo] = useState(null); // 'cortes', 'ambiente', 'geral'
  const [storySlideIndex, setStorySlideIndex] = useState(0);
  const [storyProgresso, setStoryProgresso] = useState(0);

  const obterFotosDoStory = (tipo) => {
    if (tipo === 'cortes') {
      return fotosPortfolio.filter((_, idx) => idx % 2 === 0).slice(0, 4);
    }
    if (tipo === 'ambiente') {
      return fotosPortfolio.filter((_, idx) => idx % 2 !== 0).slice(0, 4);
    }
    return fotosPortfolio.slice(0, 5); // geral/novidades
  };

  useEffect(() => {
    if (!storyAtivo) return;

    const fotosStory = obterFotosDoStory(storyAtivo);
    if (fotosStory.length === 0) {
      setStoryAtivo(null);
      return;
    }

    setStoryProgresso(0);

    const interval = setInterval(() => {
      setStoryProgresso(prev => {
        if (prev >= 100) {
          setStorySlideIndex(prevIndex => {
            if (prevIndex + 1 < fotosStory.length) {
              return prevIndex + 1;
            } else {
              setStoryAtivo(null);
              return 0;
            }
          });
          return 0;
        }
        return prev + 2.5; // Aumenta 2.5% a cada 100ms (total de 4s)
      });
    }, 100);

    return () => clearInterval(interval);
  }, [storyAtivo, storySlideIndex]);

  const corApp = dadosLoja?.corPrincipal || '#4f46e5';

  const corAppDark = useMemo(() => {
    let hex = corApp;
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    const num = parseInt(hex.slice(1), 16);
    const amt = -25;
    let r = (num >> 16) + amt;
    let g = ((num >> 8) & 0x00ff) + amt;
    let b = (num & 0x0000ff) + amt;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }, [corApp]);

  const corAppRgb = useMemo(() => {
    let hex = corApp;
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    const num = parseInt(hex.slice(1), 16);
    const r = num >> 16;
    const g = (num >> 8) & 0x00ff;
    const b = num & 0x0000ff;
    return `${r}, ${g}, ${b}`;
  }, [corApp]);

  const totalAvaliacoes = avaliacoesLoja.length;
  const notaMediaLoja = useMemo(() => {
    if (totalAvaliacoes === 0) return '5.0';
    const soma = avaliacoesLoja.reduce((acc, curr) => acc + curr.nota, 0);
    return (soma / totalAvaliacoes).toFixed(1);
  }, [avaliacoesLoja, totalAvaliacoes]);

  const nomeAgenda = dadosLoja?.nomeLoja || dadosLoja?.nomeEmpresa || 'AgendaLink';
  const fotosPortfolio = fotosGaleria.filter((foto) => foto.tipo === 'portfolio');
  const fotoTopo = fotosGaleria.find((foto) => foto.tipo === 'topo');
  const acessoPublico = useMemo(
    () => calcularAcessoAgenda(dadosLoja, CONFIG_SISTEMA_PADRAO.diasTesteGratis),
    [dadosLoja]
  );
  const identificadoresLojaKey = identificadoresLoja.join('|');

  useEffect(() => {
    const salvoNome = localStorage.getItem('cliente_nome');
    const salvoZap = localStorage.getItem('cliente_zap');

    if (salvoNome && salvoZap) {
      setNomeCliente(salvoNome);
      setWhatsappCliente(salvoZap);
    } else {
      setShowIdentificacao(true);
    }
  }, []);

  useEffect(() => {
    if (!lojaId) {
      setLoading(false);
      return undefined;
    }

    let unsubEmpresa = null;
    let mounted = true;

    const carregarDadosIniciais = async () => {
      try {
        const snapDirect = await getDoc(doc(db, 'empresas', lojaId));
        let empresaData = null;
        let empresaDocId = null;

        if (snapDirect.exists()) {
          empresaData = snapDirect.data();
          empresaDocId = snapDirect.id;
        } else {
          const snapEmpresa = await getDocs(query(collection(db, 'empresas'), where('lojaId', '==', lojaId)));
          if (!snapEmpresa.empty) {
            empresaData = snapEmpresa.docs[0].data();
            empresaDocId = snapEmpresa.docs[0].id;
          } else {
            const snapSlug = await getDocs(query(collection(db, 'empresas'), where('slug', '==', lojaId)));
            if (!snapSlug.empty) {
              empresaData = snapSlug.docs[0].data();
              empresaDocId = snapSlug.docs[0].id;
            }
          }
        }

        if (!mounted) return;

        if (empresaData) {
          setDadosLoja({ id: empresaDocId, ...empresaData });
          unsubEmpresa = onSnapshot(doc(db, 'empresas', empresaDocId), (snap) => {
            if (snap.exists()) setDadosLoja({ id: snap.id, ...snap.data() });
          });

          setIdentificadoresLoja(idsDaLoja(
            lojaId,
            empresaDocId,
            empresaData.uid,
            empresaData.donoUid,
            empresaData.lojaId,
            empresaData.slug
          ));
        }
      } catch (e) {
        console.error('Erro ao carregar agenda:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    carregarDadosIniciais();
    const timeoutLoading = setTimeout(() => setLoading(false), 4000);

    return () => {
      mounted = false;
      clearTimeout(timeoutLoading);
      if (unsubEmpresa) unsubEmpresa();
    };
  }, [lojaId]);

  useEffect(() => {
    if (!acessoPublico.ok || identificadoresLoja.length === 0) {
      setServicos([]);
      setFotosGaleria([]);
      return undefined;
    }

    const unsubServicos = onSnapshot(
      query(collection(db, 'servicos'), where('lojaId', 'in', identificadoresLoja)),
      (snap) => setServicos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => console.log('Serviços aguardando permissão...')
    );

    const unsubGaleria = onSnapshot(
      query(collection(db, 'galeria'), where('lojaId', 'in', identificadoresLoja)),
      (snap) => setFotosGaleria(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => console.log('Galeria aguardando permissão...')
    );

    const unsubProfissionais = onSnapshot(
      query(collection(db, 'profissionais'), where('lojaId', 'in', identificadoresLoja)),
      (snap) => {
        setProfissionais(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => console.log('Profissionais aguardando permissão...')
    );

    const unsubPacotes = onSnapshot(
      query(collection(db, 'pacotes'), where('lojaId', 'in', identificadoresLoja)),
      (snap) => setPacotes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );

    const unsubAvaliacoes = onSnapshot(
      query(collection(db, 'avaliacoes'), where('lojaId', '==', lojaId)),
      (snap) => setAvaliacoesLoja(snap.docs.map((d) => d.data())),
      () => {}
    );

    return () => {
      unsubServicos();
      unsubGaleria();
      unsubProfissionais();
      unsubPacotes();
      unsubAvaliacoes();
    };
  }, [acessoPublico.ok, identificadoresLojaKey]);

  useEffect(() => {
    if (!lojaId || !acessoPublico.ok) return undefined;

    const clientId = user?.uid || 'anonimo';
    const unsubFid = onSnapshot(
      doc(db, 'fidelidade', `${lojaId}_${clientId}`),
      (snap) => {
        if (snap.exists()) setPontosFidelidade(snap.data().pontos || 0);
      },
      () => setPontosFidelidade(0)
    );

    return () => unsubFid();
  }, [user?.uid, lojaId, acessoPublico.ok]);

  useEffect(() => {
    if (!user?.uid || !lojaId || !acessoPublico.ok) return undefined;

    const unsubHistorico = onSnapshot(
      query(collection(db, 'agendamentos'), where('clienteUid', '==', user.uid)),
      (snap) => {
        const filtrados = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((ag) => ag.lojaId === lojaId)
          .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
        setMeusAgendamentos(filtrados);
      },
      () => console.warn('Histórico inacessível.')
    );

    return () => unsubHistorico();
  }, [user?.uid, lojaId, acessoPublico.ok]);

  useEffect(() => {
    if (!dataSel || !lojaId || !acessoPublico.ok) return undefined;

    const unsub = onSnapshot(
      query(collection(db, 'agendamentos'), where('data', '==', dataSel), where('lojaId', '==', lojaId)),
      (snap) => setAgendamentosDoDia(snap.docs.map((d) => d.data())),
      () => console.log('Erro ao ler horários ocupados.')
    );

    return () => unsub();
  }, [dataSel, lojaId, acessoPublico.ok]);

  const verificarSeLojaAbreNaData = (dataDigitada) => {
    if (!dataDigitada) return true;
    const bloqueiosAtivos = profissionalSel?.bloqueios || dadosLoja?.bloqueios || [];
    if (bloqueiosAtivos.includes(dataDigitada)) return false;

    const escalaAtiva = profissionalSel?.escala || dadosLoja?.escala;
    if (!escalaAtiva) return true;
    const dataObj = new Date(`${dataDigitada}T12:00:00`);
    const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const configDia = escalaAtiva[diasSemana[dataObj.getDay()]];
    return configDia?.ativo;
  };

  const filtrarHorariosPorEscala = (listaHorarios) => {
    const escalaAtiva = profissionalSel?.escala || dadosLoja?.escala;
    if (!escalaAtiva || !dataSel) return listaHorarios;
    const dataObj = new Date(`${dataSel}T12:00:00`);
    const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const configDia = escalaAtiva[diasSemana[dataObj.getDay()]];

    if (!configDia?.ativo) return [];

    return listaHorarios.filter((h) => h >= configDia.inicio && h < configDia.fim);
  };

  const verificarDisponibilidade = (horario) => {
    const hojeStr = hojeLocal();
    if (dataSel < hojeStr) return 'ocupado';

    const [h, m] = horario.split(':').map(Number);
    const inicioSugerido = h * 60 + m;

    if (dataSel === hojeStr) {
      const agora = new Date();
      const agoraEmMinutos = agora.getHours() * 60 + agora.getMinutes();
      if (inicioSugerido <= agoraEmMinutos) return 'passado';
    }

    if (agendamentosDoDia.some((ag) => ag.horario === horario && (!profissionalSel || !ag.profissionalId || ag.profissionalId === profissionalSel.id))) return 'ocupado';
    return 'livre';
  };

  const horariosDisponiveis = useMemo(() => {
    const manha = filtrarHorariosPorEscala(horariosManha);
    const tarde = filtrarHorariosPorEscala(horariosTarde);
    return { manha, tarde, todos: [...manha, ...tarde] };
  }, [dadosLoja?.escala, profissionalSel?.escala, dataSel]);

  const temHorarioDisponivel = horariosDisponiveis.todos.some((h) => verificarDisponibilidade(h) === 'livre');

  const confirmarIdentidade = () => {
    if (nomeCliente.trim().length < 3) return toast.error('Digite seu nome completo.');
    if (whatsappCliente.length < 14) return toast.error('Digite um WhatsApp válido.');

    localStorage.setItem('cliente_nome', nomeCliente.trim());
    localStorage.setItem('cliente_zap', whatsappCliente);
    setShowIdentificacao(false);
    toast.success(`Olá, ${nomeCliente.trim().split(' ')[0]}!`);
  };

  const handleMudarData = (e) => {
    const novaData = e.target.value;
    setDataSel(novaData);
    setHora('');

    if (!verificarSeLojaAbreNaData(novaData)) {
      toast.error('Não atendemos neste dia da semana.');
      return;
    }
  };

  const finalizarAgendamento = async () => {
    if (!acessoPublico.ok) return toast.error('Essa agenda está temporariamente indisponível.');
    if (!servicoSel) return toast.error('Escolha um serviço.');
    if (!dataSel || !hora) return toast.error('Selecione data e hora.');
    if (!nomeCliente || !whatsappCliente) {
      setShowIdentificacao(true);
      return toast.error('Confirme seus dados para agendar.');
    }

    setCarregando(true);
    try {
      await addDoc(collection(db, 'agendamentos'), {
        lojaId,
        clienteUid: user?.uid || 'anonimo',
        clienteNome: nomeCliente,
        clienteWhatsapp: whatsappCliente.replace(/\D/g, ''),
        servicoNome: servicoSel.nome,
        profissionalId: profissionalSel?.id || null,
        profissionalNome: profissionalSel?.nome || null,
        preco: Number(servicoSel.preco),
        tempoOriginal: parseInt(servicoSel.tempo, 10) || 30,
        horario: hora,
        data: dataSel,
        dataCriacao: serverTimestamp(),
        status: 'pendente',
      });
      setEtapa(4);

      // Dispara Notificação Push em Background
      try {
        const snapSubs = await getDocs(
          query(collection(db, 'push_subscriptions'), where('lojaId', '==', lojaId))
        );
        const subscriptions = [];
        snapSubs.forEach(d => {
          const data = d.data();
          if (data.subscription) subscriptions.push(data.subscription);
        });

        if (subscriptions.length > 0) {
          fetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              titulo: 'Novo Agendamento! 📅',
              corpo: `${nomeCliente} agendou ${servicoSel.nome} para ${dataSel.split('-').reverse().join('/')} às ${hora}`,
              url: `/`, // Direciona para o app
              subscriptions
            })
          }).catch(err => console.error('Erro API Push:', err));
        }
      } catch (pushErr) {
        console.error('Erro ao buscar push subscriptions:', pushErr);
      }
    } catch (e) {
      toast.error('Erro ao salvar agendamento.');
    } finally {
      setCarregando(false);
    }
  };

  const handleCopiaPix = () => {
    if (!dadosLoja?.chavePix) return;
    navigator.clipboard.writeText(dadosLoja.chavePix);
    setCopiou(true);
    toast.success('Chave PIX copiada!');
    setTimeout(() => setCopiou(false), 2000);
  };

  const enviarZapComprovante = () => {
    const numDonoFinal = telefoneWhatsApp(dadosLoja?.whatsapp);
    if (!numDonoFinal) return toast.error('WhatsApp da agenda não encontrado.');

    const msg = encodeURIComponent(
      `Novo agendamento\n\n` +
      `Cliente: ${nomeCliente}\n` +
      `Serviço: ${servicoSel?.nome}\n` +
      `Data: ${dataSel.split('-').reverse().join('/')}\n` +
      `Hora: ${hora}\n` +
      `Valor: R$ ${Number(servicoSel?.preco || 0).toFixed(2)}`
    );

    window.open(`https://wa.me/${numDonoFinal}?text=${msg}`, '_blank');
  };

  const selecionarServico = (servico) => {
    setServicoSel(servico);
    if (profissionais.length > 0) {
      setEtapa(2);
    } else {
      setProfissionalSel(null);
      setEtapa(3);
    }
    setHora('');
  };

  const selecionarProfissional = (prof) => {
    setProfissionalSel(prof);
    setEtapa(3);
    setHora('');
    setDataSel(hojeLocal());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] grid place-items-center text-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Carregando agenda</p>
        </div>
      </div>
    );
  }

  if (!dadosLoja) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] grid place-items-center p-6 text-center">
        <div className="max-w-md rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_25px_70px_rgba(15,23,42,0.08)]">
          <Store className="mx-auto mb-4 text-slate-300" size={44} />
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Agenda não encontrada</h1>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-500">Confira o link recebido e tente novamente.</p>
        </div>
      </div>
    );
  }

  if (!acessoPublico.ok) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] grid place-items-center p-6 text-center text-slate-950">
        <Toaster position="top-center" />
        <div className="w-full max-w-lg rounded-[36px] border border-slate-200 bg-white p-8 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-amber-50 text-amber-600 ring-8 ring-amber-50/70">
            <LockKeyhole size={36} />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-amber-600">Agenda indisponível</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{nomeAgenda}</h1>
          <p className="mt-4 text-sm font-medium leading-7 text-slate-500">
            Este link está pausado temporariamente. Assim que a licença for renovada pelo responsável, os agendamentos voltam a funcionar no mesmo endereço.
          </p>
          <div className="mt-7 rounded-3xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-start gap-3 text-left">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-xs font-bold leading-5 text-amber-800">
                Nenhum horário pode ser marcado enquanto a agenda estiver expirada.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderIdentificacao = () => (
    <AnimatePresence>
      {showIdentificacao && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }} className="w-full max-w-md rounded-[32px] bg-white p-6 text-center shadow-[0_30px_100px_rgba(15,23,42,0.24)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[24px] bg-indigo-50 text-indigo-600">
              <User size={30} />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">Antes de agendar</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">Informe seu nome e WhatsApp para a empresa confirmar seu horário.</p>

            <div className="mt-6 space-y-3">
              <input
                type="text"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                placeholder="Seu nome"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
              />
              <input
                type="tel"
                value={whatsappCliente}
                onChange={(e) => setWhatsappCliente(formatarZap(e.target.value))}
                placeholder="Seu WhatsApp"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <button onClick={confirmarIdentidade} className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95">
              Confirmar dados
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const obterMediaProfissional = (profId) => {
    const avs = avaliacoesLoja.filter(a => a.profissionalId === profId);
    if (avs.length === 0) return null;
    const soma = avs.reduce((acc, curr) => acc + curr.nota, 0);
    return (soma / avs.length).toFixed(1);
  };

  const salvarAvaliacao = async () => {
    if (!avAgendamentoSel) return;
    try {
      await addDoc(collection(db, 'avaliacoes'), {
        lojaId,
        profissionalId: avAgendamentoSel.profissionalId || 'geral',
        profissionalNome: avAgendamentoSel.profissionalNome || 'Estabelecimento',
        agendamentoId: avAgendamentoSel.id,
        clienteNome: nomeCliente || 'Cliente',
        nota: avNota,
        comentario: avComentario,
        criadoEm: serverTimestamp()
      });
      await setDoc(doc(db, 'agendamentos', avAgendamentoSel.id), { avaliado: true }, { merge: true });
      setModalAvaliacao(false);
      setAvNota(5);
      setAvComentario('');
      toast.success('Avaliação enviada com sucesso!');
    } catch (e) {
      toast.error('Erro ao enviar avaliação.');
    }
  };

  const cancelarAgendamento = async (agId) => {
    if (!window.confirm('Tem certeza que deseja cancelar este agendamento?')) return;
    try {
      await setDoc(doc(db, 'agendamentos', agId), { status: 'cancelado' }, { merge: true });
      toast.success('Agendamento cancelado!');
    } catch (e) {
      toast.error('Erro ao cancelar agendamento.');
    }
  };

  const renderHero = () => (
    <header className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
      {/* Capa/Banner */}
      <div className="relative h-40 w-full sm:h-52 bg-slate-100">
        {fotoTopo?.url ? (
          <img src={fotoTopo.url} alt="Banner" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r opacity-95" style={{ background: `linear-gradient(135deg, ${corApp} 0%, #0f172a 100%)` }} />
        )}
      </div>

      {/* Info do Perfil */}
      <div className="relative px-6 pb-6 pt-16 sm:px-8">
        {/* Avatar/Logo overlapping cover */}
        <div className="absolute -top-12 left-6 h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-slate-50 shadow-md sm:-top-16 sm:h-32 sm:w-32 sm:left-8">
          {dadosLoja?.logoUrl ? (
            <img src={dadosLoja.logoUrl} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100">
              <Scissors size={32} className="text-indigo-600" />
            </div>
          )}
        </div>

        {/* Edit Profile/Info Row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{nomeAgenda}</h1>
              <span className="inline-flex items-center justify-center rounded-full bg-indigo-50 p-1 text-indigo-600">
                <Sparkles size={14} className="fill-current" />
              </span>
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
              {dadosLoja?.slogan || 'Sua página de agendamentos online.'}
            </p>
          </div>

          {/* WhatsApp / Contato Button */}
          {dadosLoja?.whatsapp && (
            <button
              onClick={() => window.open(`https://wa.me/${telefoneWhatsApp(dadosLoja.whatsapp)}`, '_blank')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-95 self-start shrink-0"
            >
              <Phone size={14} /> Falar no WhatsApp
            </button>
          )}
        </div>

        {/* Stats Row */}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-5 text-sm">
          <div className="flex gap-1.5 text-slate-500">
            <span className="font-black text-slate-950">{servicos.length}</span> serviços
          </div>
          <div className="flex gap-1.5 text-slate-500">
            <span className="font-black text-slate-950">{pacotes.length}</span> combos
          </div>
          <div className="flex gap-1.5 text-slate-500">
            <span className="font-black text-slate-950">⭐ {notaMediaLoja}</span> ({totalAvaliacoes} avaliações)
          </div>
        </div>
      </div>
    </header>
  );

  const renderGaleriaAba = () => {
    const cortesList = obterFotosDoStory('cortes');
    const ambienteList = obterFotosDoStory('ambiente');
    const geralList = obterFotosDoStory('geral');

    return (
      <div className="space-y-6">
        {/* Destaques estilo Instagram Stories */}
        {fotosPortfolio.length > 0 && (
          <div className="flex gap-4 overflow-x-auto rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm no-scrollbar">
            {[
              { id: 'geral', label: 'Novidades ✨', list: geralList },
              { id: 'cortes', label: 'Cortes ✂️', list: cortesList },
              { id: 'ambiente', label: 'Estilo 🧔', list: ambienteList }
            ].map((story) => {
              if (story.list.length === 0) return null;
              return (
                <button
                  key={story.id}
                  onClick={() => { setStoryAtivo(story.id); setStorySlideIndex(0); }}
                  className="flex flex-col items-center shrink-0 cursor-pointer group active:scale-95 transition-all"
                >
                  <div className="relative rounded-full p-[2.5px] bg-gradient-to-tr from-amber-500 via-red-500 to-indigo-600 transition-transform duration-300 group-hover:scale-105">
                    <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-white bg-slate-100">
                      <img src={story.list[0].url} alt={story.label} className="h-full w-full object-cover" />
                    </div>
                  </div>
                  <span className="mt-2 text-[10px] font-black text-slate-800 tracking-tight">{story.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Grade do Portfólio */}
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-black text-slate-950 flex items-center gap-2">
            <ImageIcon size={18} className="text-indigo-600" /> Nosso Portfólio ({fotosPortfolio.length})
          </h3>
          
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {fotosPortfolio.map((foto, index) => (
              <button
                key={index}
                onClick={() => setLightboxIndex(index)}
                className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-50 border border-slate-100 shadow-sm cursor-zoom-in text-left focus:outline-none"
              >
                <img src={foto.url} alt="Portfólio" className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:brightness-95" />
                <div className="absolute inset-0 bg-slate-950/0 transition-all duration-300 group-hover:bg-slate-950/20 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="rounded-xl bg-white/95 px-3 py-1.5 text-[9px] font-black text-slate-950 uppercase tracking-widest shadow-md">Ver Foto</span>
                </div>
              </button>
            ))}
            
            {fotosPortfolio.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <ImageIcon size={36} className="mx-auto mb-3 text-slate-300 animate-bounce" />
                <p className="text-sm font-bold text-slate-400">Nenhuma foto no portfólio no momento.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  };

  const renderSobre = () => (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Contato e Localização */}
      <section className="space-y-4 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-950 flex items-center gap-2">
          <MapPin size={18} className="text-indigo-600" /> Informações
        </h3>
        
        {dadosLoja?.linkMaps && (
          <button onClick={() => window.open(dadosLoja.linkMaps, '_blank')} className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left active:scale-95 transition-all">
            <div className="min-w-0 pr-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Endereço</p>
              <p className="mt-1 text-sm font-black text-slate-950 truncate">Ver no Google Maps</p>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>
        )}
        
        {dadosLoja?.whatsapp && (
          <button onClick={() => window.open(`https://wa.me/${telefoneWhatsApp(dadosLoja.whatsapp)}`, '_blank')} className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left active:scale-95 transition-all">
            <div className="min-w-0 pr-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Telefone / WhatsApp</p>
              <p className="mt-1 text-sm font-black text-slate-950">{formatarZap(dadosLoja.whatsapp)}</p>
            </div>
            <Phone size={18} className="text-emerald-500 shrink-0" />
          </button>
        )}
      </section>

      {/* Avaliações Recentes */}
      <section className="space-y-4 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-950 flex items-center gap-2">
          <Star size={18} className="text-amber-500 fill-current" /> Avaliações ({totalAvaliacoes})
        </h3>
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {avaliacoesLoja.map((av, index) => (
            <div key={index} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900">{av.clienteNome || 'Cliente'}</span>
                <span className="flex items-center gap-0.5 text-xs font-bold text-amber-500">
                  <Star size={12} className="fill-current" /> {av.nota}
                </span>
              </div>
              {av.comentario && <p className="text-xs text-slate-600 italic">"{av.comentario}"</p>}
            </div>
          ))}
          {avaliacoesLoja.length === 0 && (
            <p className="text-sm font-bold text-slate-400 text-center py-8">Nenhuma avaliação ainda.</p>
          )}
        </div>
      </section>
    </div>
  );

  const renderServicos = () => {
    const servicosPorCategoria = servicos.reduce((acc, servico) => {
      const cat = servico.categoria || 'Outros';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(servico);
      return acc;
    }, {});

    const categoriasOrdenadas = Object.keys(servicosPorCategoria).sort((a, b) => {
      if (a === 'Outros') return 1;
      if (b === 'Outros') return -1;
      return a.localeCompare(b);
    });

    return (
      <section className="grid gap-8">
        {servicos.length === 0 && pacotes.length === 0 && (
          <div className="col-span-full grid min-h-72 place-items-center rounded-[28px] border border-dashed border-slate-200 bg-white p-8 text-center">
            <div>
              <Scissors className="mx-auto mb-4 text-slate-300" size={40} />
              <h3 className="text-lg font-black text-slate-900">Nenhum serviço disponível</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">A agenda ainda está sendo configurada.</p>
            </div>
          </div>
        )}

        {/* Combos Promocionais */}
        {pacotes.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-black tracking-tight text-slate-950 flex items-center gap-2">
              <Gift size={20} className="text-indigo-600 animate-pulse" /> Combos Promocionais
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {pacotes.map((pac) => (
                <button
                  key={pac.id}
                  onClick={() => selecionarServico({ id: pac.id, nome: pac.nome, preco: pac.preco, tempo: 'Tempo a combinar', tipo: 'pacote' })}
                  className="group rounded-[28px] border border-indigo-100 bg-indigo-50/30 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">Combo</span>
                      <p className="mt-2 text-base font-black text-slate-950">{pac.nome}</p>
                      {pac.descricao && <p className="mt-1 text-xs text-slate-500 font-bold">{pac.descricao}</p>}
                    </div>
                    <div className="rounded-2xl bg-white border border-indigo-100 px-4 py-3 text-right">
                      <p className="text-lg font-black text-indigo-600">R$ {Number(pac.preco || 0).toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-indigo-100/50 pt-4">
                    <span className="text-xs font-black uppercase tracking-widest text-indigo-500">Reservar Combo</span>
                    <ChevronRight size={18} className="text-indigo-400 transition-transform group-hover:translate-x-1 group-hover:text-indigo-600" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {categoriasOrdenadas.map((cat) => (
          <div key={cat}>
            <h2 className="mb-4 text-xl font-black tracking-tight text-slate-950">{cat}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {servicosPorCategoria[cat].map((servico) => (
                <button
                  key={servico.id}
                  onClick={() => selecionarServico(servico)}
                  className="group rounded-[28px] border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4 items-center">
                      {servico.fotoUrl && (
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                          <img src={servico.fotoUrl} alt={servico.nome} className="h-full w-full object-cover" />
                        </div>
                      )}
                      <div>
                        <p className="text-base font-black text-slate-950">{servico.nome}</p>
                        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400">
                          <Clock size={14} />
                          {servico.tempo || 'Tempo a combinar'}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                      <p className="text-lg font-black" style={{ color: corApp }}>R$ {Number(servico.preco || 0).toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Reservar</span>
                    <ChevronRight size={18} className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-indigo-600" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    );
  };

  const renderProfissionais = () => (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div className="col-span-full mb-4">
        <button onClick={() => setEtapa(1)} className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600">Voltar para serviços</button>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">Escolha o profissional</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">Com quem você gostaria de agendar?</p>
      </div>

      {profissionais.map((prof) => (
        <button
          key={prof.id}
          onClick={() => selecionarProfissional(prof)}
          className="group rounded-[28px] border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] active:scale-[0.99]"
        >
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
              {prof.fotoUrl ? <img src={prof.fotoUrl} alt={prof.nome} className="h-full w-full object-cover" /> : <User className="m-auto h-full text-slate-300" />}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-950 flex items-center gap-1.5">
                {prof.nome}
                {obterMediaProfissional(prof.id) && (
                  <span className="text-xs font-bold text-amber-500 flex items-center gap-0.5 ml-1">
                    <Star size={12} className="fill-current" /> {obterMediaProfissional(prof.id)}
                  </span>
                )}
              </h3>
              <p className="mt-1 text-xs font-bold text-slate-500 line-clamp-2">{prof.biografia}</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Selecionar</span>
            <ChevronRight size={18} className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-indigo-600" />
          </div>
        </button>
      ))}
    </section>
  );

  const renderHorarios = () => (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_20px_70px_rgba(15,23,42,0.07)] sm:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button onClick={() => setEtapa(profissionais.length > 0 ? 2 : 1)} className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600">Voltar</button>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">{servicoSel?.nome}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">R$ {Number(servicoSel?.preco || 0).toFixed(2)} · {servicoSel?.tempo} {profissionalSel && ` · Com ${profissionalSel.nome}`}</p>
        </div>
        <input
          type="date"
          min={hojeLocal()}
          value={dataSel}
          onChange={handleMudarData}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-900 outline-none focus:border-indigo-500"
        />
      </div>

      {!verificarSeLojaAbreNaData(dataSel) || !temHorarioDisponivel ? (
        <div className="grid min-h-52 place-items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <div>
            <Store className="mx-auto mb-4 text-slate-300" size={36} />
            <p className="text-sm font-black text-slate-600">
              {verificarSeLojaAbreNaData(dataSel) ? 'Todos os horários estão ocupados.' : 'Não há atendimento neste dia.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-7">
          {[
            ['Manhã', horariosDisponiveis.manha],
            ['Tarde', horariosDisponiveis.tarde],
          ].map(([periodo, lista]) => {
            if (lista.length === 0) return null;

            return (
              <div key={periodo}>
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">{periodo}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {lista.map((horario) => {
                    const status = verificarDisponibilidade(horario);
                    const ativo = hora === horario;
                    return (
                      <button
                        key={horario}
                        disabled={status !== 'livre'}
                        onClick={() => setHora(horario)}
                        className={`rounded-2xl border px-3 py-4 text-sm font-black transition-all ${ativo ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200'} disabled:cursor-not-allowed disabled:opacity-25`}
                      >
                        {horario}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={finalizarAgendamento}
        disabled={!hora || carregando || !temHorarioDisponivel || !dataSel}
        className="mt-7 w-full rounded-2xl bg-slate-950 px-5 py-5 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {carregando ? 'Confirmando...' : 'Confirmar reserva'}
      </button>
    </section>
  );

  const renderConfirmacao = () => (
    <section className="mx-auto max-w-xl rounded-[32px] border border-slate-200 bg-white p-6 text-center shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/70">
        <CheckCircle2 size={38} />
      </div>
      <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Reserva enviada</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Seu horário foi solicitado.</h2>
      <p className="mt-3 text-sm font-medium leading-7 text-slate-500">Agora envie o comprovante ou avise a empresa pelo WhatsApp para agilizar a confirmação.</p>

      {dadosLoja?.chavePix ? (
        <div className="mt-7 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="mb-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-600">
            <Wallet size={15} /> Pagamento PIX
          </p>
          <div className="mx-auto h-36 w-36 rounded-2xl bg-white p-2 shadow-sm">
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${dadosLoja.chavePix}`} className="h-full w-full" alt="QR Code" />
          </div>
          <button onClick={handleCopiaPix} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left active:scale-95">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Copia e cola</p>
              <p className="mt-1 truncate text-xs font-mono text-emerald-600">{dadosLoja.chavePix}</p>
            </div>
            {copiou ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} className="text-slate-400" />}
          </button>
        </div>
      ) : (
        <div className="mt-7 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-bold text-slate-500">Pagamento no local.</p>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button onClick={enviarZapComprovante} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-950 active:scale-95">
          <MessageCircle size={18} /> WhatsApp
        </button>
        <button onClick={() => { setEtapa(1); setServicoSel(null); setHora(''); }} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-600 active:scale-95">
          Novo horário
        </button>
      </div>
    </section>
  );

  const renderPerfil = () => {
    if (!user) {
      return (
        <section className="mx-auto max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[24px] bg-indigo-50 text-indigo-600">
            <User size={30} />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Acesse sua conta</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
            Faça login com sua conta Google para gerenciar seus agendamentos, acompanhar seus pontos de fidelidade e dar avaliações.
          </p>
          <button 
            onClick={async () => {
              try {
                const usuario = await entrarComGoogle();
                if (usuario) toast.success(`Conectado como ${usuario.displayName}!`);
              } catch (err) {
                toast.error('Erro ao conectar.');
              }
            }} 
            className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95 flex items-center justify-center gap-2"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="" />
            Entrar com Google
          </button>
        </section>
      );
    }

    return (
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Meu perfil</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{user.displayName || nomeCliente || 'Cliente'}</h2>
              <p className="text-xs text-slate-400 font-bold">{user.email}</p>
            </div>
            {onLogout && (
              <button onClick={onLogout} className="rounded-2xl bg-slate-50 p-3 text-slate-400 hover:text-red-500">
                <LogOut size={18} />
              </button>
            )}
          </div>

          <div className="mb-6 rounded-3xl bg-slate-950 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Fidelidade</p>
                <p className="mt-2 text-2xl font-black">{pontosFidelidade} pontos</p>
              </div>
              <Gift className="text-indigo-300" size={34} />
            </div>
            <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${Math.min(100, (pontosFidelidade % 10) * 10)}%` }} />
            </div>
            <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Próxima recompensa em {10 - (pontosFidelidade % 10)} agendamentos</p>
          </div>

          <div className="space-y-3">
            {meusAgendamentos.length > 0 ? meusAgendamentos.map((ag) => (
              <div key={ag.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950">{ag.servicoNome}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {ag.data?.split('-').reverse().join('/')} às {ag.horario}
                      {ag.profissionalNome && ` · Com ${ag.profissionalNome}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${ag.status === 'concluido' ? 'bg-emerald-100 text-emerald-700' : ag.status === 'confirmado' ? 'bg-blue-100 text-blue-700' : ag.status === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-white text-slate-500'}`}>
                      {ag.status || 'Agendado'}
                    </span>
                    {ag.status === 'concluido' && !ag.avaliado && (
                      <button 
                        onClick={() => { setAvAgendamentoSel(ag); setModalAvaliacao(true); }}
                        className="rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-950"
                      >
                        Avaliar
                      </button>
                    )}
                    {(ag.status === 'pendente' || ag.status === 'confirmado' || !ag.status) && (
                      <button 
                        onClick={() => cancelarAgendamento(ag.id)}
                        className="rounded-xl bg-red-50 hover:bg-red-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-500"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <div className="grid min-h-40 place-items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-center">
                <p className="text-sm font-black text-slate-400">Nenhum histórico por enquanto.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          {dadosLoja?.linkMaps && (
            <button onClick={() => window.open(dadosLoja.linkMaps, '_blank')} className="flex w-full items-center justify-between rounded-[28px] border border-slate-200 bg-white p-5 text-left shadow-sm active:scale-95">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Localização</p>
                <p className="mt-1 text-sm font-black text-slate-950">Como chegar</p>
              </div>
              <MapPin size={22} style={{ color: corApp }} />
            </button>
          )}
          {dadosLoja?.whatsapp && (
            <button onClick={() => window.open(`https://wa.me/${telefoneWhatsApp(dadosLoja.whatsapp)}`, '_blank')} className="flex w-full items-center justify-between rounded-[28px] border border-slate-200 bg-white p-5 text-left shadow-sm active:scale-95">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Atendimento</p>
                <p className="mt-1 text-sm font-black text-slate-950">Chamar no WhatsApp</p>
              </div>
              <Phone size={22} className="text-emerald-500" />
            </button>
          )}
        </aside>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] px-4 py-5 text-slate-950 font-sans sm:px-6">
      <style>{`
        :root {
          --color-primary: ${corApp};
          --color-primary-dark: ${corAppDark};
          --color-primary-rgb: ${corAppRgb};
        }
        .bg-indigo-600 {
          background-color: var(--color-primary) !important;
        }
        .hover\\:bg-indigo-700:hover {
          background-color: var(--color-primary-dark) !important;
        }
        .text-indigo-600 {
          color: var(--color-primary) !important;
        }
        .hover\\:text-indigo-600:hover {
          color: var(--color-primary) !important;
        }
        .border-indigo-600 {
          border-color: var(--color-primary) !important;
        }
        .border-indigo-100 {
          border-color: rgba(var(--color-primary-rgb), 0.15) !important;
        }
        .bg-indigo-50 {
          background-color: rgba(var(--color-primary-rgb), 0.08) !important;
        }
        .bg-indigo-50\\/30 {
          background-color: rgba(var(--color-primary-rgb), 0.03) !important;
        }
        .text-indigo-500 {
          color: var(--color-primary) !important;
        }
        .text-indigo-700 {
          color: var(--color-primary-dark) !important;
        }
        .text-indigo-300 {
          color: var(--color-primary) !important;
          filter: brightness(1.3);
        }
        .shadow-indigo-600\\/20 {
          --tw-shadow-color: rgba(var(--color-primary-rgb), 0.2) !important;
        }
        .focus\\:border-indigo-500:focus {
          border-color: var(--color-primary) !important;
        }
        .hover\\:border-indigo-200:hover {
          border-color: rgba(var(--color-primary-rgb), 0.3) !important;
        }
      `}</style>
      <Toaster position="top-center" />
      {renderIdentificacao()}

      <div className="mx-auto max-w-6xl space-y-6">
        {renderHero()}

        <nav className="sticky top-3 z-30 flex gap-2 overflow-x-auto rounded-3xl border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur">
          {[
            ['servicos', 'Serviços', Scissors, 1],
            ['perfil', 'Meu perfil', User, 5],
          ].map(([id, label, Icon, destino]) => (
            <button
              key={id}
              onClick={() => setEtapa(destino)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${etapa === destino ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        <main>
          {etapa === 1 && (
            <div className="mb-6 flex gap-2 border-b border-slate-200 pb-px">
              {[
                ['catalogo', 'Catálogo', Scissors],
                ['galeria', 'Galeria', ImageIcon],
                ['info', 'Sobre', MapPin],
              ].map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => setSubAba(id)}
                  className={`flex-1 pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 ${
                    subAba === id
                      ? 'border-indigo-600 text-indigo-600 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div key={etapa + '_' + (etapa === 1 ? subAba : '')} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              {etapa === 1 && subAba === 'catalogo' && renderServicos()}
              {etapa === 1 && subAba === 'galeria' && renderGaleriaAba()}
              {etapa === 1 && subAba === 'info' && renderSobre()}
              {etapa === 2 && renderProfissionais()}
              {etapa === 3 && renderHorarios()}
              {etapa === 4 && renderConfirmacao()}
              {etapa === 5 && renderPerfil()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Modal Avaliação */}
      <AnimatePresence>
        {modalAvaliacao && avAgendamentoSel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }} className="w-full max-w-md rounded-[32px] bg-white p-6 text-center shadow-[0_30px_100px_rgba(15,23,42,0.24)] relative">
              <button 
                onClick={() => setModalAvaliacao(false)} 
                className="absolute top-4 right-4 rounded-xl bg-slate-50 p-2 text-slate-400 hover:text-slate-900"
              >
                <X size={16} />
              </button>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                <Star size={26} className="fill-current" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-slate-950">Avaliar atendimento</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">Sua avaliação para: {avAgendamentoSel.servicoNome}</p>

              {/* Stars selection */}
              <div className="my-6 flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((nota) => (
                  <button 
                    key={nota} 
                    type="button"
                    onClick={() => setAvNota(nota)}
                    className="text-amber-400 transition-transform active:scale-90"
                  >
                    <Star 
                      size={32} 
                      className={nota <= avNota ? 'fill-current' : 'text-slate-200'} 
                    />
                  </button>
                ))}
              </div>

              <textarea 
                value={avComentario} 
                onChange={(e) => setAvComentario(e.target.value)} 
                placeholder="Escreva um comentário opcional sobre o atendimento..." 
                rows={3} 
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 resize-none"
              />

              <button 
                onClick={salvarAvaliacao} 
                className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95"
              >
                Enviar avaliação
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visualizador de Stories */}
      <AnimatePresence>
        {storyAtivo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999] flex flex-col justify-between bg-slate-950 p-4">
            {/* Barras de progresso estilo Instagram */}
            <div className="flex gap-1.5 w-full absolute top-4 left-0 px-4 z-50">
              {obterFotosDoStory(storyAtivo).map((_, idx) => (
                <div key={idx} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all duration-75"
                    style={{ 
                      width: idx === storySlideIndex ? `${storyProgresso}%` : idx < storySlideIndex ? '100%' : '0%' 
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Cabeçalho do Story */}
            <div className="flex items-center justify-between w-full absolute top-8 left-0 px-4 z-50 text-white">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full overflow-hidden border border-white bg-slate-800">
                  {dadosLoja?.logoUrl ? <img src={dadosLoja.logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <Scissors size={14} className="m-auto h-full text-white" />}
                </div>
                <span className="text-xs font-black uppercase tracking-widest">{nomeAgenda}</span>
              </div>
              <button onClick={() => setStoryAtivo(null)} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
                <X size={18} />
              </button>
            </div>

            {/* Slide de Imagem */}
            <div className="flex-1 flex items-center justify-center relative">
              <img src={obterFotosDoStory(storyAtivo)[storySlideIndex]?.url} alt="Story" className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl" />
              
              {/* Áreas de toque esquerda/direita */}
              <div className="absolute inset-y-0 left-0 w-1/3 cursor-pointer" onClick={() => {
                if (storySlideIndex > 0) {
                  setStorySlideIndex(prev => prev - 1);
                  setStoryProgresso(0);
                }
              }} />
              <div className="absolute inset-y-0 right-0 w-1/3 cursor-pointer" onClick={() => {
                const list = obterFotosDoStory(storyAtivo);
                if (storySlideIndex + 1 < list.length) {
                  setStorySlideIndex(prev => prev + 1);
                  setStoryProgresso(0);
                } else {
                  setStoryAtivo(null);
                }
              }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visualizador Lightbox de Fotos */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
            onClick={() => setLightboxIndex(null)}
          >
            <button onClick={() => setLightboxIndex(null)} className="absolute top-4 right-4 z-50 rounded-full bg-white/10 p-3 text-white hover:bg-white/20">
              <X size={20} />
            </button>

            <div className="relative max-w-4xl max-h-[80vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <img src={fotosPortfolio[lightboxIndex]?.url} alt="Portfólio" className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl" />

              {/* Setas de navegação */}
              {lightboxIndex > 0 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev - 1); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white hover:bg-white/40"
                >
                  <ChevronRight className="rotate-180" size={24} />
                </button>
              )}
              {lightboxIndex + 1 < fotosPortfolio.length && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev + 1); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white hover:bg-white/40"
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>

            {/* Legenda inferior */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-xs font-black uppercase tracking-widest bg-black/40 px-4 py-2 rounded-full">
              Foto {lightboxIndex + 1} de {fotosPortfolio.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Cliente;
