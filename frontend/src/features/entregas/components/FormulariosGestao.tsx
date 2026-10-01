/**
 * Formulários da Gestão no Cadastro: canais de WhatsApp (criar, editar, desativar e gerar
 * novo token de entrada), unidades (inclusive endereço, situação e mediação) e supervisores.
 */
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { entregasApi } from '../entregas.api';
import type { CanalProsio, Supervisor, TipoCanal, UnidadeGestao } from '../entregas.types';
import { ehSessaoExpirada, formatarWhatsapp, mensagemDeErro } from '../mensagens';
import { CampoF, DialogoFormulario, registroAtualDoConflito } from './DialogoFormulario';
import { Marcador, entrada } from './FormulariosCadastro';
import { Botao, CLASSE_ENTRADA, Dialogo } from './ui';

export const rotuloTipoCanal = (tipo: TipoCanal) => (tipo === 'WABA' ? 'Número oficial (WABA)' : 'Número atual (WAHA)');

// ——— Canais ——————————————————————————————————————————————————————————

export function FormCanal({ canal, aoFechar, aoSalvar }: {
  canal: CanalProsio | null;
  aoFechar: () => void;
  /** Canal gravado; na criação ele traz o `tokenEntrada`, mostrado uma única vez. */
  aoSalvar: (c: CanalProsio) => Promise<void>;
}) {
  const [base, setBase] = useState(canal);
  const [nome, setNome] = useState(canal?.nome ?? '');
  const [baseUrl, setBaseUrl] = useState(canal?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [callbackSecret, setSegredo] = useState('');
  const [tipo, setTipo] = useState<TipoCanal>(canal?.tipo ?? 'WAHA');
  const [compartilhado, setCompartilhado] = useState(canal?.compartilhado ?? false);
  const [ativo, setAtivo] = useState(canal?.ativo ?? true);

  function recarregar(atual: CanalProsio) {
    setBase(atual);
    setNome(atual.nome);
    setBaseUrl(atual.baseUrl);
    setTipo(atual.tipo);
    setCompartilhado(atual.compartilhado);
    setAtivo(atual.ativo);
  }

  const emUso = base?.unidades ?? 0;

  return (
    <DialogoFormulario<CanalProsio>
      titulo={base ? `Editar ${base.nome}` : 'Novo canal de WhatsApp'}
      aberto
      aoFechar={aoFechar}
      aoConflito={recarregar}
      rotuloEnviar={base ? 'Salvar' : 'Criar canal'}
      aoEnviar={async () => {
        const comum = { nome: nome.trim(), baseUrl: baseUrl.trim(), tipo, compartilhado };
        const salvo = base
          ? await entregasApi.editarCanal(base.id, {
            ...comum,
            ativo,
            // Segredos só vão quando preenchidos: em branco, o servidor mantém os atuais.
            ...(apiKey ? { apiKey } : {}),
            ...(callbackSecret ? { callbackSecret } : {}),
            ...(base.atualizadoEm ? { atualizadoEm: base.atualizadoEm } : {}),
          })
          : await entregasApi.criarCanal({ ...comum, apiKey, callbackSecret });
        if (base) toast.success('Canal atualizado.');
        await aoSalvar(salvo);
      }}
    >
      <CampoF nome="nome" rotulo="Nome">{entrada({ value: nome, onChange: (e) => setNome(e.target.value), required: true, minLength: 2, maxLength: 80 })}</CampoF>
      <CampoF nome="baseUrl" rotulo="Endereço do Prosio" dica="Ex.: https://prosio.com.br">{entrada({ value: baseUrl, onChange: (e) => setBaseUrl(e.target.value), required: true, type: 'url' })}</CampoF>
      <CampoF nome="apiKey" rotulo="Chave de API do Prosio" dica={base ? 'Em branco, a chave atual é mantida.' : undefined}>
        {entrada({ value: apiKey, onChange: (e) => setApiKey(e.target.value), required: !base, minLength: 8, type: 'password', autoComplete: 'off' })}
      </CampoF>
      <CampoF nome="callbackSecret" rotulo="Segredo dos callbacks" dica={base ? 'Em branco, o segredo atual é mantido. Mínimo de 16 caracteres.' : 'Mínimo de 16 caracteres'}>
        {entrada({ value: callbackSecret, onChange: (e) => setSegredo(e.target.value), required: !base, minLength: 16, type: 'password', autoComplete: 'off' })}
      </CampoF>
      <CampoF nome="tipo" rotulo="Tipo do número">
        {(id) => (
          <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value as TipoCanal)} className={CLASSE_ENTRADA}>
            <option value="WAHA">Número atual (WAHA)</option>
            <option value="WABA">Número oficial (WABA)</option>
          </select>
        )}
      </CampoF>
      <Marcador marcado={compartilhado} aoMudar={setCompartilhado}>Canal compartilhado entre unidades</Marcador>
      {base && <Marcador marcado={ativo} aoMudar={setAtivo}>Canal ativo</Marcador>}
      {base && !ativo && emUso > 0 && (
        <p className="m-0 rounded-lg bg-ce-corrigir-bg px-3 py-2.5 text-sm font-semibold leading-normal text-ce-corrigir">
          {emUso === 1 ? '1 unidade usa' : `${emUso} unidades usam`} este canal: desativado, {emUso === 1 ? 'ela fica' : 'elas ficam'} sem avisos e sem atendimento.
        </p>
      )}
    </DialogoFormulario>
  );
}

