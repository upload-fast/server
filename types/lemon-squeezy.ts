export const EVENTS = [
    'order_created',
    'subscription_created',
    'subscription_updated',
    'subscription_cancelled',
    'subscription_renewed',
    'subscription_payment_failed',
    'subscription_payment_recovered',
    'subscription_payment_refunded',
    'subscription_payment_success',
    'subscription_expired'
] as const;

export type LemonSqueezyEvent = typeof EVENTS[number];

export interface LemonSqueezyWebhookBody {
    meta: {
        event_name: LemonSqueezyEvent;
        custom_data: {
            user_id: string;
            app_name: string;
        };
    };
    data: {
        id: string;
        attributes: {
            identifier: string;
            status: 'on_trial' | 'active' | 'expired';
            variant_name: string;
            card_last_four: string;
            first_order_item: {
                variant_name: string;
                test_mode: boolean;
            };
            urls: {
                update_payment_method?: string;
                customer_portal?: string;
            };
            renews_at: string;
        };
    };
} 