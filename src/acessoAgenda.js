const DIA_MS = 24 * 60 * 60 * 1000;

const paraData = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor.toDate === 'function') {
    const data = valor.toDate();
    return Number.isNaN(data.getTime()) ? null : data;
  }

  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
};

const diasEntre = (fim, agora) => Math.max(0, Math.ceil((fim.getTime() - agora.getTime()) / DIA_MS));

export const calcularAcessoAgenda = (dadosLoja, diasTestePadrao = 7, agora = new Date()) => {
  const diasTeste = Number(dadosLoja?.testeGratisDias || diasTestePadrao || 7);

  if (!dadosLoja) {
    return { ok: true, dias: diasTeste, teste: true, tipo: 'carregando' };
  }

  if (dadosLoja.status && dadosLoja.status !== 'ativo') {
    return { ok: false, dias: 0, teste: false, tipo: dadosLoja.status };
  }

  const expiraEm = paraData(dadosLoja.expiraEmData) || paraData(dadosLoja.expiraEm);
  if (expiraEm) {
    const ok = expiraEm.getTime() > agora.getTime();
    return {
      ok,
      dias: diasEntre(expiraEm, agora),
      teste: !dadosLoja.planoAtivo,
      tipo: dadosLoja.planoAtivo ? 'plano' : 'teste',
      expiraEm,
    };
  }

  const dataInicio = paraData(dadosLoja.dataAprovacao) || paraData(dadosLoja.criadoEm);
  if (!dataInicio) {
    return { ok: false, dias: 0, teste: true, tipo: 'sem-data' };
  }

  const expiraTeste = new Date(dataInicio.getTime() + diasTeste * DIA_MS);
  const ok = expiraTeste.getTime() > agora.getTime();

  return {
    ok,
    dias: diasEntre(expiraTeste, agora),
    teste: true,
    tipo: 'teste',
    expiraEm: expiraTeste,
  };
};
