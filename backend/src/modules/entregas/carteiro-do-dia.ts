/**
 * Carteiro da rota no dia — fonte única da precedência, usada pelo quadro, pela
 * lista de pacotes, pela liberação e pela orientação:
 *
 *   snapshot da liberação → troca do dia (`EscalaDistrito`) → carteiro padrão da rota.
 *
 * O snapshot só existe depois de liberar (`CargaDistrito.carteiroId`); antes
 * disso, quem chama passa `null`. Se o escolhido está ativo ou não é regra de
 * cada uso, não daqui.
 */
export function escolherCarteiroDoDia<T>(fontes: { snapshot?: T | null; escala?: T | null; padrao?: T | null }): T | null {
  return fontes.snapshot ?? fontes.escala ?? fontes.padrao ?? null;
}
