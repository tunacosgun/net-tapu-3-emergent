// Frontend email event mapping.
// This maps frontend events to email template keys that the backend notification
// system (crm.notification_queue) will dispatch via the configured provider.
//
// Provider selection is controlled by backend env vars:
//   EMAIL_PROVIDER=sendgrid|mailgun|ses|smtp
//
// The frontend only fires events — the backend decides provider + delivery.

export type EmailEvent =
  | 'user.registered'
  | 'user.password_reset_requested'
  | 'auction.deposit_paid'
  | 'auction.bid_placed'
  | 'auction.won'
  | 'auction.lost'
  | 'auction.starting_soon'
  | 'payment.success'
  | 'payment.failed'
  | 'offer.received'
  | 'offer.accepted'
  | 'offer.rejected'
  | 'offer.countered'
  | 'appointment.scheduled'
  | 'appointment.reminder'
  | 'appointment.cancelled'
  | 'contact.received';

export interface EmailEventPayload {
  event: EmailEvent;
  userId?: string;
  metadata?: Record<string, unknown>;
}

// Fire-and-forget email event to backend notification queue.
// Backend handles template resolution, provider selection, and delivery.
export async function fireEmailEvent(
  apiClient: { post: (url: string, data: unknown) => Promise<unknown> },
  payload: EmailEventPayload,
): Promise<void> {
  try {
    await apiClient.post('/notifications/events', payload);
  } catch {
    // Silently fail — email should never block user flow
    console.warn(`[email-event] Failed to fire: ${payload.event}`);
  }
}

// Convenience helpers for common flows
export function createEmailHelpers(apiClient: { post: (url: string, data: unknown) => Promise<unknown> }) {
  return {
    onRegistered(userId: string) {
      return fireEmailEvent(apiClient, { event: 'user.registered', userId });
    },

    onDepositPaid(userId: string, auctionId: string) {
      return fireEmailEvent(apiClient, {
        event: 'auction.deposit_paid',
        userId,
        metadata: { auctionId },
      });
    },

    onAuctionWon(userId: string, auctionId: string, finalPrice: string) {
      return fireEmailEvent(apiClient, {
        event: 'auction.won',
        userId,
        metadata: { auctionId, finalPrice },
      });
    },

    onPaymentSuccess(userId: string, paymentId: string) {
      return fireEmailEvent(apiClient, {
        event: 'payment.success',
        userId,
        metadata: { paymentId },
      });
    },

    onPaymentFailed(userId: string, paymentId: string) {
      return fireEmailEvent(apiClient, {
        event: 'payment.failed',
        userId,
        metadata: { paymentId },
      });
    },

    onOfferReceived(userId: string, offerId: string) {
      return fireEmailEvent(apiClient, {
        event: 'offer.received',
        userId,
        metadata: { offerId },
      });
    },

    onAppointmentScheduled(userId: string, appointmentId: string) {
      return fireEmailEvent(apiClient, {
        event: 'appointment.scheduled',
        userId,
        metadata: { appointmentId },
      });
    },

    onContactReceived(contactId: string) {
      return fireEmailEvent(apiClient, {
        event: 'contact.received',
        metadata: { contactId },
      });
    },
  };
}
