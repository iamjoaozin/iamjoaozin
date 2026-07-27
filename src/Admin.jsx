import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  Calendar,
  CheckCircle,
  Clock,
  Copy,
  DollarSign,
  Image as ImageIcon,
  Link2,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Palette,
  Phone,
  PlayCircle,
  Plus,
  Quote,
  Scissors,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Type,
  User,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { calcularAcessoAgenda } from './acessoAgenda';
import { isSuperAdmin } from './admins';
import { CONFIG_SISTEMA_PADRAO, formatarMoeda, sanitizarConfigSistema } from './configSistema';
import AiAssistant from './AiAssistant';
import InstallAppButton from './InstallAppButton';
import { db } from './firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const diasSemana = {
  seg: 'Segunda',
  ter: 'Terça',
  qua: 'Quarta',
  qui: 'Quinta',
  sex: 'Sexta',
  sab: 'Sábado',
  dom: 'Domingo',
};

const abas = [
  { id: 'agenda', label: 'Agenda', icon: Calendar },
  { id: 'horarios', label: 'Horários', icon: Clock },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { id: 'servicos', label: 'Serviços', icon: Scissors },
  { id: 'pacotes', label: 'Pacotes', icon: Package },
  { id: 'profissionais', label: 'Profissionais', icon: Users },
  { id: 'avaliacoes', label: 'Avaliações', icon: Star },
  { id: 'galeria', label: 'Galeria', icon: ImageIcon },
  { id: 'perfil', label: 'Ajustes', icon: Settings },
];

const cardBase = 'rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)]';
const inputBase = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-indigo-500';
const MINIMO_PUBLICACAO = 80;

const tamanhoDataUrl = (dataUrl) => new Blob([dataUrl]).size;

const comprimirImagemParaDataUrl = async (
  arquivo,
  { maxWidth = 1200, maxHeight = 1200, quality = 0.78, maxBytes = 650 * 1024 } = {},
  onProgress = () => {}
) => {
  if (!arquivo?.type?.startsWith('image/')) {
    throw new Error('Arquivo inválido.');
  }

  onProgress(10);
  const urlTemporaria = URL.createObjectURL(arquivo);

  try {
    const imagem = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = urlTemporaria;
    });

    const larguraOriginal = imagem.naturalWidth || imagem.width;
    const alturaOriginal = imagem.naturalHeight || imagem.height;
    let escala = Math.min(1, maxWidth / larguraOriginal, maxHeight / alturaOriginal);
    let qualidadeAtual = quality;
    let melhorDataUrl = '';
    let melhorBytes = Number.MAX_SAFE_INTEGER;

    for (let tentativa = 0; tentativa < 8; tentativa += 1) {
      const largura = Math.max(1, Math.round(larguraOriginal * escala));
      const altura = Math.max(1, Math.round(alturaOriginal * escala));

      const canvas = document.createElement('canvas');
      canvas.width = largura;
      canvas.height = altura;

      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, largura, altura);
      ctx.drawImage(imagem, 0, 0, largura, altura);

      const dataUrl = canvas.toDataURL('image/jpeg', qualidadeAtual);
      const bytes = tamanhoDataUrl(dataUrl);
      onProgress(Math.min(85, 20 + tentativa * 9));

      if (bytes < melhorBytes) {
        melhorDataUrl = dataUrl;
        melhorBytes = bytes;
      }

      if (bytes <= maxBytes) {
        onProgress(90);
        return { dataUrl, bytes, width: largura, height: altura };
      }

      qualidadeAtual = Math.max(0.48, qualidadeAtual - 0.08);
      escala *= 0.86;
    }

    if (!melhorDataUrl) throw new Error('Não foi possível processar a imagem.');
    onProgress(90);
    return { dataUrl: melhorDataUrl, bytes: melhorBytes };
  } catch (e) {
    console.warn('Não foi possível otimizar a imagem.', e);
    throw e;
  } finally {
    URL.revokeObjectURL(urlTemporaria);
  }
};

const idsDaLoja = (...valores) =>
  [...new Set(valores.map((valor) => String(valor || '').trim()).filter(Boolean))].slice(0, 10);

