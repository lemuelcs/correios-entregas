let loadPromise: Promise<unknown> | null = null;

export function loadWhatsAppConsoleElement() {
  if (!loadPromise) {
    loadPromise = import(
      // @ts-ignore -- generated bundle does not ship type declarations.
      '../../../../../../delivyo-services/apps/whatsapp-console/dist/whatsapp-console-element.js'
    );
  }

  return loadPromise;
}
