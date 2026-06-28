import PostHog from 'posthog-react-native';

let posthog: PostHog | null = null;

try {
  posthog = new PostHog('phc_placeholder_production_readiness_key', {
    host: 'https://us.posthog.com',
  });
} catch (e) {
  if (__DEV__) {
    console.warn("PostHog initialization failed:", e);
  }
}

export const trackEvent = (eventName: string, properties: Record<string, any> = {}) => {
  try {
    if (posthog) {
      posthog.capture(eventName, properties);
    }
    if (__DEV__) {
      console.log(`[Analytics Event] ${eventName}`, properties);
    }
  } catch (err) {
    if (__DEV__) {
      console.warn("Failed to capture analytics event:", err);
    }
  }
};