/** Confirmação de uma ação que não tem formulário (desativar canal, gerar novo token). */
export function DialogoConfirmar({ titulo, rotulo, perigo = false, aoFechar, aoConfirmar, aoConflito, children }: {
  titulo: string;
  rotulo: string;
  perigo?: boolean;
  aoFechar: () => void;
  aoConfirmar: () => Promise<void>;
  /** Outra pessoa alterou o registro: a tela recarrega a lista; o diálogo explica e continua aberto. */
  aoConflito?: (atual: unknown) => void;
  children: ReactNode;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setOcupado(true);
    setErro(null);
    try {
      await aoConfirmar();
    } catch (err) {
      if (ehSessaoExpirada(err)) return;
      const atual = registroAtualDoConflito<unknown>(err);
      if (atual && aoConflito) {
        aoConflito(atual);
        setErro('Outra pessoa alterou este registro há instantes. A versão mais recente já foi carregada: confirme de novo se ainda quiser.');
      } else {
        setErro(mensagemDeErro(err, 'Não foi possível concluir.'));
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialogo
      titulo={titulo}
      aberto
      aoFechar={() => !ocupado && aoFechar()}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={ocupado}>Cancelar</Botao>
          <Botao variante={perigo ? 'perigo' : 'primario'} onClick={() => void confirmar()} disabled={ocupado}>{ocupado ? 'Aguarde…' : rotulo}</Botao>
        </>
      }
    >
      <div className="flex flex-col gap-2 text-[15px] leading-normal text-ce-tinta-2">{children}</div>
      {erro && <p role="alert" className="m-0 rounded-lg bg-ce-erro-bg px-3 py-2.5 text-[15px] font-semibold text-ce-erro">{erro}</p>}
    </Dialogo>
  );
}

async function copiarTexto(texto: string, campo: HTMLInputElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Sem permissão para a área de transferência: cai na seleção do campo.
  }
  if (!campo) return false;
  campo.focus();
  campo.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

/**
 * Token de entrada do canal: aparece UMA vez (na criação ou ao gerar um novo). O diálogo
 * não fecha com Esc nem tem "Fechar": só o botão de confirmação o dispensa.
 */
export function DialogoToken({ canal, novo, aoFechar }: { canal: CanalProsio | null; /** Token regenerado (e não canal recém-criado). */ novo: boolean; aoFechar: () => void }) {
  const campo = useRef<HTMLInputElement>(null);
  const [copiado, setCopiado] = useState<'sim' | 'falhou' | null>(null);
  const token = canal?.tokenEntrada ?? '';

  useEffect(() => setCopiado(null), [token]);

  async function copiar() {
    setCopiado((await copiarTexto(token, campo.current)) ? 'sim' : 'falhou');
  }

  return (
    <Dialogo
      titulo={novo ? 'Novo token de entrada' : 'Canal criado'}
      aberto={!!canal}
      dispensavel={false}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={() => void copiar()}>{copiado === 'sim' ? 'Copiado' : 'Copiar'}</Botao>
          <Botao onClick={aoFechar}>Já copiei o token</Botao>
        </>
      }
    >
      <p className="m-0 text-[15px] text-ce-tinta-2">
        Token de entrada do canal <strong>{canal?.nome}</strong>. Configure-o nas integrações do Prosio.{' '}
        <strong>Ele é exibido só esta vez.</strong>
        {novo && ' O token anterior já deixou de valer.'}
      </p>
      <label htmlFor="token-entrada" className="text-sm font-semibold">Token de entrada</label>
      <input ref={campo} id="token-entrada" readOnly value={token} onFocus={(e) => e.target.select()} className={`${CLASSE_ENTRADA} font-codigo text-[13px]`} />
      <p role="status" className="m-0 min-h-5 text-[13px] text-ce-suave">
        {copiado === 'sim' && 'Token copiado para a área de transferência.'}
        {copiado === 'falhou' && 'Não foi possível copiar sozinho: selecione o token acima e copie.'}
      </p>
    </Dialogo>
  );
}

