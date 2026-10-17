export {};
declare global {
  interface Window {
    readerDesktop?: {
      platform: string;
      calibreStatus: () => Promise<{ available: boolean }>;
      chooseCalibre: () => Promise<{ available: boolean }>;
      pickConversionSource: () => Promise<{
        token: string;
        name: string;
      } | null>;
      convert: (options: {
        token: string;
        format: string;
      }) => Promise<{ ok?: boolean; cancelled?: boolean; error?: string }>;
      cancelConversion: () => Promise<void>;
    };
  }
}
