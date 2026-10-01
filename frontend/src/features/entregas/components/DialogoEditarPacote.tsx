/**
 * Edição do WhatsApp e do endereço de um pacote pelo supervisor, na lista da rota:
 * `PATCH /entregas/pacotes/:id`. Só vão no pedido os campos que mudaram.
 *
 * Numa rota já liberada, o pacote que estava "sem WhatsApp" e ganha um número recebe o
 * aviso na hora (`avisoSolicitado`): o diálogo avisa antes de salvar e confirma depois.
 */
import { useEffect, useId, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { ApiError } from '@/services/api';
import { entregasApi } from '../entregas.api';
import type { CamposEndereco, PacoteDistrito, PacoteEditado } from '../entregas.types';
import { ehSessaoExpirada, errosPorCampo, formatarWhatsapp, mensagemDeErro } from '../mensagens';
import { Botao, CLASSE_ENTRADA, Campo, Dialogo } from './ui';

type CampoEndereco = 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf' | 'cep' | 'referencia';

const CAMPOS: Array<{ nome: CampoEndereco; rotulo: string; max: number; classe?: string; modo?: 'numeric' }> = [
  { nome: 'logradouro', rotulo: 'Logradouro', max: 300, classe: 'sm:col-span-2' },
  { nome: 'numero', rotulo: 'Número', max: 40 },
  { nome: 'complemento', rotulo: 'Complemento', max: 200 },
  { nome: 'bairro', rotulo: 'Bairro', max: 200 },
  { nome: 'cidade', rotulo: 'Cidade', max: 200 },
  { nome: 'uf', rotulo: 'UF', max: 2 },
  { nome: 'cep', rotulo: 'CEP', max: 9, modo: 'numeric' },
  { nome: 'referencia', rotulo: 'Ponto de referência', max: 500, classe: 'sm:col-span-2' },
];

function valoresDe(e: CamposEndereco): Record<CampoEndereco, string> {
  return {
    logradouro: e.logradouro ?? '',
    numero: e.numero ?? '',
    complemento: e.complemento ?? '',
    bairro: e.bairro ?? '',
    cidade: e.cidade ?? '',
    uf: e.uf ?? '',
    cep: e.cep ?? '',
    referencia: e.referencia ?? '',
  };
}

export function DialogoEditarPacote({ pacote, rotaLiberada, aoFechar, aoSalvar }: {
  pacote: PacoteDistrito | null;
  /** A rota já foi liberada: um WhatsApp novo dispara o aviso na hora. */
  rotaLiberada: boolean;
  aoFechar: () => void;
  aoSalvar: (editado: PacoteEditado) => Promise<void> | void;
}) {
  const formId = useId();
  const avisoId = useId();
  const [whatsapp, setWhatsapp] = useState('');
  const [endereco, setEndereco] = useState<Record<CampoEndereco, string>>(valoresDe({} as CamposEndereco));
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const pacoteId = pacote?.id ?? null;

  useEffect(() => {
    setWhatsapp(pacote?.whatsapp ? formatarWhatsapp(pacote.whatsapp) : '');
    setEndereco(valoresDe(pacote?.endereco ?? ({} as CamposEndereco)));
    setErro(null);
    setErros({});
    setEnviando(false);
    // Reinicia só ao trocar de pacote: a lista atualiza sozinha por baixo do diálogo.
  }, [pacoteId]);

  const whatsappOriginal = pacote?.whatsapp ? formatarWhatsapp(pacote.whatsapp) : '';
  const mudouWhatsapp = whatsapp.trim() !== whatsappOriginal;
  const disparaAviso = !!pacote && rotaLiberada && pacote.status === 'SEM_WHATSAPP' && whatsapp.trim() !== '';
  const removeWhatsapp = !!pacote?.whatsapp && whatsapp.trim() === '';

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!pacote || enviando) return;
    const original = valoresDe(pacote.endereco);
    const mudancas: Partial<Record<CampoEndereco, string | null>> = {};
    for (const { nome } of CAMPOS) {
      const novo = endereco[nome].trim();
      if (novo !== original[nome]) mudancas[nome] = novo || null;
    }
    const temEndereco = Object.keys(mudancas).length > 0;
    if (!mudouWhatsapp && !temEndereco) {
      aoFechar();
      return;
    }
    setErro(null);
    setErros({});
    setEnviando(true);
    try {
      const editado = await entregasApi.editarPacote(pacote.id, {
        ...(mudouWhatsapp ? { whatsapp: whatsapp.trim() || null } : {}),
        ...(temEndereco ? { endereco: mudancas } : {}),
      });
      if (editado.avisoSolicitado) {
        toast.success(`Pacote ${pacote.codigo} atualizado. A rota já está liberada: o aviso ao destinatário foi enviado agora.`, { duration: 7000 });
      } else if (editado.descadastrado && mudouWhatsapp && editado.whatsapp) {
        toast.success(`Pacote ${pacote.codigo} atualizado. Esse número pediu para não receber mensagens: não será avisado.`, { duration: 7000 });
      } else {
        toast.success(`Pacote ${pacote.codigo} atualizado.`);
      }
      await aoSalvar(editado);
    } catch (err) {
      if (ehSessaoExpirada(err)) return;
      const porCampo = errosPorCampo(err);
      if (err instanceof ApiError && err.codigo === 'whatsapp_invalido') {
        const semDdd = (err.detalhes as { motivo?: string } | undefined)?.motivo === 'sem_ddd';
        porCampo.whatsapp = semDdd ? 'Informe o DDD do WhatsApp.' : mensagemDeErro(err);
      }
      setErros(porCampo);
      setErro(porCampo.whatsapp ? null : mensagemDeErro(err, 'Não foi possível salvar o pacote.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      titulo={pacote ? `Editar ${pacote.codigo}` : ''}
      aberto={!!pacote}
      aoFechar={() => !enviando && aoFechar()}
      largura="max-w-[600px]"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao type="submit" form={formId} disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</Botao>
        </>
      }
    >
      {pacote && (
        <form id={formId} onSubmit={(e) => void salvar(e)} noValidate className="flex flex-col gap-3.5">
          <p className="m-0 text-[15px] leading-normal text-ce-tinta-2">{pacote.nome}</p>

          <Campo rotulo="WhatsApp do destinatário" dica="Com DDD, ex.: (61) 99812-4412. Em branco = sem WhatsApp." erro={erros.whatsapp}>
            {(id) => (
              <input
                id={id}
                value={whatsapp}
                onChange={(e) => {
                  setWhatsapp(e.target.value);
                  if (erros.whatsapp) setErros(({ whatsapp: _removido, ...resto }) => resto);
                }}
                inputMode="tel"
                maxLength={40}
                aria-invalid={!!erros.whatsapp}
                aria-describedby={disparaAviso || removeWhatsapp ? avisoId : undefined}
                className={`${CLASSE_ENTRADA} ${erros.whatsapp ? 'border-ce-erro' : ''}`}
              />
            )}
          </Campo>

          {disparaAviso && (
            <p id={avisoId} data-aviso-imediato className="m-0 rounded-lg bg-ce-corrigir-bg px-3 py-2.5 text-sm font-semibold leading-normal text-ce-corrigir">
              Esta rota já foi liberada: ao salvar, o destinatário recebe o aviso de entrega na hora.
            </p>
          )}
          {removeWhatsapp && (
            <p id={avisoId} className="m-0 rounded-lg bg-ce-linha-fraca px-3 py-2.5 text-sm leading-normal text-ce-tinta-2">
              Sem WhatsApp, o destinatário deixa de receber as mensagens deste pacote.
            </p>
          )}

          <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2">
            <legend className="mb-1 p-0 text-sm font-bold">Endereço</legend>
            {CAMPOS.map((c) => (
              <div key={c.nome} className={c.classe}>
                <Campo rotulo={c.rotulo} erro={erros[c.nome]}>
                  {(id) => (
                    <input
                      id={id}
                      value={endereco[c.nome]}
                      onChange={(e) => setEndereco((a) => ({ ...a, [c.nome]: e.target.value }))}
                      maxLength={c.max}
                      inputMode={c.modo}
                      className={CLASSE_ENTRADA}
                    />
                  )}
                </Campo>
              </div>
            ))}
          </fieldset>
          {pacote.endereco.enderecoTexto && !pacote.endereco.logradouro && (
            <p className="m-0 text-[13px] leading-normal text-ce-suave">Endereço como veio na lista: {pacote.endereco.enderecoTexto}</p>
          )}

          {erro && <p role="alert" className="m-0 rounded-lg bg-ce-erro-bg px-3 py-2.5 text-[15px] font-semibold text-ce-erro">{erro}</p>}
        </form>
      )}
    </Dialogo>
  );
}
