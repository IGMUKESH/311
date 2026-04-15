export const imagekitConfig = {
  publicKey: (import.meta as any).env.VITE_IMAGEKIT_PUBLIC_KEY || '',
  urlEndpoint: (import.meta as any).env.VITE_IMAGEKIT_URL_ENDPOINT || '',
  authenticator: async () => {
    try {
      const response = await fetch(`${window.location.origin}/api/imagekit/auth`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Request failed with status ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      return {
        signature: data.signature,
        expire: data.expire,
        token: data.token,
      };
    } catch (error: any) {
      throw new Error(`Authentication request failed: ${error.message}`);
    }
  },
};
