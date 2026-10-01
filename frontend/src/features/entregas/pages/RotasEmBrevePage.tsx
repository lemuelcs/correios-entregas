/** Monitoramento › Rotas: chega na v2, com PRD próprio (ADR-010). Sem dados de exemplo. */
import { Pilula, CabecalhoPagina, Cartao } from '../components/ui';

export function RotasEmBrevePage() {
  return (
    <>
      <CabecalhoPagina
        secao="Monitoramento"
        titulo="Rotas"
        extra={<Pilula classe="bg-ce-liberado-bg text-ce-liberado">Em breve · v2</Pilula>}
      />
      <Cartao className="flex max-w-[72ch] flex-col gap-3 p-6">
        <h2 className="m-0 text-lg font-bold">Em breve</h2>
        <p className="m-0 text-[15px] leading-normal text-ce-tinta-2">
          O acompanhamento das rotas em andamento, no estilo do painel do Delivyo, terá PRD próprio: progresso de
          paradas, ritmo, retorno projetado e taxa de entrega por carteiro.
        </p>
        <p className="m-0 text-[15px] leading-normal text-ce-tinta-2">
          Enquanto isso, a situação de cada pacote do dia fica em Monitoramento › Carregar Dados, na lista de pacotes de cada rota.
        </p>
      </Cartao>
    </>
  );
}
