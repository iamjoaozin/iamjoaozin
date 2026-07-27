export const ADMINS_AUTORIZADOS = [
  'j33061393@gmail.com',
];

const normalizarEmail = (email = '') => String(email).trim().toLowerCase();

export const isSuperAdmin = (userOrEmail) => {
  const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email;
  return ADMINS_AUTORIZADOS.map(normalizarEmail).includes(normalizarEmail(email));
};
