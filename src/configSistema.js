export const CONFIG_SISTEMA_PADRAO = {
  diasTesteGratis: 7,
  plano: {
    nome: 'Licenca AgendaLink',
    valor: 50,
    dias: 30,
    destaque: 'Acesso completo ao painel, agenda e pagina publica.',
  },
};

const numeroSeguro = (valor, fallback, min = 0, max = 99999) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return fallback;
  return Math.min(max, Math.max(min, numero));
};

export const sanitizarConfigSistema = (config = {}) => {
  const planoRecebido = config.plano || {};
  const planoPadrao = CONFIG_SISTEMA_PADRAO.plano;

  return {
    diasTesteGratis: Math.round(numeroSeguro(config.diasTesteGratis, CONFIG_SISTEMA_PADRAO.diasTesteGratis, 0, 365)),
    plano: {
      nome: String(planoRecebido.nome || planoPadrao.nome).trim(),
      valor: Number(numeroSeguro(planoRecebido.valor, planoPadrao.valor, 1, 99999).toFixed(2)),
      dias: Math.round(numeroSeguro(planoRecebido.dias, planoPadrao.dias, 1, 3650)),
      destaque: String(planoRecebido.destaque || planoPadrao.destaque).trim(),
    },
  };
};

export const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
