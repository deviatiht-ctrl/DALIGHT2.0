// DALIGHT Email Templates for Brevo.com

const LOGO_URL = 'https://raw.githubusercontent.com/deviatiht-ctrl/DALIGHT2.0/main/assets/images/logodaligth.png';

const BASE_STYLES = `
  body { font-family: 'Montserrat', sans-serif; background-color: #f5f3f0; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(74,55,40,0.1); }
  .header { background: linear-gradient(135deg, #4A3728 0%, #6B4F3B 100%); padding: 30px 40px; text-align: center; }
  .logo { max-width: 120px; height: auto; }
  .content { padding: 40px; color: #4A3728; }
  .greeting { font-size: 22px; font-weight: 600; margin-bottom: 20px; }
  .message { font-size: 16px; line-height: 1.7; color: #5a4a3a; margin-bottom: 25px; }
  .details-box { background: #faf8f6; border-left: 4px solid #D4AF37; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0; }
  .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(74,55,40,0.08); }
  .detail-row:last-child { border-bottom: none; }
  .detail-label { font-weight: 600; color: #6B4F3B; }
  .detail-value { color: #4A3728; }
  .cta-button { display: inline-block; background: #D4AF37; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-top: 20px; }
  .cta-button:hover { background: #b8941f; }
  .footer { background: #4A3728; padding: 25px 40px; text-align: center; color: #e8e0d8; font-size: 14px; }
  .footer a { color: #D4AF37; text-decoration: none; }
  .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }
  .badge.pending { background: #fff7e0; color: #b8860b; }
  .badge.confirmed { background: #e6f9ee; color: #15803d; }
`;

export function clientConfirmationEmail(reservation) {
  const formatDate = (date) => new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatTime = (time) => time;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="DALIGHT" class="logo">
    </div>
    <div class="content">
      <p class="greeting">Bonjour ${reservation.user_name || 'Cher client'},</p>
      <p class="message">Merci pour votre réservation chez DALIGHT Head Spa. Nous avons bien reçu votre demande et nous sommes ravis de vous accueillir.</p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">Numéro de réservation</span>
          <span class="detail-value">${reservation.reservation_number}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Service</span>
          <span class="detail-value">${reservation.service}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${formatDate(reservation.date)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Heure</span>
          <span class="detail-value">${formatTime(reservation.time)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Lieu</span>
          <span class="detail-value">${reservation.location}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Statut</span>
          <span class="detail-value"><span class="badge pending">En attente de confirmation</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total</span>
          <span class="detail-value">${reservation.total_amount?.toLocaleString() || '—'} HTG</span>
        </div>
      </div>

      <p class="message">Votre réservation est actuellement en attente de confirmation. Vous recevrez un email dès que notre équipe aura validé votre rendez-vous.</p>
      <p class="message">Si vous avez des questions, n'hésitez pas à nous contacter au +509 4747-2221 ou par email à dalightbeauty15mai@gmail.com.</p>
      
      <a href="https://dalight.netlify.app/pages/orders.html" class="cta-button">Voir ma réservation</a>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} DALIGHT. Tous droits réservés.</p>
      <p>Delmas 65 Rue durandisse #10, Haïti</p>
    </div>
  </div>
</body>
</html>`;
}

export function adminNotificationEmail(reservation) {
  const formatDate = (date) => new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="DALIGHT" class="logo">
    </div>
    <div class="content">
      <p class="greeting">Nouvelle réservation reçue !</p>
      <p class="message">Un client vient de faire une réservation. Voici les détails :</p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">Numéro de réservation</span>
          <span class="detail-value">${reservation.reservation_number}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Client</span>
          <span class="detail-value">${reservation.user_name}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value">${reservation.user_email}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Téléphone</span>
          <span class="detail-value">${reservation.phone || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Service</span>
          <span class="detail-value">${reservation.service}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${formatDate(reservation.date)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Heure</span>
          <span class="detail-value">${reservation.time}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Montant total</span>
          <span class="detail-value">${reservation.total_amount?.toLocaleString() || '—'} HTG</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Acompte</span>
          <span class="detail-value">${reservation.deposit_amount?.toLocaleString() || '—'} HTG</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Statut paiement</span>
          <span class="detail-value">${reservation.payment_status || 'En attente'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Notes</span>
          <span class="detail-value">${reservation.notes || '—'}</span>
        </div>
      </div>

      <a href="https://dalight.netlify.app/pages/admin.html" class="cta-button">Confirmer la réservation</a>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} DALIGHT. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>`;
}

export function adminConfirmationEmail(reservation) {
  const formatDate = (date) => new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="DALIGHT" class="logo">
    </div>
    <div class="content">
      <p class="greeting">Bonjour ${reservation.user_name || 'Cher client'},</p>
      <p class="message">Bonne nouvelle ! Votre réservation a été confirmée par notre équipe. Nous avons hâte de vous accueillir.</p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">Numéro de réservation</span>
          <span class="detail-value">${reservation.reservation_number}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Service</span>
          <span class="detail-value">${reservation.service}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${formatDate(reservation.date)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Heure</span>
          <span class="detail-value">${reservation.time}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Lieu</span>
          <span class="detail-value">${reservation.location}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Statut</span>
          <span class="detail-value"><span class="badge confirmed">Confirmé ✓</span></span>
        </div>
      </div>

      <p class="message">Veuillez arriver 10 minutes avant votre rendez-vous. Si vous devez annuler ou modifier, contactez-nous au moins 24 heures à l'avance.</p>
      
      <a href="https://dalight.netlify.app/pages/orders.html" class="cta-button">Voir ma réservation</a>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} DALIGHT. Tous droits réservés.</p>
      <p>Delmas 65 Rue durandisse #10, Haïti — +509 4747-2221</p>
    </div>
  </div>
</body>
</html>`;
}
