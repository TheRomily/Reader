declare module "foliate-js/mobi.js" {
  interface TocItem {
    label: string;
    href: string;
    subitems?: TocItem[];
  }
  interface MobiDocument {
    metadata: { title?: string; author?: string[] };
    sections: { load: () => Promise<string> }[];
    toc?: TocItem[];
    resolveHref: (
      href: string,
    ) => { index: number } | undefined | Promise<{ index: number } | undefined>;
    getCover: () => Promise<Blob | undefined>;
    destroy: () => void;
  }
  export class MOBI {
    constructor(options: { unzlib: (data: Uint8Array) => Uint8Array });
    open(file: Blob): Promise<MobiDocument>;
  }
}
