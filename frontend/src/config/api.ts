// API configuration helper
export const getApiUrl = (): string => {
  return (
    (import.meta as ImportMeta & { env: { VITE_API_URL?: string } }).env.VITE_API_URL ||
    'http://localhost:3000'
  );
};

