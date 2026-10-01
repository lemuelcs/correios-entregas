/**
 * Faixa fixa das telas antigas ("SGPD v2", ADR-009/015): avisa que os dados são
 * de demonstração e oferece o caminho de volta aos três módulos (US-037).
 */
import { Link } from 'react-router';
import { TriangleAlert } from 'lucide-react';

export function FaixaPrototipo({ voltarPara }: { voltarPara: string }) {
  return (
    <div
      role="note"
      className="sticky top-0 z-40 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#f1dca6] bg-ce-carregado-bg px-4 py-2 font-entregas text-[15px] text-[#5c3b00] lg:px-8"
    >
      <TriangleAlert size={18} aria-hidden="true" className="shrink-0" />
      <span>
        <strong>Protótipo — dados de demonstração.</strong>{' '}
        <span className="hidden sm:inline">As telas do SGPD v2 não fazem parte do fluxo de entregas mediadas.</span>
      </span>
      <Link
        to={voltarPara}
        className="ml-auto inline-flex min-h-11 items-center whitespace-nowrap font-bold text-ce-azul underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ce-azul"
      >
        Voltar aos módulos
      </Link>
    </div>
  );
}
