import { createOptionsForServices, getConfig, getSupabase, servicesCatalog } from './main.js';

const supabase = getSupabase();
const config = getConfig();
const paymentForm = document.getElementById('payment-form');
const paymentServiceSelect = document.getElementById('payment-service');
const paymentAmount = document.getElementById('payment-amount');
const paymentMessage = document.getElementById('payment-message');
let stripe = null;

function setMessage(type, text) {
  if (!paymentMessage) return;
  paymentMessage.className = `alert ${type}`;
  paymentMessage.textContent = text;
}

function initStripe() {
  if (!window.Stripe || !config.stripePublicKey) {
    console.warn('Stripe.js or public key missing');
    return null;
  }
  return window.Stripe(config.stripePublicKey);
}

function updateAmount() {
  if (!paymentServiceSelect || !paymentAmount) return;
  const selected = paymentServiceSelect.options[paymentServiceSelect.selectedIndex];
  if (!selected) {
    paymentAmount.value = '';
    return;
  }
  paymentAmount.value = `$${selected.dataset.price}`;
}

async function createCheckoutSession(payload) {
  try {
    const response = await fetch(config.stripeCheckoutUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Unable to create checkout session.');
    }

    return response.json();
  } catch (error) {
    throw error;
  }
}

async function handlePayment(event) {
  event.preventDefault();
  if (!stripe) {
    setMessage('error', 'Stripe is not initialized.');
    return;
  }
  const submitBtn = paymentForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  setMessage('success', 'Redirecting to Stripe Checkout...');

  const formData = new FormData(paymentForm);
  const selectedService = servicesCatalog.find((service) => service.name === formData.get('service'));

  if (!selectedService) {
    setMessage('error', 'Select a service to pay for.');
    submitBtn.disabled = false;
    return;
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = './login.html';
      return;
    }

    const checkout = await createCheckoutSession({
      priceId: selectedService.priceId,
      userId: session.user.id,
      service: selectedService.name,
    });

    const { error } = await stripe.redirectToCheckout({ sessionId: checkout.id });
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error(error);
    setMessage('error', error.message || 'Unable to process payment.');
    submitBtn.disabled = false;
  }
}

function initPaymentPage() {
  if (!paymentForm) return;
  stripe = initStripe();
  createOptionsForServices(paymentServiceSelect);
  paymentServiceSelect?.addEventListener('change', updateAmount);
  updateAmount();
  paymentForm.addEventListener('submit', handlePayment);
}

initPaymentPage();