const mensagemErroUpload = (erro) => erro?.message || 'Erro ao salvar imagem. Tente uma foto menor.';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const Admin = ({ user, onSair }) => {
  const { lojaId } = useParams();
  const [dadosLoja, setDadosLoja] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('agenda');
  const [showBannerNovidade, setShowBannerNovidade] = useState(() => {
    return localStorage.getItem('agendaLink_novidade_v3') !== 'visto';
  });
  const [modalNovoServico, setModalNovoServico] = useState(false);
  const [agendamentos, setAgendamentos] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [financeiro, setFinanceiro] = useState({ hoje: 0 });
  const [pixDados, setPixDados] = useState(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [configSistema, setConfigSistema] = useState(CONFIG_SISTEMA_PADRAO);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setShowInstallBanner(false));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstallBanner(false);
    setInstallPrompt(null);
  };


  const [escala, setEscala] = useState({
    seg: { ativo: true, inicio: '08:00', fim: '18:00' },
    ter: { ativo: true, inicio: '08:00', fim: '18:00' },
    qua: { ativo: true, inicio: '08:00', fim: '18:00' },
    qui: { ativo: true, inicio: '08:00', fim: '18:00' },
    sex: { ativo: true, inicio: '08:00', fim: '18:00' },
    sab: { ativo: true, inicio: '08:00', fim: '14:00' },
    dom: { ativo: false, inicio: '00:00', fim: '00:00' },
  });

  const [novoNomeS, setNovoNomeS] = useState('');
  const [novoPrecoS, setNovoPrecoS] = useState('');
  const [novoTempoS, setNovoTempoS] = useState('');
  const [novaCategoriaS, setNovaCategoriaS] = useState('');
  const [unidadeTempo, setUnidadeTempo] = useState('min');
  const [fotoSelecionadaServico, setFotoSelecionadaServico] = useState(null);
  const [enviandoFotoServico, setEnviandoFotoServico] = useState(false);
  const [progressoFotoServico, setProgressoFotoServico] = useState(0);

  const [modalNovoProfissional, setModalNovoProfissional] = useState(false);
  const [novoNomeP, setNovoNomeP] = useState('');
  const [novaBioP, setNovaBioP] = useState('');
  const [novoEmailP, setNovoEmailP] = useState('');
  const [fotoSelecionadaProfissional, setFotoSelecionadaProfissional] = useState(null);
  const [enviandoFotoProfissional, setEnviandoFotoProfissional] = useState(false);
  const [progressoFotoProfissional, setProgressoFotoProfissional] = useState(0);

  const [pacotes, setPacotes] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [modalNovoPacote, setModalNovoPacote] = useState(false);
  const [novoPacoteNome, setNovoPacoteNome] = useState('');
  const [novoPacotePreco, setNovoPacotePreco] = useState('');
  const [novoPacoteDesc, setNovoPacoteDesc] = useState('');

  const [fotoSelecionada, setFotoSelecionada] = useState(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [progressoFoto, setProgressoFoto] = useState(0);
  const [logoSelecionada, setLogoSelecionada] = useState(null);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [progressoLogo, setProgressoLogo] = useState(0);

  const SEU_WHATSAPP_SUPORTE = '5587991695672';
  const corPrincipal = dadosLoja?.corPrincipal || '#4f46e5';
  const nomeAgenda = dadosLoja?.nomeLoja || dadosLoja?.nomeEmpresa || 'Sua agenda';
  const publicUrl = `${window.location.protocol}//${window.location.host}/${lojaId}`;
  const planoAtual = configSistema.plano;

  useEffect(() => {
    const unsubConfig = onSnapshot(
      doc(db, 'configuracoes', 'sistema'),
      (snap) => {
        setConfigSistema(sanitizarConfigSistema(snap.exists() ? snap.data() : CONFIG_SISTEMA_PADRAO));
      },
      (error) => {
        console.error(error);
      }
    );

    return () => unsubConfig();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubEmpresa = onSnapshot(doc(db, 'empresas', user.uid), (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();
      setDadosLoja(data);
      if (data.escala) setEscala(data.escala);
      setShowBannerNovidade(!data.slogan);
    });

    const identificadoresLoja = idsDaLoja(lojaId, user.uid);

    const unsubServ = onSnapshot(query(collection(db, 'servicos'), where('lojaId', 'in', identificadoresLoja)), (snap) => {
      setServicos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubProfissionais = onSnapshot(query(collection(db, 'profissionais'), where('lojaId', 'in', identificadoresLoja)), (snap) => {
      setProfissionais(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubAgend = onSnapshot(query(collection(db, 'agendamentos'), where('lojaId', '==', lojaId), orderBy('data', 'desc')), (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgendamentos(lista);
      const totalConfirmado = lista
        .filter((ag) => ag.status === 'concluido')
        .reduce((acc, curr) => acc + (Number(curr.preco) || 0), 0);
      setFinanceiro({ hoje: totalConfirmado });
    });

    const unsubGal = onSnapshot(query(collection(db, 'galeria'), where('lojaId', 'in', identificadoresLoja)), (snap) => {
      setFotos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubPacotes = onSnapshot(query(collection(db, 'pacotes'), where('lojaId', 'in', identificadoresLoja)), (snap) => {
      setPacotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubAvaliacoes = onSnapshot(
      query(collection(db, 'avaliacoes'), where('lojaId', '==', lojaId), orderBy('criadoEm', 'desc')),
      (snap) => setAvaliacoes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );

    return () => {
      unsubEmpresa();
      unsubServ();
      unsubProfissionais();
      unsubAgend();
      unsubGal();
      unsubPacotes();
      unsubAvaliacoes();
    };
  }, [lojaId, user]);

  const verificarAcesso = () => {
    if (isSuperAdmin(user)) return { ok: true, dias: 999, teste: false };
    return calcularAcessoAgenda(dadosLoja, configSistema.diasTesteGratis || CONFIG_SISTEMA_PADRAO.diasTesteGratis);
  };

  const acesso = verificarAcesso();

  const agendamentosPendentes = useMemo(
    () => agendamentos.filter((ag) => !ag.status || ag.status === 'pendente' || ag.status === 'confirmado'),
    [agendamentos]
  );

  const concluidos = useMemo(
    () => agendamentos.filter((ag) => ag.status === 'concluido').length,
    [agendamentos]
  );

  const dadosGrafico = useMemo(() => {
    return agendamentos
      .filter((ag) => ag.status === 'concluido' && ag.data)
      .reduce((acc, curr) => {
        const dia = curr.data.split('-').reverse().slice(0, 2).join('/');
        const existe = acc.find((i) => i.name === dia);
        if (existe) existe.valor += Number(curr.preco) || 0;
        else acc.push({ name: dia, valor: Number(curr.preco) || 0 });
        return acc;
      }, [])
      .slice(-7);
  }, [agendamentos]);

  const receitaPorProfissional = useMemo(() => {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    
    const receitaMap = {};
    agendamentos.forEach(ag => {
      if (ag.status === 'concluido' && ag.data && ag.data.startsWith(mesAtual)) {
        const nome = ag.profissionalNome || 'Sem profissional';
        const preco = Number(ag.preco) || 0;
        if (!receitaMap[nome]) receitaMap[nome] = 0;
        receitaMap[nome] += preco;
      }
    });

    return Object.entries(receitaMap)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);
  }, [agendamentos]);

  const paginaPublica = useMemo(() => {
    const texto = (valor) => String(valor || '').trim();
    const whatsappLimpo = String(dadosLoja?.whatsapp || '').replace(/\D/g, '');
    const temHorarioAtivo = Object.values(escala || {}).some(
      (dia) => dia?.ativo && dia?.inicio && dia?.fim && dia.inicio < dia.fim
    );
    const temBanner = fotos.some((foto) => foto.tipo === 'topo');
    const temPortfolio = fotos.some((foto) => foto.tipo === 'portfolio');
    const servicosCompletos = servicos.length > 0 && servicos.every(
      (servico) => texto(servico.nome) && Number(servico.preco) > 0 && texto(servico.tempo)
    );

    const criterios = [
      {
        id: 'nome',
        label: 'Nome da agenda',
        detalhe: 'Aparece no topo do link público.',
        peso: 10,
        pronto: Boolean(texto(dadosLoja?.nomeLoja || dadosLoja?.nomeEmpresa)),
        aba: 'perfil',
      },
      {
        id: 'whatsapp',
        label: 'WhatsApp de atendimento',
        detalhe: 'Usado para confirmar reservas.',
        peso: 10,
        pronto: whatsappLimpo.length >= 10,
        aba: 'perfil',
      },
      {
        id: 'slogan',
        label: 'Slogan curto',
        detalhe: 'Explica a proposta da página.',
        peso: 10,
        pronto: Boolean(texto(dadosLoja?.slogan)),
        aba: 'perfil',
      },
      {
        id: 'servicos',
        label: 'Pelo menos um serviço',
        detalhe: 'Sem serviço, ninguém consegue agendar.',
        peso: 18,
        pronto: servicos.length > 0,
        aba: 'servicos',
      },
      {
        id: 'servicos-completos',
        label: 'Serviços com preço e duração',
        detalhe: 'Evita reservas confusas.',
        peso: 7,
        pronto: servicosCompletos,
        aba: 'servicos',
      },
      {
        id: 'horarios',
        label: 'Dias e horários ativos',
        detalhe: 'Define quando o cliente pode marcar.',
        peso: 15,
        pronto: temHorarioAtivo,
        aba: 'horarios',
      },
      {
        id: 'banner',
        label: 'Banner da página',
        detalhe: 'Deixa o primeiro impacto mais profissional.',
        peso: 10,
        pronto: temBanner,
        aba: 'galeria',
      },
      {
        id: 'portfolio',
        label: 'Galeria ou portfólio',
        detalhe: 'Mostra fotos para gerar confiança.',
        peso: 8,
        pronto: temPortfolio,
        aba: 'galeria',
      },
      {
        id: 'logo',
        label: 'Logo ou imagem da marca',
        detalhe: 'Ajuda o cliente a reconhecer a empresa.',
        peso: 7,
        pronto: Boolean(texto(dadosLoja?.logoUrl)),
        aba: 'perfil',
      },
      {
        id: 'pix',
        label: 'Chave PIX',
        detalhe: 'Facilita sinal ou pagamento antecipado.',
        peso: 5,
        pronto: Boolean(texto(dadosLoja?.chavePix)),
        aba: 'perfil',
      },
    ];

    const percentual = Math.min(
      100,
      Math.round(criterios.reduce((total, item) => total + (item.pronto ? item.peso : 0), 0))
    );
    const pendentes = criterios.filter((item) => !item.pronto);

    return {
      criterios,
      pendentes,
      percentual,
      liberado: percentual >= MINIMO_PUBLICACAO,
      proximo: pendentes[0],
    };
  }, [dadosLoja, escala, fotos, servicos]);

  const formatarWhatsAppVisual = (valor) => {
    if (!valor) return '';
    const n = valor.replace(/\D/g, '');
    if (n.length <= 2) return `(${n}`;
    if (n.length <= 6) return `(${n.substring(0, 2)}) ${n.substring(2)}`;
    if (n.length <= 10) return `(${n.substring(0, 2)}) ${n.substring(2, 6)}-${n.substring(6)}`;
    return `(${n.substring(0, 2)}) ${n.substring(2, 7)}-${n.substring(7, 11)}`;
  };

  const atualizarPerfil = async (campo, valor) => {
    try {
      await setDoc(doc(db, 'empresas', user.uid), { [campo]: valor, uid: user.uid, ultimaAlteracao: serverTimestamp() }, { merge: true });
      toast.success('Salvo!');
    } catch (e) {
      toast.error('Erro ao salvar');
    }
  };

  const salvarEscala = async (novaEscala) => {
    try {
      await setDoc(doc(db, 'empresas', user.uid), { escala: novaEscala }, { merge: true });
      setEscala(novaEscala);
      toast.success('Horários salvos!');
    } catch (e) {
      toast.error('Erro ao salvar horários');
    }
  };

  const addBloqueioLoja = async (dataStr) => {
    if (!dataStr) return;
    const bloqueios = dadosLoja?.bloqueios || [];
    if (!bloqueios.includes(dataStr)) {
      await atualizarPerfil('bloqueios', [...bloqueios, dataStr].sort());
    }
  };

  const removerBloqueioLoja = async (dataStr) => {
    const bloqueios = dadosLoja?.bloqueios || [];
    await atualizarPerfil('bloqueios', bloqueios.filter(d => d !== dataStr));
  };

  const addBloqueioProfissional = async (prof, dataStr) => {
    if (!dataStr) return;
    const bloqueios = prof.bloqueios || [];
    if (!bloqueios.includes(dataStr)) {
      try {
        await setDoc(doc(db, 'profissionais', prof.id), { bloqueios: [...bloqueios, dataStr].sort() }, { merge: true });
        toast.success('Data bloqueada!');
      } catch (e) {
        toast.error('Erro ao bloquear data');
      }
    }
  };

  const removerBloqueioProfissional = async (prof, dataStr) => {
    const bloqueios = prof.bloqueios || [];
    try {
      await setDoc(doc(db, 'profissionais', prof.id), { bloqueios: bloqueios.filter(d => d !== dataStr) }, { merge: true });
    } catch (e) {
      toast.error('Erro ao remover bloqueio');
    }
  };

  const mudarStatusAgendamento = async (ag, novoStatus) => {
    try {
      await setDoc(doc(db, 'agendamentos', ag.id), { status: novoStatus }, { merge: true });

      if (novoStatus === 'concluido') {
        const fidRef = doc(db, 'fidelidade', `${lojaId}_${ag.clienteUid}`);
        const snapFid = await getDoc(fidRef);
        if (snapFid.exists()) {
          await updateDoc(fidRef, { pontos: (snapFid.data().pontos || 0) + 1, ultimoServico: serverTimestamp() });
        } else {
          await setDoc(fidRef, { clienteUid: ag.clienteUid, clienteNome: ag.clienteNome, lojaId, pontos: 1 });
        }
        toast.success('Agendamento concluído!');
      }
    } catch (e) {
      toast.error('Erro ao atualizar.');
    }
  };

  const enviarLembrete = (ag) => {
    const numLimpo = ag.clienteWhatsapp?.replace(/\D/g, '');
    if (!numLimpo) return toast.error('WhatsApp não cadastrado!');
    const numFinal = numLimpo.startsWith('55') ? numLimpo : `55${numLimpo}`;
    const msg = encodeURIComponent(`Olá ${ag.clienteNome}! Confirmando seu horário às ${ag.horario}.`);
    window.open(`https://wa.me/${numFinal}?text=${msg}`, '_blank');
  };

  const handleAddServico = async () => {
    if (!novoNomeS || !novoPrecoS || !novoTempoS) return toast.error('Preencha tudo!');
    
    const categoriaFormatada = novaCategoriaS ? novaCategoriaS.trim().charAt(0).toUpperCase() + novaCategoriaS.trim().slice(1) : '';

    let fotoUrl = null;
    if (fotoSelecionadaServico) {
      if (!fotoSelecionadaServico.type.startsWith('image/')) return toast.error('Envie um arquivo de imagem.');
      setEnviandoFotoServico(true);
      setProgressoFotoServico(1);
      try {
        const imagemOtimizada = await comprimirImagemParaDataUrl(fotoSelecionadaServico, {
          maxWidth: 600, maxHeight: 600, quality: 0.75, maxBytes: 250 * 1024,
        }, setProgressoFotoServico);
        fotoUrl = imagemOtimizada.dataUrl;
      } catch (e) {
        toast.error('Erro ao processar imagem do serviço.');
        setEnviandoFotoServico(false);
        return;
      }
    }

    try {
      await addDoc(collection(db, 'servicos'), {
        nome: novoNomeS,
        preco: Number(novoPrecoS),
        tempo: `${novoTempoS} ${unidadeTempo}`,
        categoria: categoriaFormatada,
        fotoUrl,
        lojaId,
      });
      setModalNovoServico(false);
      setNovoNomeS('');
      setNovoPrecoS('');
      setNovoTempoS('');
      setNovaCategoriaS('');
      setFotoSelecionadaServico(null);
      toast.success('Serviço salvo!');
    } catch (e) {
      toast.error('Erro ao salvar serviço');
    } finally {
      setEnviandoFotoServico(false);
      setProgressoFotoServico(0);
    }
  };

  const handleAddProfissional = async () => {
    if (!novoNomeP) return toast.error('Preencha o nome do profissional!');
    
    let fotoUrl = null;
    if (fotoSelecionadaProfissional) {
      if (!fotoSelecionadaProfissional.type.startsWith('image/')) return toast.error('Envie um arquivo de imagem.');
      setEnviandoFotoProfissional(true);
      setProgressoFotoProfissional(1);
      try {
        const imagemOtimizada = await comprimirImagemParaDataUrl(fotoSelecionadaProfissional, {
          maxWidth: 600, maxHeight: 600, quality: 0.75, maxBytes: 250 * 1024,
        }, setProgressoFotoProfissional);
        fotoUrl = imagemOtimizada.dataUrl;
      } catch (e) {
        toast.error('Erro ao processar imagem do profissional.');
        setEnviandoFotoProfissional(false);
        return;
      }
    }

    try {
      await addDoc(collection(db, 'profissionais'), {
        nome: novoNomeP,
        biografia: novaBioP,
        emailVinculado: novoEmailP.trim().toLowerCase(),
        fotoUrl,
        lojaId,
        escala: {
          seg: { ativo: true, inicio: '08:00', fim: '18:00' },
          ter: { ativo: true, inicio: '08:00', fim: '18:00' },
          qua: { ativo: true, inicio: '08:00', fim: '18:00' },
          qui: { ativo: true, inicio: '08:00', fim: '18:00' },
          sex: { ativo: true, inicio: '08:00', fim: '18:00' },
          sab: { ativo: true, inicio: '08:00', fim: '14:00' },
          dom: { ativo: false, inicio: '00:00', fim: '00:00' },
        },
        criadoEm: serverTimestamp()
      });
      setModalNovoProfissional(false);
      setNovoNomeP('');
      setNovaBioP('');
      setNovoEmailP('');
      setFotoSelecionadaProfissional(null);
      toast.success('Profissional salvo!');
    } catch (e) {
      toast.error('Erro ao salvar profissional');
    } finally {
      setEnviandoFotoProfissional(false);
      setProgressoFotoProfissional(0);
    }
  };

  const salvarEscalaProfissional = async (profId, novaEscala) => {
    try {
      await setDoc(doc(db, 'profissionais', profId), { escala: novaEscala }, { merge: true });
      toast.success('Horários salvos!');
    } catch (e) {
      toast.error('Erro ao salvar horários');
    }
  };

  const handleAddFoto = async (tipo) => {
    if (!fotoSelecionada) return toast.error('Selecione uma imagem.');
    if (!fotoSelecionada.type.startsWith('image/')) return toast.error('Envie um arquivo de imagem.');
    if (fotoSelecionada.size > 15 * 1024 * 1024) return toast.error('A imagem precisa ter até 15 MB.');

    setEnviandoFoto(true);
    setProgressoFoto(1);
    try {
      const imagemOtimizada = await comprimirImagemParaDataUrl(fotoSelecionada, {
        maxWidth: tipo === 'topo' ? 1800 : 1200,
        maxHeight: tipo === 'topo' ? 900 : 1200,
        quality: tipo === 'topo' ? 0.76 : 0.72,
        maxBytes: tipo === 'topo' ? 700 * 1024 : 560 * 1024,
      }, setProgressoFoto);

      const lojaRefs = idsDaLoja(lojaId, user.uid, dadosLoja?.slug, dadosLoja?.lojaId, dadosLoja?.uid, dadosLoja?.donoUid);

      await addDoc(collection(db, 'galeria'), {
        url: imagemOtimizada.dataUrl,
        lojaId,
        lojaUid: user.uid,
        lojaSlug: dadosLoja?.slug || lojaId,
        lojaRefs,
        tipo,
        armazenamento: 'firestore-data-url',
        nomeArquivo: fotoSelecionada.name,
        tamanhoOriginal: fotoSelecionada.size,
        tamanhoOtimizado: imagemOtimizada.bytes,
        criadoEm: serverTimestamp(),
      });

      setFotoSelecionada(null);
      setProgressoFoto(100);
      const economia = Math.max(0, Math.round((1 - (imagemOtimizada.bytes / fotoSelecionada.size)) * 100));
      toast.success(economia > 0 ? `Imagem salva (${economia}% menor).` : 'Imagem salva!');
    } catch (e) {
      console.error(e);
      toast.error(mensagemErroUpload(e));
    } finally {
      setEnviandoFoto(false);
      setProgressoFoto(0);
    }
  };

  const inscreverPushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return toast.error('Seu navegador ou dispositivo não suporta notificações Push.');
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return toast.error('Permissão de notificação negada. Ative as permissões nas configurações do seu navegador.');
      }

      const registration = await navigator.serviceWorker.ready;
      
      const VAPID_PUBLIC_KEY = 'BLmKkP-F1GSkIk9jli9iUrG0WfP_plCbgZMfpn8BOEJePwPshGmqJyiOag46NymDuFt9QNxNDgc7svBNHxhs1CA';
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const subId = btoa(subscription.endpoint).substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');

      await setDoc(doc(db, 'push_subscriptions', subId), {
        subscription: subscription.toJSON(),
        lojaId,
        uid: user.uid,
        criadoEm: serverTimestamp()
      });

      toast.success('Notificações ativadas com sucesso neste aparelho!');
    } catch (err) {
      console.error('Erro ao inscrever push:', err);
      toast.error('Erro ao ativar notificações. Certifique-se de que o site está rodando via HTTPS ou localhost.');
    }
  };

  const handleUploadLogo = async () => {
    if (!logoSelecionada) return toast.error('Selecione uma logo.');
    if (!logoSelecionada.type.startsWith('image/')) return toast.error('Envie um arquivo de imagem.');
    if (logoSelecionada.size > 10 * 1024 * 1024) return toast.error('A logo precisa ter até 10 MB.');

    setEnviandoLogo(true);
    setProgressoLogo(1);
    try {
      const imagemOtimizada = await comprimirImagemParaDataUrl(logoSelecionada, {
        maxWidth: 700,
        maxHeight: 700,
        quality: 0.78,
        maxBytes: 280 * 1024,
      }, setProgressoLogo);

      await setDoc(doc(db, 'empresas', user.uid), {
        logoUrl: imagemOtimizada.dataUrl,
        logoArmazenamento: 'firestore-data-url',
        logoTamanhoOriginal: logoSelecionada.size,
        logoTamanhoOtimizado: imagemOtimizada.bytes,
        ultimaAlteracao: serverTimestamp(),
      }, { merge: true });

      setLogoSelecionada(null);
      setProgressoLogo(100);
      const economia = Math.max(0, Math.round((1 - (imagemOtimizada.bytes / logoSelecionada.size)) * 100));
      toast.success(economia > 0 ? `Logo salva (${economia}% menor).` : 'Logo atualizada!');
    } catch (e) {
      console.error(e);
      toast.error(mensagemErroUpload(e));
    } finally {
      setEnviandoLogo(false);
      setProgressoLogo(0);
    }
  };

  const deletarDocSilencioso = async (colecao, id) => {
    try {
      await deleteDoc(doc(db, colecao, id));
      toast.success('Removido!');
    } catch (e) {
      toast.error('Erro ao remover');
    }
  };

  const handleGerarPagamento = async () => {
    setGerandoPix(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/create-pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          uid: user.uid,
          email: user?.email,
          firstName: dadosLoja?.nomeDono || 'Usuario',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erro ao gerar PIX');

      if (data.id) {
        setPixDados({
          id: data.id,
          qrCode: data.qrCode,
          qrCodeBase64: data.qrCodeBase64,
          plano: data.plano,
        });

        const interval = setInterval(async () => {
          try {
            const check = await fetch('/api/check-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId: data.id }),
            });
            const res = await check.json();
            if (res.status === 'approved') {
              clearInterval(interval);
              const planoPago = res.plano || data.plano || planoAtual;
              const dataExpira = new Date();
              dataExpira.setDate(dataExpira.getDate() + Number(planoPago.dias || planoAtual.dias || 30));
              await setDoc(doc(db, 'empresas', user.uid), {
                planoAtivo: true,
                expiraEm: dataExpira.toISOString(),
                expiraEmData: dataExpira,
                status: 'ativo',
                planoAtual: {
                  nome: planoPago.nome || planoAtual.nome,
                  valor: Number(planoPago.valor || planoAtual.valor),
                  dias: Number(planoPago.dias || planoAtual.dias),
                },
                ultimoPagamentoId: data.id,
                ultimaAlteracao: serverTimestamp(),
              }, { merge: true });
              toast.success('Pagamento confirmado!');
              setPixDados(null);
            }
          } catch (err) {
            console.error(err);
          }
        }, 5000);
      }
    } catch (e) {
      toast.error('Erro ao gerar PIX');
    } finally {
      setGerandoPix(false);
    }
  };

  const orientarPaginaIncompleta = () => {
    const faltando = paginaPublica.proximo?.label || 'finalizar as pendências';
    if (paginaPublica.proximo?.aba) setAbaAtiva(paginaPublica.proximo.aba);
    toast.error(`Página ${paginaPublica.percentual}% pronta. Finalize pelo menos ${MINIMO_PUBLICACAO}% antes de postar o link. Falta: ${faltando}.`);
  };

  const copiarLink = async () => {
    if (!paginaPublica.liberado) {
      orientarPaginaIncompleta();
      return;
    }

    await navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado!');
  };

  const compartilharLink = async () => {
    if (!paginaPublica.liberado) {
      orientarPaginaIncompleta();
      return;
    }

    const dadosCompartilhar = {
      title: nomeAgenda,
      text: `Agende seu horário em ${nomeAgenda}`,
      url: publicUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(dadosCompartilhar);
        toast.success('Link pronto para postar!');
      } else {
        await navigator.clipboard.writeText(publicUrl);
        toast.success('Link copiado para postar!');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') toast.error('Não deu para compartilhar agora.');
    }
  };

  if (dadosLoja && !acesso.ok) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] p-4 text-slate-950 font-sans grid place-items-center">
        <Toaster position="top-center" />
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_25px_80px_rgba(15,23,42,0.10)]">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-red-50 text-red-500 ring-8 ring-red-50/70">
            <Wallet size={38} />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-red-500">Acesso expirado</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Ative sua licença</h1>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-500">Sua licença AgendaLink expirou. Ative agora para continuar gerenciando sua agenda.</p>

          {!pixDados ? (
            <div className="mt-7 space-y-4">
              <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-4 text-left">
                <p className="text-xs font-black uppercase tracking-widest text-indigo-600">{planoAtual.nome}</p>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-3xl font-black tracking-tight text-slate-950">{formatarMoeda(planoAtual.valor)}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-indigo-700">{planoAtual.destaque}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                    {planoAtual.dias} dias
                  </span>
                </div>
              </div>

              <button onClick={handleGerarPagamento} disabled={gerandoPix} className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95 disabled:opacity-60">
                {gerandoPix ? 'Gerando PIX...' : `Ativar licença - ${formatarMoeda(planoAtual.valor)}`}
              </button>
            </div>
          ) : (
            <div className="mt-7 space-y-4">
              <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Plano escolhido</p>
                <p className="mt-1 text-lg font-black text-slate-950">
                  {pixDados.plano?.nome || planoAtual.nome} - {formatarMoeda(pixDados.plano?.valor || planoAtual.valor)}
                </p>
              </div>
              <div className="mx-auto inline-block rounded-3xl border border-slate-200 bg-white p-3">
                <img src={`data:image/jpeg;base64,${pixDados.qrCodeBase64}`} alt="QR Code" className="h-44 w-44" />
              </div>
              <button onClick={() => { navigator.clipboard.writeText(pixDados.qrCode); toast.success('Copiado!'); }} className="w-full rounded-2xl bg-indigo-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white">
                Copiar código PIX
              </button>
              <p className="text-xs font-bold text-slate-400">O sistema atualiza automaticamente após a confirmação.</p>
            </div>
          )}

          <button onClick={onSair} className="mt-6 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500">Sair da conta</button>
        </motion.div>
      </div>
    );
  }

  const renderCompletudePagina = () => (
    <div className="mt-5 rounded-3xl bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Página pública</p>
          <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{paginaPublica.percentual}% pronta</p>
        </div>
        <span className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-widest ${paginaPublica.liberado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {paginaPublica.liberado ? 'Liberado' : `Mín. ${MINIMO_PUBLICACAO}%`}
        </span>
      </div>

      <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: `${paginaPublica.percentual}%` }} />
        <span className="absolute top-0 h-full w-0.5 bg-amber-400" style={{ left: `${MINIMO_PUBLICACAO}%` }} />
      </div>

      <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
        {paginaPublica.liberado
          ? 'Pode copiar ou postar o link. Ainda dá para caprichar mais nos itens restantes.'
          : `Faltam ${Math.max(0, MINIMO_PUBLICACAO - paginaPublica.percentual)}% para liberar o link.`}
      </p>

      <div className="mt-4 grid gap-2">
        {paginaPublica.criterios.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAbaAtiva(item.aba)}
            className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-3 text-left transition-all hover:shadow-sm active:scale-[0.99]"
          >
            <span className="flex min-w-0 items-center gap-3">
              {item.pronto ? <CheckCircle size={16} className="shrink-0 text-emerald-500" /> : <XCircle size={16} className="shrink-0 text-amber-500" />}
              <span className="min-w-0">
                <span className="block truncate text-xs font-black text-slate-800">{item.label}</span>
                <span className="block truncate text-[11px] font-bold text-slate-400">{item.detalhe}</span>
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-400">{item.peso}%</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={copiarLink} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${paginaPublica.liberado ? 'bg-slate-950 text-white hover:bg-indigo-600' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}>
          <Copy size={15} /> Copiar
        </button>
        <button onClick={compartilharLink} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${paginaPublica.liberado ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}>
          <Link2 size={15} /> Postar
        </button>
      </div>
    </div>
  );

  const renderMiniTutorial = () => {
    const criterio = (id) => paginaPublica.criterios.find((item) => item.id === id)?.pronto;
    const passos = [
      {
        titulo: 'Identidade',
        texto: 'Nome, WhatsApp, slogan e logo.',
        aba: 'perfil',
        pronto: criterio('nome') && criterio('whatsapp') && criterio('slogan') && criterio('logo'),
      },
      {
        titulo: 'Agenda',
        texto: 'Dias e horários de funcionamento.',
        aba: 'horarios',
        pronto: criterio('horarios'),
      },
      {
        titulo: 'Serviços',
        texto: 'Cadastre serviços com preço e duração.',
        aba: 'servicos',
        pronto: criterio('servicos') && criterio('servicos-completos'),
      },
      {
        titulo: 'Visual',
        texto: 'Adicione banner e fotos do portfólio.',
        aba: 'galeria',
        pronto: criterio('banner') && criterio('portfolio'),
      },
      {
        titulo: 'Publicar',
        texto: 'Copie ou poste o link quando bater 80%.',
        aba: 'agenda',
        pronto: paginaPublica.liberado,
      },
    ];
    const atual = passos.find((passo) => !passo.pronto) || passos[passos.length - 1];

    return (
      <div className="mt-5 rounded-3xl border border-indigo-100 bg-indigo-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
            <PlayCircle size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-indigo-950">Mini tutorial</p>
            <p className="mt-1 text-xs font-bold leading-5 text-indigo-600">Próximo passo: {atual.titulo}</p>
          </div>
          <button onClick={() => setAbaAtiva(atual.aba)} className="rounded-2xl bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-700 shadow-sm active:scale-95">
            Abrir
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          {passos.map((passo, index) => (
            <button
              key={passo.titulo}
              onClick={() => setAbaAtiva(passo.aba)}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all active:scale-[0.99] ${passo.pronto ? 'bg-white/70' : passo.titulo === atual.titulo ? 'bg-white shadow-sm' : 'bg-white/40'}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-black ${passo.pronto ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                {passo.pronto ? <CheckCircle size={14} /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-black text-slate-900">{passo.titulo}</span>
                <span className="block truncate text-[11px] font-bold text-slate-500">{passo.texto}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderAgenda = () => (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <section className={`${cardBase} p-5 sm:p-6`}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Próximos horários</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Agenda de hoje</h2>
          </div>
          <button onClick={copiarLink} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${paginaPublica.liberado ? 'bg-slate-950 text-white hover:bg-indigo-600' : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'}`}>
            <Copy size={16} /> {paginaPublica.liberado ? 'Copiar link' : `Link ${paginaPublica.percentual}%`}
          </button>
        </div>

        {agendamentosPendentes.length === 0 ? (
          <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <div>
              <Calendar className="mx-auto mb-4 text-slate-300" size={38} />
              <h3 className="text-lg font-black text-slate-900">Nenhum agendamento pendente</h3>
              <p className="mt-2 max-w-sm text-sm font-medium text-slate-500">Compartilhe seu link público para começar a receber reservas.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {agendamentosPendentes.map((ag) => (
              <motion.div key={ag.id} layout className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white shadow-sm">
                    <span className="text-sm font-black text-slate-950">{ag.horario || '--:--'}</span>
                    {ag.status === 'confirmado' && <span className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-500">Conf</span>}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-950">{ag.clienteNome || 'Cliente'}</h3>
                    <p className="mt-1 text-sm font-bold text-slate-500">{ag.servicoNome || 'Serviço'} · R$ {Number(ag.preco || 0).toFixed(2)}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {ag.data ? ag.data.split('-').reverse().join('/') : 'Sem data'}
                      {ag.profissionalNome && ` · Com ${ag.profissionalNome}`}
                    </p>
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
              </motion.div>
            ))}
          </div>
        )}

        {(() => {
          const hojeStr = new Date().toLocaleDateString('en-CA');
          const historicoHoje = agendamentos.filter((ag) => (ag.status === 'concluido' || ag.status === 'cancelado') && ag.data === hojeStr);
          
          if (historicoHoje.length === 0) return null;
          
          return (
            <div className="mt-8">
              <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">Histórico de hoje</p>
              <div className="space-y-3 opacity-60 transition-opacity hover:opacity-100">
                {historicoHoje.map((ag) => (
                  <div key={ag.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{ag.clienteNome} <span className="text-xs font-bold text-slate-400">· {ag.horario}</span></p>
                      <p className="text-xs font-bold text-slate-500">{ag.servicoNome}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${ag.status === 'concluido' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {ag.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </section>

      <aside className={`${cardBase} p-5 sm:p-6`}>
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Link público</p>
        <div className="mt-4 rounded-3xl bg-slate-950 p-5 text-white">
          <div className="flex items-center gap-3">
            <Link2 size={18} className="text-indigo-300" />
            <p className="truncate text-sm font-bold">{publicUrl}</p>
          </div>
        </div>
        {renderCompletudePagina()}
        {renderMiniTutorial()}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-2xl font-black text-slate-950">{agendamentosPendentes.length}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Pendentes</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-2xl font-black text-slate-950">{concluidos}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Concluídos</p>
          </div>
        </div>
        {showBannerNovidade && (
          <div className="mt-5 rounded-3xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex gap-3">
              <Sparkles size={18} className="shrink-0 text-indigo-600" />
              <div>
                <p className="text-sm font-black text-indigo-950">Finalize sua página</p>
                <p className="mt-1 text-xs font-bold leading-5 text-indigo-500">Adicione slogan, logo e dados de contato nos ajustes.</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );

  const renderHorarios = () => (
    <section className={`${cardBase} p-5 sm:p-6`}>
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Funcionamento</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Dias e horários</h2>
      </div>

      <div className="grid gap-3">
        {Object.keys(escala).map((dia) => (
          <div key={dia} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={escala[dia].ativo}
                onChange={(e) => salvarEscala({ ...escala, [dia]: { ...escala[dia], ativo: e.target.checked } })}
                className="h-5 w-5 rounded-lg accent-indigo-600"
              />
              <span className="text-sm font-black text-slate-900">{diasSemana[dia]}</span>
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${escala[dia].ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                {escala[dia].ativo ? 'Aberto' : 'Fechado'}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input type="time" value={escala[dia].inicio} disabled={!escala[dia].ativo} onChange={(e) => salvarEscala({ ...escala, [dia]: { ...escala[dia], inicio: e.target.value } })} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none disabled:opacity-30" />
              <span className="text-xs font-black uppercase text-slate-400">até</span>
              <input type="time" value={escala[dia].fim} disabled={!escala[dia].ativo} onChange={(e) => salvarEscala({ ...escala, [dia]: { ...escala[dia], fim: e.target.value } })} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none disabled:opacity-30" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Exceções</p>
        <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Datas bloqueadas</h3>
        <p className="mt-1 mb-4 text-sm font-medium text-slate-500">Adicione feriados ou dias que a loja estará fechada.</p>
        
        <div className="flex gap-2 mb-4">
          <input 
            type="date" 
            id="inputBloqueioLoja"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none" 
          />
          <button 
            onClick={() => {
              const val = document.getElementById('inputBloqueioLoja').value;
              if (val) addBloqueioLoja(val);
              document.getElementById('inputBloqueioLoja').value = '';
            }}
            className="rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-600"
          >
            Bloquear
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(dadosLoja?.bloqueios || []).map((b) => (
            <div key={b} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              <span className="text-xs font-bold text-slate-700">{b.split('-').reverse().join('/')}</span>
              <button onClick={() => removerBloqueioLoja(b)} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
            </div>
          ))}
          {(!dadosLoja?.bloqueios || dadosLoja.bloqueios.length === 0) && (
            <p className="text-xs font-bold text-slate-400">Nenhuma data bloqueada.</p>
          )}
        </div>
      </div>
    </section>
  );

  const renderFinanceiro = () => (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-6">
        <section className="rounded-[28px] bg-slate-950 p-6 text-white shadow-[0_25px_80px_rgba(15,23,42,0.16)]">
          <p className="text-xs font-black uppercase tracking-widest text-white/40">Faturamento registrado</p>
          <h2 className="mt-5 text-5xl font-black tracking-tight">R$ {Number(financeiro.hoje).toFixed(2)}</h2>
          <p className="mt-3 text-sm font-medium text-white/50">Soma de todos os agendamentos concluídos.</p>
        </section>

        {profissionais.length > 0 && receitaPorProfissional.length > 0 && (
          <section className={`${cardBase} p-5 sm:p-6`}>
            <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">Receita por Profissional (Este mês)</p>
            <div className="space-y-3">
              {receitaPorProfissional.map((item, index) => (
                <div key={index} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                      <User size={14} />
                    </div>
                    <span className="text-sm font-black text-slate-900">{item.nome}</span>
                  </div>
                  <span className="text-sm font-black text-emerald-600">R$ {item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <section className={`${cardBase} p-5 sm:p-6 flex flex-col`}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Últimos dias</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Performance</h2>
          </div>
          <BarChart3 className="text-indigo-600" size={24} />
        </div>
        <div className="flex-1 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosGrafico}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
              <Tooltip cursor={{ fill: 'rgba(79, 70, 229, 0.06)' }} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', fontSize: '12px', boxShadow: '0 16px 40px rgba(15,23,42,0.12)' }} />
              <Bar dataKey="valor" radius={[12, 12, 12, 12]}>
                {dadosGrafico.map((entry, index) => <Cell key={`c-${index}`} fill={corPrincipal} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );

  const renderServicos = () => (
    <section className={`${cardBase} p-5 sm:p-6`}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Catálogo</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Serviços</h2>
        </div>
        <button onClick={() => setModalNovoServico(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95">
          <Plus size={16} /> Novo serviço
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {servicos.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex gap-4 items-center">
              {s.fotoUrl && (
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                  <img src={s.fotoUrl} alt={s.nome} className="h-full w-full object-cover" />
                </div>
              )}
              <div>
                <h3 className="text-base font-black text-slate-950">{s.nome}</h3>
                <p className="mt-2 text-2xl font-black" style={{ color: corPrincipal }}>R$ {Number(s.preco).toFixed(2)}</p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500">{s.tempo}</span>
                  {s.categoria && <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-500">{s.categoria}</span>}
                </div>
              </div>
            </div>
            <button onClick={() => deletarDocSilencioso('servicos', s.id)} className="rounded-2xl bg-white p-3 text-slate-400 transition-all hover:bg-red-50 hover:text-red-500 active:scale-95">
              <Trash2 size={19} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );

  const renderProfissionais = () => (
    <section className={`${cardBase} p-5 sm:p-6`}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Equipe</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Profissionais</h2>
        </div>
        <button onClick={() => setModalNovoProfissional(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95">
          <Plus size={16} /> Adicionar
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {profissionais.map((p) => (
          <div key={p.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-200">
                  {p.fotoUrl ? <img src={p.fotoUrl} alt={p.nome} className="h-full w-full object-cover" /> : <User className="m-auto h-full text-slate-400" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">{p.nome}</h3>
                  {p.emailVinculado && <p className="text-xs font-bold text-indigo-600 flex items-center gap-1"><Mail size={12}/> {p.emailVinculado}</p>}
                  <p className="mt-1 text-xs font-bold text-slate-500 line-clamp-2">{p.biografia}</p>
                </div>
              </div>
              <button onClick={() => deletarDocSilencioso('profissionais', p.id)} className="rounded-2xl bg-white p-3 text-slate-400 transition-all hover:bg-red-50 hover:text-red-500 active:scale-95">
                <Trash2 size={19} />
              </button>
            </div>
            
            <div className="mt-5 border-t border-slate-200 pt-5">
              <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Horários deste profissional</p>
              <div className="grid gap-2">
                {Object.keys(p.escala || {}).map((dia) => (
                  <div key={dia} className="flex items-center justify-between rounded-2xl bg-white p-3 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.escala[dia].ativo}
                        onChange={(e) => salvarEscalaProfissional(p.id, { ...p.escala, [dia]: { ...p.escala[dia], ativo: e.target.checked } })}
                        className="h-4 w-4 rounded accent-indigo-600"
                      />
                      <span className="font-bold text-slate-700">{diasSemana[dia]}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input type="time" value={p.escala[dia].inicio} disabled={!p.escala[dia].ativo} onChange={(e) => salvarEscalaProfissional(p.id, { ...p.escala, [dia]: { ...p.escala[dia], inicio: e.target.value } })} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black outline-none disabled:opacity-40" />
                      <span className="text-[10px] font-black uppercase text-slate-400">até</span>
                      <input type="time" value={p.escala[dia].fim} disabled={!p.escala[dia].ativo} onChange={(e) => salvarEscalaProfissional(p.id, { ...p.escala, [dia]: { ...p.escala[dia], fim: e.target.value } })} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black outline-none disabled:opacity-40" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Folgas / Feriados</p>
                <div className="flex gap-2 mb-3">
                  <input 
                    type="date" 
                    id={`inputBloqueio_${p.id}`}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-black text-slate-900 outline-none" 
                  />
                  <button 
                    onClick={() => {
                      const val = document.getElementById(`inputBloqueio_${p.id}`).value;
                      if (val) addBloqueioProfissional(p, val);
                      document.getElementById(`inputBloqueio_${p.id}`).value = '';
                    }}
                    className="rounded-xl bg-slate-950 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-600"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(p.bloqueios || []).map((b) => (
                    <div key={b} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
                      <span className="text-[10px] font-bold text-slate-700">{b.split('-').reverse().join('/')}</span>
                      <button onClick={() => removerBloqueioProfissional(p, b)} className="text-slate-400 hover:text-red-500"><X size={12}/></button>
                    </div>
                  ))}
                  {(!p.bloqueios || p.bloqueios.length === 0) && (
                    <p className="text-[10px] font-bold text-slate-400">Nenhuma folga marcada.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const handleAddPacote = async () => {
    if (!novoPacoteNome || !novoPacotePreco) return toast.error('Preencha nome e preço!');
    try {
      await addDoc(collection(db, 'pacotes'), {
        nome: novoPacoteNome,
        preco: Number(novoPacotePreco),
        descricao: novoPacoteDesc,
        lojaId,
        criadoEm: serverTimestamp()
      });
      setModalNovoPacote(false);
      setNovoPacoteNome('');
      setNovoPacotePreco('');
      setNovoPacoteDesc('');
      toast.success('Pacote criado!');
    } catch (e) {
      toast.error('Erro ao criar pacote');
    }
  };

  const renderPacotes = () => (
    <section className={`${cardBase} p-5 sm:p-6`}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Combos</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Pacotes de Serviços</h2>
        </div>
        <button onClick={() => setModalNovoPacote(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95">
          <Plus size={16} /> Novo Pacote
        </button>
      </div>

      {pacotes.length === 0 ? (
        <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <div>
            <Package className="mx-auto mb-4 text-slate-300" size={38} />
            <h3 className="text-lg font-black text-slate-900">Nenhum pacote cadastrado</h3>
            <p className="mt-2 text-sm font-medium text-slate-500">Crie combos promocionais de serviços para atrair mais clientes.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pacotes.map((pac) => (
            <div key={pac.id} className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-slate-50 p-5 space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-950">{pac.nome}</h3>
                {pac.descricao && <p className="mt-1 text-sm text-slate-500 font-medium">{pac.descricao}</p>}
                <p className="mt-3 text-2xl font-black text-emerald-600">R$ {Number(pac.preco).toFixed(2)}</p>
              </div>
              <div className="flex justify-end">
                <button onClick={() => deletarDocSilencioso('pacotes', pac.id)} className="rounded-2xl bg-white p-3 text-slate-400 transition-all hover:bg-red-50 hover:text-red-500 active:scale-95">
                  <Trash2 size={19} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const renderAvaliacoes = () => (
    <section className={`${cardBase} p-5 sm:p-6`}>
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Feedback</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Avaliações dos Clientes</h2>
      </div>

      {avaliacoes.length === 0 ? (
        <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <div>
            <Star className="mx-auto mb-4 text-slate-300 animate-pulse" size={38} />
            <h3 className="text-lg font-black text-slate-900">Nenhuma avaliação recebida</h3>
            <p className="mt-2 text-sm font-medium text-slate-500">As avaliações dos seus clientes aparecerão aqui assim que concluírem os serviços.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {avaliacoes.map((av) => (
            <div key={av.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-black text-slate-950">{av.clienteNome || 'Cliente Anônimo'}</h4>
                  <p className="text-xs text-slate-400">
                    {av.criadoEm?.toDate ? av.criadoEm.toDate().toLocaleDateString('pt-BR') : 'Data recente'}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star 
                      key={idx} 
                      size={14} 
                      className={idx < av.nota ? 'fill-current' : 'text-slate-300'} 
                    />
                  ))}
                </div>
              </div>
              {av.comentario && (
                <p className="text-sm font-medium text-slate-600 italic bg-white p-3 rounded-2xl border border-slate-100">
                  "{av.comentario}"
                </p>
              )}
              {av.profissionalNome && (
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
                  Atendido por: {av.profissionalNome}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const renderGaleria = () => (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr_300px]">
      <section className={`${cardBase} p-5 sm:p-6`}>
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Imagem pública</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Galeria</h2>
        <div className="mt-5 space-y-3">
          <label className="block cursor-pointer rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50/40">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFotoSelecionada(e.target.files?.[0] || null)}
              className="sr-only"
            />
            {fotoSelecionada ? (
              <div className="relative mx-auto h-32 w-full overflow-hidden rounded-2xl bg-slate-100 shadow-inner">
                <img src={URL.createObjectURL(fotoSelecionada)} className="h-full w-full object-cover" alt="Preview" />
                <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center p-2">
                  <span className="rounded-xl bg-slate-950/75 px-3 py-1.5 text-[10px] font-black text-white uppercase tracking-widest truncate max-w-full">
                    {fotoSelecionada.name}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <ImageIcon className="mx-auto mb-3 text-indigo-500" size={28} />
                <p className="text-sm font-black text-slate-900">Escolher imagem</p>
                <p className="mt-1 text-xs font-bold text-slate-500">Salva rápido: otimiza e salva direto. Até 15 MB.</p>
              </>
            )}
          </label>
          {enviandoFoto && (
            <div className="rounded-2xl bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Salvando imagem</span>
                <span>{progressoFoto}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progressoFoto}%` }} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button disabled={enviandoFoto} onClick={() => handleAddFoto('topo')} className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4 text-xs font-black uppercase tracking-widest text-indigo-700 disabled:cursor-wait disabled:opacity-60">
              {enviandoFoto ? `${progressoFoto}%` : 'Usar como banner'}
            </button>
            <button disabled={enviandoFoto} onClick={() => handleAddFoto('portfolio')} className="rounded-2xl bg-slate-950 px-4 py-4 text-xs font-black uppercase tracking-widest text-white disabled:cursor-wait disabled:opacity-60">
              {enviandoFoto ? `${progressoFoto}%` : 'Adicionar ao portfólio'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {fotos.map((foto) => (
          <div key={foto.id} className="group relative aspect-square overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <img src={foto.url} alt="Galeria" className="h-full w-full object-cover" />
            <button onClick={() => deletarDocSilencioso('galeria', foto.id)} className="absolute inset-0 flex items-center justify-center bg-red-500/80 text-white opacity-0 transition-all group-hover:opacity-100">
              <Trash2 size={26} />
            </button>
          </div>
        ))}
        {fotos.length === 0 && (
          <div className="col-span-full grid min-h-72 place-items-center rounded-[28px] border border-dashed border-slate-200 bg-white text-center">
            <div>
              <ImageIcon className="mx-auto mb-3 text-slate-300" size={34} />
              <p className="text-sm font-black text-slate-700">Nenhuma imagem adicionada</p>
            </div>
          </div>
        )}
      </section>

      {renderPhonePreview()}
    </div>
  );

  const renderPhonePreview = () => {
    const nomeLojaPreview = dadosLoja?.nomeLoja || dadosLoja?.nomeEmpresa || 'Sua Agenda';
    const sloganPreview = dadosLoja?.slogan || 'Sua página de agendamentos online.';
    const corPreview = corPrincipal;
    
    // Simula a logo selecionada localmente ou usa a do Firestore
    const logoUrlPreview = logoSelecionada 
      ? URL.createObjectURL(logoSelecionada) 
      : dadosLoja?.logoUrl;
      
    // Simula o banner selecionado localmente ou usa o do topo
    const bannerUrlPreview = (fotoSelecionada && abaAtiva === 'galeria')
      ? URL.createObjectURL(fotoSelecionada)
      : fotos.find(f => f.tipo === 'topo')?.url;
      
    const fotosPort = fotos.filter(f => f.tipo === 'portfolio');

    return (
      <aside className={`${cardBase} p-5 flex flex-col items-center justify-center shrink-0`}>
        <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Prévia do seu link em tempo real</p>
        
        {/* Celular Chassis */}
        <div className="relative mx-auto h-[530px] w-[260px] overflow-hidden rounded-[38px] border-[6px] border-slate-900 bg-[#f7f8fb] shadow-xl ring-1 ring-slate-900/5 flex flex-col">
          
          {/* Notch / Speaker */}
          <div className="absolute top-0 left-1/2 z-50 h-4 w-24 -translate-x-1/2 rounded-b-xl bg-slate-900 flex items-center justify-center">
            <div className="h-1 w-8 rounded-full bg-slate-800" />
          </div>

          {/* Celular Tela Scrollable */}
          <div className="flex-1 overflow-y-auto pt-5 px-2.5 pb-6 space-y-3 no-scrollbar" style={{ fontSize: '10px' }}>
            
            {/* Banner/Header */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm pb-3">
              <div className="relative h-16 w-full bg-slate-200">
                {bannerUrlPreview ? (
                  <img src={bannerUrlPreview} alt="Banner" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full opacity-90" style={{ background: `linear-gradient(135deg, ${corPreview} 0%, #0f172a 100%)` }} />
                )}
              </div>
              
              <div className="relative px-2 pt-6 text-center">
                {/* Logo circular */}
                <div className="absolute -top-6 left-1/2 h-12 w-12 -translate-x-1/2 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-sm">
                  {logoUrlPreview ? (
                    <img src={logoUrlPreview} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <Scissors size={18} className="m-auto h-full text-slate-400" />
                  )}
                </div>
                
                <h3 className="font-black text-slate-950 truncate text-[11px] mt-1">{nomeLojaPreview}</h3>
                <p className="mt-1 text-[8px] text-slate-400 line-clamp-2 leading-relaxed">{sloganPreview}</p>
                
                <button 
                  className="mt-2.5 w-full rounded-lg py-1.5 text-[8px] font-black uppercase tracking-widest text-white shadow-sm transition-all"
                  style={{ backgroundColor: corPreview }}
                >
                  Agendar horário
                </button>
              </div>
            </div>

            {/* Social Tabs Navigation Preview */}
            <div className="flex border-b border-slate-200 pb-px text-[8px] font-black">
              <div className="flex-1 pb-1 text-center border-b" style={{ borderColor: corPreview, color: corPreview }}>📋 Catálogo</div>
              <div className="flex-1 pb-1 text-center text-slate-400">🖼️ Galeria</div>
              <div className="flex-1 pb-1 text-center text-slate-400">📍 Sobre</div>
            </div>

            {/* Services Preview */}
            <div className="space-y-1.5">
              <p className="text-[8px] font-black text-slate-900 uppercase tracking-widest">Nossos Serviços ({servicos.length})</p>
              {servicos.slice(0, 2).map((s, idx) => (
                <div key={idx} className="rounded-lg border border-slate-100 bg-white p-2 flex items-center justify-between gap-2 shadow-sm">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {s.fotoUrl ? (
                      <img src={s.fotoUrl} alt={s.nome} className="h-6 w-6 rounded-md object-cover" />
                    ) : (
                      <div className="h-6 w-6 rounded-md bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 border border-slate-100">
                        <Scissors size={10} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 truncate text-[9px]">{s.nome}</p>
                      <p className="text-[7px] text-slate-400">{s.tempo || '30 min'}</p>
                    </div>
                  </div>
                  <p className="font-black text-[9px]" style={{ color: corPreview }}>R$ {Number(s.preco || 0).toFixed(0)}</p>
                </div>
              ))}
              {servicos.length === 0 && (
                <p className="text-center text-[8px] text-slate-400 py-2">Nenhum serviço cadastrado.</p>
              )}
            </div>

            {/* Portfolio Grid Preview (Miniature) */}
            <div className="space-y-1.5">
              <p className="text-[8px] font-black text-slate-900 uppercase tracking-widest">Portfólio ({fotosPort.length})</p>
              <div className="grid grid-cols-3 gap-1">
                {fotosPort.slice(0, 3).map((f, idx) => (
                  <div key={idx} className="aspect-square overflow-hidden rounded-md bg-slate-200">
                    <img src={f.url} alt="Portfólio" className="h-full w-full object-cover" />
                  </div>
                ))}
                {fotosPort.length === 0 && (
                  <p className="col-span-3 text-center text-[7px] text-slate-400 py-1">Nenhuma foto no portfólio.</p>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </aside>
    );
  };

  const renderPerfil = () => (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <section className={`${cardBase} p-5 sm:p-6`}>
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Página pública</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Identidade e contato</h2>
        </div>

        <div className="grid gap-5">
          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><ImageIcon size={14} /> Logo</span>
            <div className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                {logoSelecionada ? (
                  <img src={URL.createObjectURL(logoSelecionada)} className="h-full w-full object-cover" alt="Preview Logo" />
                ) : dadosLoja?.logoUrl ? (
                  <img src={dadosLoja.logoUrl} className="h-full w-full object-cover" alt="Logo" />
                ) : (
                  <ImageIcon className="text-slate-300" />
                )}
              </div>
              <label className="flex min-h-16 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50/40">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoSelecionada(e.target.files?.[0] || null)}
                  className="sr-only"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-slate-900">
                    {logoSelecionada ? logoSelecionada.name : 'Escolher arquivo da logo'}
                  </span>
                  <span className="mt-1 block text-xs font-bold text-slate-500">Salva em milissegundos: otimiza e salva direto. Até 10 MB.</span>
                </span>
              </label>
              <button
                type="button"
                onClick={handleUploadLogo}
                disabled={enviandoLogo || !logoSelecionada}
                className="rounded-2xl bg-slate-950 px-4 py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {enviandoLogo ? `${progressoLogo}%` : 'Salvar logo'}
              </button>
            </div>
            {enviandoLogo && (
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Salvando logo</span>
                  <span>{progressoLogo}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progressoLogo}%` }} />
                </div>
              </div>
            )}
          </label>

          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><Palette size={14} /> Cor principal</span>
            <div className="flex flex-wrap items-center gap-3">
              {['#4f46e5', '#0f172a', '#10b981', '#f59e0b', '#f43f5e'].map((cor) => (
                <button key={cor} onClick={() => atualizarPerfil('corPrincipal', cor)} className={`h-11 w-11 rounded-2xl border-4 transition-all ${corPrincipal === cor ? 'border-slate-950 scale-105' : 'border-white shadow-sm'}`} style={{ backgroundColor: cor }} />
              ))}
              <input type="color" value={corPrincipal} onChange={(e) => atualizarPerfil('corPrincipal', e.target.value)} className="h-11 w-11 rounded-2xl border border-slate-200 bg-white p-1" />
            </div>
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><Type size={14} /> Nome</span>
              <input defaultValue={dadosLoja?.nomeLoja} onBlur={(e) => atualizarPerfil('nomeLoja', e.target.value)} className={inputBase} placeholder="Nome da agenda" />
            </label>
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><Wallet size={14} /> Chave PIX</span>
              <input defaultValue={dadosLoja?.chavePix} onBlur={(e) => atualizarPerfil('chavePix', e.target.value)} className={inputBase} placeholder="CPF, celular, e-mail ou chave aleatória" />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><Quote size={14} /> Slogan</span>
            <input defaultValue={dadosLoja?.slogan} onBlur={(e) => atualizarPerfil('slogan', e.target.value)} className={inputBase} placeholder="Frase curta para sua página pública" />
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><MapPin size={14} /> Localização</span>
              <input defaultValue={dadosLoja?.linkMaps} onBlur={(e) => atualizarPerfil('linkMaps', e.target.value)} className={inputBase} placeholder="Link do Google Maps" />
            </label>
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><Phone size={14} /> WhatsApp</span>
              <input
                type="tel"
                value={formatarWhatsAppVisual(dadosLoja?.whatsapp)}
                onChange={(e) => setDadosLoja({ ...dadosLoja, whatsapp: e.target.value.replace(/\D/g, '') })}
                onBlur={(e) => atualizarPerfil('whatsapp', e.target.value.replace(/\D/g, ''))}
                className={inputBase}
                placeholder="(00) 00000-0000"
              />
            </label>
          </div>

          {/* App & Notificações */}
          <div className="border-t border-slate-200 pt-5 mt-4 space-y-4">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
              <Mail size={14} className="text-indigo-600 animate-pulse" /> App e Notificações
            </span>
            <p className="text-xs text-slate-500 font-bold">Instale o aplicativo no seu celular e ative as notificações para receber avisos instantâneos de novos agendamentos.</p>

            <InstallAppButton />

            <button
              onClick={inscreverPushNotifications}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-xs font-black uppercase tracking-widest text-indigo-700 active:scale-95 transition-all hover:bg-indigo-100"
            >
              🔔 Ativar Notificações neste Aparelho
            </button>
          </div>
        </div>
      </section>

      {renderPhonePreview()}
    </div>
  );

  const renderConteudo = () => {
    if (abaAtiva === 'horarios') return renderHorarios();
    if (abaAtiva === 'financeiro') return renderFinanceiro();
    if (abaAtiva === 'servicos') return renderServicos();
    if (abaAtiva === 'pacotes') return renderPacotes();
    if (abaAtiva === 'profissionais') return renderProfissionais();
    if (abaAtiva === 'avaliacoes') return renderAvaliacoes();
    if (abaAtiva === 'galeria') return renderGaleria();
    if (abaAtiva === 'perfil') return renderPerfil();
    return renderAgenda();
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-950 font-sans">
      <Toaster position="top-center" />

      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white/90 px-5 py-6 lg:block">
          <div className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 text-white shadow-xl shadow-slate-200">
                {dadosLoja?.logoUrl ? <img src={dadosLoja.logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <Calendar size={22} />}
              </div>
              <div>
                <p className="text-lg font-black tracking-tight">AgendaLink</p>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Admin premium</p>
              </div>
            </div>

            <nav className="mt-8 space-y-2">
              {abas.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setAbaAtiva(id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition-all ${abaAtiva === id ? 'bg-slate-950 text-white shadow-lg shadow-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'}`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </nav>

            <div className="mt-auto rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Licença</p>
              <p className={`mt-2 text-sm font-black ${acesso.teste ? 'text-amber-600' : 'text-emerald-600'}`}>
                {acesso.teste ? `${acesso.dias} dias de teste` : `${acesso.dias} dias restantes`}
              </p>
              <button onClick={onSair} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-red-500 transition-all hover:bg-red-50 active:scale-95">
                <LogOut size={15} /> Sair
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">

          {/* Banner de Novidades */}
          <AnimatePresence>
            {showBannerNovidade && (
              <motion.div
                initial={{ opacity: 0, y: -16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="mb-6 overflow-hidden rounded-[28px] border border-indigo-200 bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900 p-5 text-white shadow-[0_20px_60px_rgba(79,70,229,0.25)]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-indigo-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]">🚀 Novidades</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Pacote Enterprise</span>
                    </div>
                    <h2 className="mt-3 text-xl font-black tracking-tight">Seu AgendaLink ficou muito mais completo!</h2>
                    <p className="mt-1 text-sm font-medium text-white/60">5 funcionalidades novas foram adicionadas ao seu painel.</p>
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        ['🤖', 'IA Copilot', 'Assistente inteligente no canto inferior direito'],
                        ['📦', 'Pacotes / Combos', 'Crie combos promocionais de serviços'],
                        ['⭐', 'Avaliações', 'Clientes avaliam após o atendimento'],
                        ['👤', 'Painel da Equipe', 'Login exclusivo para cada profissional'],
                        ['🔐', 'Área do Cliente', 'Histórico, fidelidade e cancelamento'],
                      ].map(([icon, titulo, desc]) => (
                        <div key={titulo} className="flex items-start gap-3 rounded-2xl bg-white/5 px-3 py-2.5">
                          <span className="text-base">{icon}</span>
                          <div>
                            <p className="text-xs font-black text-white">{titulo}</p>
                            <p className="text-[10px] font-bold text-white/50">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      localStorage.setItem('agendaLink_novidade_v3', 'visto');
                      setShowBannerNovidade(false);
                    }}
                    className="flex shrink-0 items-center gap-2 self-start rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-white/20 active:scale-95"
                  >
                    <X size={14} /> Dispensar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)] lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Painel administrativo</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">{nomeAgenda}</h1>
              <p className="mt-2 text-sm font-medium text-slate-500">Gerencie agenda, horários, serviços e página pública em um só lugar.</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={copiarLink} className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${paginaPublica.liberado ? 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                <Copy size={16} /> {paginaPublica.liberado ? 'Link' : `${paginaPublica.percentual}%`}
              </button>
              <button onClick={onSair} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-red-500 active:scale-95 lg:hidden">
                <LogOut size={16} /> Sair
              </button>
            </div>
          </header>

          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden">
            {abas.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setAbaAtiva(id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === id ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-500'}`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-5">
            {[
              ['Pendentes', agendamentosPendentes.length, Calendar],
              ['Serviços', servicos.length, Scissors],
              ['Concluídos', concluidos, CheckCircle],
              ['Receita', `R$ ${Number(financeiro.hoje).toFixed(0)}`, DollarSign],
              ['Página', `${paginaPublica.percentual}%`, Link2],
            ].map(([label, value, Icon]) => (
              <div key={label} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <Icon size={18} className="text-indigo-600" />
                <p className="mt-4 text-2xl font-black text-slate-950">{value}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={abaAtiva} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              {renderConteudo()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {modalNovoServico && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }} className="w-full max-w-xl rounded-[32px] bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.24)]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Catálogo</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Novo serviço</h2>
                </div>
                <button onClick={() => setModalNovoServico(false)} className="rounded-2xl bg-slate-50 p-3 text-slate-400 hover:text-slate-900">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <input value={novoNomeS} onChange={(e) => setNovoNomeS(e.target.value)} placeholder="Nome do serviço" className={inputBase} />
                <input value={novaCategoriaS} onChange={(e) => setNovaCategoriaS(e.target.value)} placeholder="Categoria (ex: Cabelo, Barba, Unhas)" className={inputBase} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <input value={novoPrecoS} onChange={(e) => setNovoPrecoS(e.target.value)} type="number" placeholder="Preço (R$)" className={inputBase} />
                  <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-indigo-500">
                    <input value={novoTempoS} onChange={(e) => setNovoTempoS(e.target.value)} type="number" placeholder="Tempo" className="w-full bg-transparent px-4 py-4 text-sm font-bold text-slate-900 outline-none" />
                    <select value={unidadeTempo} onChange={(e) => setUnidadeTempo(e.target.value)} className="border-l border-slate-200 bg-white px-4 text-xs font-black uppercase text-slate-500 outline-none">
                      <option value="min">Min</option>
                      <option value="h">Horas</option>
                    </select>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-500 transition-all hover:bg-indigo-50/50">
                  <input type="file" accept="image/*" onChange={(e) => setFotoSelecionadaServico(e.target.files?.[0] || null)} className="sr-only" />
                  {fotoSelecionadaServico ? (
                    <div className="flex items-center gap-3">
                      <img src={URL.createObjectURL(fotoSelecionadaServico)} alt="Preview" className="h-10 w-10 rounded-lg object-cover" />
                      <span className="text-slate-900">{fotoSelecionadaServico.name}</span>
                    </div>
                  ) : (
                    <>
                      <ImageIcon size={18} />
                      Adicionar foto (opcional)
                    </>
                  )}
                </label>
                <button disabled={enviandoFotoServico} onClick={handleAddServico} className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95 disabled:opacity-50">
                  {enviandoFotoServico ? `${progressoFotoServico}% Salvando...` : 'Salvar serviço'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {modalNovoProfissional && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }} className="w-full max-w-xl rounded-[32px] bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.24)]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Equipe</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Novo profissional</h2>
                </div>
                <button onClick={() => setModalNovoProfissional(false)} className="rounded-2xl bg-slate-50 p-3 text-slate-400 hover:text-slate-900">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <input value={novoNomeP} onChange={(e) => setNovoNomeP(e.target.value)} placeholder="Nome do profissional" className={inputBase} />
                <input value={novoEmailP} onChange={(e) => setNovoEmailP(e.target.value)} type="email" placeholder="E-mail (Para login Google da equipe)" className={inputBase} />
                <textarea value={novaBioP} onChange={(e) => setNovaBioP(e.target.value)} placeholder="Biografia ou especialidade" rows={3} className={`${inputBase} resize-none`} />
                
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-500 transition-all hover:bg-indigo-50/50">
                  <input type="file" accept="image/*" onChange={(e) => setFotoSelecionadaProfissional(e.target.files?.[0] || null)} className="sr-only" />
                  {fotoSelecionadaProfissional ? (
                    <div className="flex items-center gap-3">
                      <img src={URL.createObjectURL(fotoSelecionadaProfissional)} alt="Preview" className="h-10 w-10 rounded-lg object-cover" />
                      <span className="text-slate-900">{fotoSelecionadaProfissional.name}</span>
                    </div>
                  ) : (
                    <>
                      <ImageIcon size={18} />
                      Adicionar foto
                    </>
                  )}
                </label>
                <button disabled={enviandoFotoProfissional} onClick={handleAddProfissional} className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95 disabled:opacity-50">
                  {enviandoFotoProfissional ? `${progressoFotoProfissional}% Salvando...` : 'Salvar profissional'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal Novo Pacote */}
        {modalNovoPacote && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }} className="w-full max-w-xl rounded-[32px] bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.24)]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Combos</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Novo pacote</h2>
                </div>
                <button onClick={() => setModalNovoPacote(false)} className="rounded-2xl bg-slate-50 p-3 text-slate-400 hover:text-slate-900">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <input value={novoPacoteNome} onChange={(e) => setNovoPacoteNome(e.target.value)} placeholder="Nome do pacote (ex: Corte + Barba)" className={inputBase} />
                <input value={novoPacotePreco} onChange={(e) => setNovoPacotePreco(e.target.value)} type="number" placeholder="Preço (R$)" className={inputBase} />
                <textarea value={novoPacoteDesc} onChange={(e) => setNovoPacoteDesc(e.target.value)} placeholder="Descrição do que está incluso" rows={3} className={`${inputBase} resize-none`} />
                <button onClick={handleAddPacote} className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 active:scale-95">
                  Salvar Pacote
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* <AiAssistant 
        contexto={JSON.stringify({ 
          nomeLoja: dadosLoja?.nomeLoja, 
          whatsapp: dadosLoja?.whatsapp, 
          servicos, 
          pacotes,
          profissionais: profissionais.map(p => ({ nome: p.nome, email: p.emailVinculado })),
          faturamentoHoje: financeiro.hoje, 
          agendamentosHoje: agendamentos.filter(a => a.data === new Date().toLocaleDateString('en-CA')).map(a => ({ cliente: a.clienteNome, horario: a.horario, servico: a.servicoNome, profissional: a.profissionalNome, status: a.status }))
        })} 
      /> */}
      {/* Banner de Instalação PWA */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="fixed bottom-5 left-4 right-4 z-[100] mx-auto max-w-sm"
          >
            <div className="flex items-center gap-4 rounded-[24px] bg-slate-950 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-2xl shadow-lg">
                📲
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-indigo-300">AgendaLink App</p>
                <p className="mt-0.5 text-sm font-bold text-white leading-snug">Instale o app no seu celular!</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Acesso rápido + notificações</p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={handleInstallClick}
                  className="rounded-xl bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95 hover:bg-indigo-500"
                >
                  Instalar
                </button>
                <button
                  onClick={() => setShowInstallBanner(false)}
                  className="rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all active:scale-95 hover:bg-white/20"
                >
                  Agora não
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Admin;
