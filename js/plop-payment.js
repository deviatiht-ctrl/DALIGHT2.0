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

/**
 * Verify a Plop Plop payment and update the reservation in DB if confirmed.
 * Returns the raw Plop verify response.
 */
export async function verifyAndUpdateReservation(supabase, refferenceId, reservationId) {
  const data = await verifyPlopPayment(supabase, refferenceId);

  if (data?.trans_status === 'ok') {
    await supabase
      .from('reservations')
      .update({
        plop_client_id:     data.id_client     || null,
        plop_transaction_id: data.id_transaction || null,
        payment_status:     'fully_paid',
      })
      .eq('id', reservationId);
  }

  return data;
}

/**
 * Scan the current user's pending Plop reservations and auto-verify them.
 * Call this on the orders/account page after the user returns from Plop Plop.
 */
export async function autoPollPlopPayments(supabase) {
  if (!supabase?.from) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: pending } = await supabase
      .from('reservations')
      .select('id, payment_reference, payment_method')
      .eq('user_id', user.id)
      .in('payment_method', ['moncash', 'natcash', 'kashpaw'])
      .eq('payment_status', 'pending')
      .not('payment_reference', 'is', null)
      .is('plop_client_id', null);

    if (!pending?.length) return;

    await Promise.allSettled(
      pending.map(r => verifyAndUpdateReservation(supabase, r.payment_reference, r.id))
    );
  } catch (err) {
    console.warn('[plop] autoPollPlopPayments error:', err.message);
  }
}
