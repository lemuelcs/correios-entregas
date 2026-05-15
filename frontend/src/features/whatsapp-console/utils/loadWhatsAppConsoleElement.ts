// Carrega o bundle do Web Component <whatsapp-console> servido em
// `public/whatsapp-console-element.js`. Mesma estrategia adotada pelo host do
// Delivyo: injeta uma tag <script type="module"> apontando para o asset
// estatico do proprio frontend, evitando `import()` dinamico entre repositorios
// (o build do WC fica em `dist-wc/` no whatsapp-console, mas aqui consumimos
// somente a copia publicada em /public).
const WHATSAPP_CONSOLE_SCRIPT_ID = 'whatsapp-console-element-script';
const WHATSAPP_CONSOLE_SCRIPT_SRC = '/whatsapp-console-element.js';

let loadPromise: Promise<void> | null = null;

export function loadWhatsAppConsoleElement(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (customElements.get('whatsapp-console')) {
    return Promise.resolve();
  }

  if (!loadPromise) {
    loadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById(WHATSAPP_CONSOLE_SCRIPT_ID) as HTMLScriptElement | null;

      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Nao foi possivel carregar o WhatsApp Console.')),
          { once: true },
        );
        return;
      }

      const script = document.createElement('script');
      script.id = WHATSAPP_CONSOLE_SCRIPT_ID;
      script.type = 'module';
      script.src = WHATSAPP_CONSOLE_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loadPromise = null;
        reject(new Error('Nao foi possivel carregar o WhatsApp Console.'));
      };
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}