// ——— Unidades ————————————————————————————————————————————————————————

function valoresDaUnidade(u: UnidadeGestao | null) {
  return {
    codigo: '',
    nome: u?.nome ?? '',
    tipo: (u?.tipo ?? 'CDD') as string,
    logradouro: u?.logradouro ?? '',
    numero: u?.numero ?? '',
    complemento: u?.complemento ?? '',
    bairro: u?.bairro ?? '',
    cidade: u?.cidade ?? '',
    uf: u?.uf ?? 'DF',
    cep: u?.cep ?? '',
    latitude: u?.latitude != null ? String(u.latitude) : '',
    longitude: u?.longitude != null ? String(u.longitude) : '',
    canalProsioId: u?.canalProsioId ?? '',
    prosioUnidadeRef: u?.prosioUnidadeRef ?? '',
    mediacaoAtiva: u?.mediacaoAtiva ?? false,
    ativa: u?.ativa ?? true,
  };
}

const numero = (texto: string) => Number(texto.trim().replace(',', '.'));

export function FormUnidade({ unidade, canais, aoFechar, aoSalvar }: { unidade: UnidadeGestao | null; canais: CanalProsio[]; aoFechar: () => void; aoSalvar: (u: UnidadeGestao) => Promise<void> }) {
  const [base, setBase] = useState(unidade);
  const [v, setV] = useState(() => valoresDaUnidade(unidade));
  const muda = (k: keyof typeof v) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((a) => ({ ...a, [k]: e.target instanceof HTMLInputElement && e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const canal = canais.find((c) => c.id === v.canalProsioId);

  function recarregar(atual: UnidadeGestao) {
    setBase(atual);
    setV(valoresDaUnidade(atual));
  }

  return (
    <DialogoFormulario<UnidadeGestao>
      titulo={base ? `Editar ${base.nome}` : 'Nova unidade'}
      aberto
      aoFechar={aoFechar}
      aoConflito={recarregar}
      aoEnviar={async () => {
        const dados = {
          nome: v.nome.trim(),
          tipo: v.tipo,
          logradouro: v.logradouro.trim(),
          numero: v.numero.trim(),
          complemento: v.complemento.trim(),
          bairro: v.bairro.trim(),
          cidade: v.cidade.trim(),
          uf: v.uf.trim().toUpperCase(),
          cep: v.cep.replace(/\D/g, ''),
          latitude: numero(v.latitude),
          longitude: numero(v.longitude),
          canalProsioId: v.canalProsioId || null,
          canal: canal?.tipo ?? null,
          prosioUnidadeRef: canal?.compartilhado ? v.prosioUnidadeRef.trim() || null : null,
          mediacaoAtiva: v.mediacaoAtiva,
        };
        const salva = base
          ? await entregasApi.editarUnidade(base.id, { ...dados, ativa: v.ativa, ...(base.atualizadoEm ? { atualizadoEm: base.atualizadoEm } : {}) })
          : await entregasApi.criarUnidade({ ...dados, codigo: v.codigo.trim() });
        toast.success(base ? 'Unidade atualizada.' : `Unidade ${salva.nome} cadastrada.`);
        await aoSalvar(salva);
      }}
    >
      {!base && <CampoF nome="codigo" rotulo="Código da unidade">{entrada({ value: v.codigo, onChange: muda('codigo'), required: true, minLength: 3 })}</CampoF>}
      <CampoF nome="nome" rotulo="Nome">{entrada({ value: v.nome, onChange: muda('nome'), required: true, minLength: 3 })}</CampoF>
      <CampoF nome="tipo" rotulo="Tipo">
        {(id) => (
          <select id={id} value={v.tipo} onChange={muda('tipo')} className={CLASSE_ENTRADA}>
            <option value="CDD">CDD</option>
            <option value="CEE">CEE</option>
            <option value="HIBRIDA">Híbrida (CDD + CEE)</option>
          </select>
        )}
      </CampoF>
      <CampoF nome="logradouro" rotulo="Logradouro">{entrada({ value: v.logradouro, onChange: muda('logradouro'), required: true, minLength: 3 })}</CampoF>
      <div className="grid grid-cols-2 gap-3">
        <CampoF nome="numero" rotulo="Número">{entrada({ value: v.numero, onChange: muda('numero'), required: true })}</CampoF>
        <CampoF nome="complemento" rotulo="Complemento">{entrada({ value: v.complemento, onChange: muda('complemento') })}</CampoF>
        <CampoF nome="bairro" rotulo="Bairro">{entrada({ value: v.bairro, onChange: muda('bairro'), required: true, minLength: 2 })}</CampoF>
        <CampoF nome="cidade" rotulo="Cidade">{entrada({ value: v.cidade, onChange: muda('cidade'), required: true, minLength: 2 })}</CampoF>
        <CampoF nome="uf" rotulo="UF">{entrada({ value: v.uf, onChange: muda('uf'), required: true, minLength: 2, maxLength: 2 })}</CampoF>
        <CampoF nome="cep" rotulo="CEP">{entrada({ value: v.cep, onChange: muda('cep'), required: true, inputMode: 'numeric', placeholder: '72110120' })}</CampoF>
        <CampoF nome="latitude" rotulo="Latitude">{entrada({ value: v.latitude, onChange: muda('latitude'), required: true, inputMode: 'decimal', placeholder: '-15.8335' })}</CampoF>
        <CampoF nome="longitude" rotulo="Longitude">{entrada({ value: v.longitude, onChange: muda('longitude'), required: true, inputMode: 'decimal', placeholder: '-48.0566' })}</CampoF>
      </div>
      <CampoF nome="canalProsioId" rotulo="Canal de WhatsApp">
        {(id) => (
          <select id={id} value={v.canalProsioId} onChange={muda('canalProsioId')} className={CLASSE_ENTRADA}>
            <option value="">Sem canal</option>
            {canais.filter((c) => c.ativo || c.id === v.canalProsioId).map((c) => (
              <option key={c.id} value={c.id}>{c.nome} · {c.tipo === 'WABA' ? 'número oficial' : 'número atual'}{c.compartilhado ? ' · compartilhado' : ''}{c.ativo ? '' : ' · desativado'}</option>
            ))}
          </select>
        )}
      </CampoF>
      {canal?.compartilhado && (
        <CampoF nome="prosioUnidadeRef" rotulo="Referência da unidade no canal" dica="Identifica a caixa da unidade no Prosio">
          {entrada({ value: v.prosioUnidadeRef, onChange: muda('prosioUnidadeRef'), required: true, maxLength: 64 })}
        </CampoF>
      )}
      <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
        <input type="checkbox" checked={v.mediacaoAtiva} onChange={muda('mediacaoAtiva')} className="size-5" />
        Mediação carteiro ↔ destinatário ativa
      </label>
      {base && (
        <>
          <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
            <input type="checkbox" checked={v.ativa} onChange={muda('ativa')} className="size-5" />
            Unidade ativa
          </label>
          {!v.ativa && (
            <p className="m-0 rounded-lg bg-ce-corrigir-bg px-3 py-2.5 text-sm font-semibold leading-normal text-ce-corrigir">
              Desativada, a unidade não carrega pacotes nem cadastra rotas e carteiros.
            </p>
          )}
        </>
      )}
    </DialogoFormulario>
  );
}

// ——— Supervisores ————————————————————————————————————————————————————

export function FormSupervisor({ supervisor, unidades, aoFechar, aoSalvar }: { supervisor: Supervisor | null; unidades: UnidadeGestao[]; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const celularOriginal = supervisor?.telefoneCelular ? formatarWhatsapp(supervisor.telefoneCelular) : '';
  const [v, setV] = useState({
    nome: supervisor?.nome ?? '',
    email: supervisor?.email ?? '',
    matricula: supervisor?.matricula ?? '',
    telefoneCelular: celularOriginal,
    unidadeId: supervisor?.unidadeId ?? unidades[0]?.id ?? '',
    senha: '',
  });
  const [ativo, setAtivo] = useState(supervisor?.ativo ?? true);
  const muda = (k: keyof typeof v) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((a) => ({ ...a, [k]: e.target.value }));

  return (
    <DialogoFormulario
      titulo={supervisor ? `Editar ${supervisor.nome}` : 'Novo supervisor'}
      aberto
      aoFechar={aoFechar}
      aoEnviar={async () => {
        if (supervisor) {
          await entregasApi.editarSupervisor(supervisor.id, {
            nome: v.nome.trim(),
            ativo,
            unidadeId: v.unidadeId,
            // O celular só vai quando muda: o servidor o valida e normaliza de novo.
            ...(v.telefoneCelular.trim() !== celularOriginal ? { telefoneCelular: v.telefoneCelular.trim() } : {}),
          });
          toast.success('Supervisor atualizado.');
        } else {
          await entregasApi.criarSupervisor({ ...v, nome: v.nome.trim(), email: v.email.trim() });
          toast.success(`Supervisor ${v.nome.trim()} cadastrado.`);
        }
        await aoSalvar();
      }}
    >
      <CampoF nome="nome" rotulo="Nome">{entrada({ value: v.nome, onChange: muda('nome'), required: true, minLength: 3 })}</CampoF>
      {supervisor ? (
        <p className="m-0 text-sm leading-normal text-ce-suave">
          Acesso: {supervisor.email ?? 'sem e-mail'} · matrícula {supervisor.matricula ?? '—'}
        </p>
      ) : (
        <>
          <CampoF nome="email" rotulo="E-mail de acesso">{entrada({ value: v.email, onChange: muda('email'), required: true, type: 'email' })}</CampoF>
          <CampoF nome="matricula" rotulo="Matrícula" dica="8 dígitos, com ou sem pontos">{entrada({ value: v.matricula, onChange: muda('matricula'), required: true })}</CampoF>
        </>
      )}
      <CampoF nome="telefoneCelular" rotulo="WhatsApp" dica="Com DDD, ex.: (61) 99301-2210">{entrada({ value: v.telefoneCelular, onChange: muda('telefoneCelular'), required: true, inputMode: 'tel' })}</CampoF>
      <CampoF nome="unidadeId" rotulo="Unidade">
        {(id) => (
          <select id={id} value={v.unidadeId} onChange={muda('unidadeId')} required className={CLASSE_ENTRADA}>
            <option value="">Escolha a unidade</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}{u.ativa ? '' : ' · desativada'}</option>)}
          </select>
        )}
      </CampoF>
      {supervisor ? (
        <>
          <Marcador marcado={ativo} aoMudar={setAtivo}>Supervisor ativo</Marcador>
          {(!ativo && supervisor.ativo) && (
            <p className="m-0 rounded-lg bg-ce-corrigir-bg px-3 py-2.5 text-sm font-semibold leading-normal text-ce-corrigir">
              Desativado, o supervisor perde o acesso na próxima ação que fizer.
            </p>
          )}
          {v.unidadeId !== (supervisor.unidadeId ?? '') && (
            <p className="m-0 rounded-lg bg-ce-linha-fraca px-3 py-2.5 text-sm leading-normal text-ce-tinta-2">
              A troca de unidade vale na próxima ação do supervisor: ele passa a ver só a nova unidade.
            </p>
          )}
        </>
      ) : (
        <CampoF nome="senha" rotulo="Senha inicial" dica="Mínimo de 6 caracteres">{entrada({ value: v.senha, onChange: muda('senha'), required: true, minLength: 6, type: 'password', autoComplete: 'new-password' })}</CampoF>
      )}
    </DialogoFormulario>
  );
}
