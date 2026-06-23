const BANK_PAYMENT_SLUGS = new Set(['bank', 'bank_transfer', 'virement', 'virement_bancaire', 'bancaire']);
const AUTOMATIC_PAYMENT_SLUGS = new Set(['moncash', 'natcash', 'kashpaw', 'all']);

export function isBankPayment(method) {
  return BANK_PAYMENT_SLUGS.has(String(method || '').toLowerCase());
}

export function isAutomaticPlopPayment(method) {
  const slug = String(method || '').toLowerCase();
  return AUTOMATIC_PAYMENT_SLUGS.has(slug) && !isBankPayment(slug);
}

export function normalizePlopPaymentMethod(method) {
  const slug = String(method || '').toLowerCase();
  if (AUTOMATIC_PAYMENT_SLUGS.has(slug)) return slug;
  return 'all';
}

export async function createPlopPayment(supabase, payload) {
  if (!supabase?.functions?.invoke) {
    throw new Error('Supabase Functions non disponible.');
  }

  const { data, error } = await supabase.functions.invoke('plop-payment', {
    body: {
      action: 'create',
      ...payload,
      payment_method: normalizePlopPaymentMethod(payload.payment_method),
    },
  });

  if (error) throw new Error(error.message || 'Erreur création paiement PLOP PLOP.');
  if (!data?.status || !data?.url) throw new Error(data?.message || 'Réponse paiement invalide.');
  return data;
}

export async function verifyPlopPayment(supabase, refferenceId) {
  if (!supabase?.functions?.invoke) {
    throw new Error('Supabase Functions non disponible.');
  }

  const { data, error } = await supabase.functions.invoke('plop-payment', {
    body: {
      action: 'verify',
      refference_id: refferenceId,
    },
  });

  if (error) throw new Error(error.message || 'Erreur vérification paiement PLOP PLOP.');
  return data;
}
