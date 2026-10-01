/**
 * Cadastro (US-001–US-006, ADR-009/010): abas Unidades, Supervisores e Canais
 * (só a Gestão) e Distritos, Carteiros, Agências e lockers (o supervisor grava
 * na própria unidade; a Gestão consulta a unidade em foco). Na aba Distritos,
 * o carteiro do dia (troca só para hoje).
 */
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasCadastroStore } from '@/stores/entregas-cadastro.store';
import { useEntregasContextoStore } from '@/stores/entregas-contexto.store';
import { entregasApi } from '../entregas.api';
import type { CanalProsio, CarteiroCadastro, CartaoDistrito, Distrito, PontoRetirada, Quadro, TipoPonto, UnidadeGestao } from '../entregas.types';
import { avisarErro, formatarDataCurta, formatarWhatsapp } from '../mensagens';
import { Botao, CLASSE_ENTRADA, CabecalhoPagina, Campo, Cartao, Carregando, Dialogo, FOCO, Pilula } from '../components/ui';

type Aba = 'unidades' | 'supervisores' | 'canais' | 'distritos' | 'carteiros' | 'pontos';

const ABAS: Record<Aba, { rotulo: string; acao: string; dica: string; gestao: boolean }> = {
  unidades: { rotulo: 'Unidades', acao: 'Nova unidade', dica: 'Cadastrado pela Gestão (sede): tipo, endereço e canal de WhatsApp de cada unidade.', gestao: true },
  supervisores: { rotulo: 'Supervisores', acao: 'Novo supervisor', dica: 'Cadastrado pela Gestão. Cada supervisor vê só a própria unidade.', gestao: true },
  canais: { rotulo: 'Canais de WhatsApp', acao: 'Novo canal', dica: 'Canais do Prosio usados pelas unidades. Os segredos nunca voltam depois de gravados.', gestao: true },
  distritos: { rotulo: 'Distritos', acao: 'Novo distrito', dica: 'Cada distrito é uma rota com um carteiro padrão.', gestao: false },
  carteiros: { rotulo: 'Carteiros', acao: 'Novo carteiro', dica: 'Carteiros da unidade. Recebem as orientações pelo WhatsApp, sem login.', gestao: false },
  pontos: { rotulo: 'Agências e lockers', acao: 'Novo ponto de retirada', dica: 'Oferecidos ao destinatário em “Deixar na agência” e “Deixar no locker”. Até 10 ativos de cada tipo.', gestao: false },
};

const ABAS_UNIDADE: Aba[] = ['distritos', 'carteiros', 'pontos'];
const ABAS_GESTAO: Aba[] = ['unidades', 'supervisores', 'canais', 'distritos', 'carteiros', 'pontos'];

// ——— Tabela ———————————————————————————————————————————————————————

function Tabela({ colunas, linhas, vazio, rotulo }: { colunas: string[]; linhas: Array<{ id: string; celulas: ReactNode[] }> | null; vazio: string; rotulo: string }) {
  if (!linhas) return <Carregando />;
  return (
    <Cartao className="overflow-x-auto" aria-label={rotulo}>
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.06em] text-ce-suave">
            {colunas.map((c, i) => (
              <th key={i} scope="col" className="px-5 py-3 font-semibold">{c || <span className="sr-only">Ações</span>}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-t border-ce-linha-fraca">
              {l.celulas.map((c, i) => <td key={i} className="px-5 py-3.5">{c}</td>)}
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr><td colSpan={colunas.length} className="px-5 py-6 text-ce-suave">{vazio}</td></tr>
          )}
        </tbody>
      </table>
    </Cartao>
  );
}

function Situacao({ ativo, feminino = false, extra }: { ativo: boolean; feminino?: boolean; extra?: string }) {
  const texto = ativo ? (feminino ? 'Ativa' : 'Ativo') : feminino ? 'Inativa' : 'Inativo';
  return <span className={ativo ? '' : 'text-ce-suave'}>{texto}{extra ? ` · ${extra}` : ''}</span>;
}

/** Formulário num diálogo: `aoEnviar` grava; erro → toast, o diálogo continua aberto. */
function DialogoFormulario({ titulo, aberto, aoFechar, aoEnviar, rotuloEnviar = 'Salvar', children }: {
  titulo: string;
  aberto: boolean;
  aoFechar: () => void;
  aoEnviar: () => Promise<void>;
  rotuloEnviar?: string;
  children: ReactNode;
}) {
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await aoEnviar();
    } catch (err) {
      avisarErro(err, 'Não foi possível salvar.');
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Dialogo titulo={titulo} aberto={aberto} aoFechar={aoFechar} largura="max-w-[560px]">
      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3.5">
        {children}
        <div className="flex flex-wrap justify-end gap-2.5 pt-1">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}>{enviando ? 'Salvando…' : rotuloEnviar}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

const entrada = (props: InputHTMLAttributes<HTMLInputElement>) => (id: string) => <input id={id} className={CLASSE_ENTRADA} {...props} />;

// ——— Distritos ———————————————————————————————————————————————————————

function FormDistrito({ distrito, carteiros, aoFechar, aoSalvar }: { distrito: Distrito | null; carteiros: CarteiroCadastro[]; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const [codigo, setCodigo] = useState(distrito?.codigo ?? '');
  const [nome, setNome] = useState(distrito?.nome ?? '');
  const [carteiroPadraoId, setCarteiro] = useState(distrito?.carteiroPadrao?.id ?? '');
  const [ativo, setAtivo] = useState(distrito?.ativo ?? true);
  return (
    <DialogoFormulario
      titulo={distrito ? `Editar ${distrito.codigo}` : 'Novo distrito'}
      aberto
      aoFechar={aoFechar}
      aoEnviar={async () => {
        const dados = { codigo: codigo.trim(), nome: nome.trim(), carteiroPadraoId: carteiroPadraoId || null };
        if (distrito) await entregasApi.editarDistrito(distrito.id, { ...dados, ativo, atualizadoEm: distrito.atualizadoEm });
        else await entregasApi.criarDistrito(dados);
        toast.success(distrito ? 'Distrito atualizado.' : `Distrito ${dados.codigo.toUpperCase()} cadastrado.`);
        await aoSalvar();
      }}
    >
      <Campo rotulo="Código">{entrada({ value: codigo, onChange: (e) => setCodigo(e.target.value), required: true, maxLength: 20, placeholder: 'D-09' })}</Campo>
      <Campo rotulo="Nome">{entrada({ value: nome, onChange: (e) => setNome(e.target.value), required: true, maxLength: 80, placeholder: 'Taguatinga Oeste' })}</Campo>
      <Campo rotulo="Carteiro padrão">
        {(id) => (
          <select id={id} value={carteiroPadraoId} onChange={(e) => setCarteiro(e.target.value)} className={CLASSE_ENTRADA}>
            <option value="">Sem carteiro padrão</option>
            {carteiros.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome ?? c.matricula}</option>)}
          </select>
        )}
      </Campo>
      {distrito && (
        <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-5" /> Distrito ativo
        </label>
      )}
    </DialogoFormulario>
  );
}

function CarteiroDoDia({ distritos, carteiros, quadro, aoMudar }: { distritos: Distrito[]; carteiros: CarteiroCadastro[]; quadro: Quadro | null; aoMudar: () => Promise<void> }) {
  const [salvando, setSalvando] = useState<string | null>(null);
  if (!quadro) return null;
  const cartoes = new Map<string, CartaoDistrito>(quadro.distritos.map((c) => [c.distritoId, c]));
  const ativos = distritos.filter((d) => d.ativo);
  if (ativos.length === 0) return null;

  async function trocar(d: Distrito, carteiroId: string) {
    setSalvando(d.id);
    try {
      await entregasApi.definirEscala(d.id, quadro!.data, carteiroId || null);
      toast.success(`Carteiro de hoje do ${d.codigo} atualizado.`);
      await aoMudar();
    } catch (err) {
      avisarErro(err, 'Não foi possível trocar o carteiro do dia.');
    } finally {
      setSalvando(null);
    }
  }

  return (
    <Cartao aria-labelledby="carteiro-dia-titulo" className="flex flex-col gap-3.5 p-5">
      <h2 id="carteiro-dia-titulo" className="m-0 text-lg font-bold">Carteiro do dia · {formatarDataCurta(quadro.data)}</h2>
      <p className="m-0 text-sm text-ce-suave">A troca vale só para hoje. Amanhã volta o carteiro padrão do distrito.</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
        {ativos.map((d) => {
          const cartao = cartoes.get(d.id);
          const doDia = cartao?.carteiro?.id ?? '';
          const padrao = d.carteiroPadrao?.ativo ? d.carteiroPadrao : null;
          const valor = doDia && doDia !== padrao?.id ? doDia : '';
          const semCarteiro = cartao?.semCarteiro ?? !padrao;
          const liberado = cartao ? cartao.status !== 'PENDENTE_UPLOAD' && cartao.status !== 'DADOS_CARREGADOS' : false;
          const id = `escala-${d.id}`;
          return (
            <div key={d.id} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="text-sm font-semibold">{d.codigo} · {d.nome}</label>
              <select
                id={id}
                value={valor}
                disabled={salvando === d.id}
                onChange={(e) => void trocar(d, e.target.value)}
                className={`${CLASSE_ENTRADA} ${semCarteiro ? 'border-[#e0a400] bg-[#fffbef]' : ''}`}
              >
                <option value="">{padrao ? `${padrao.nome} (padrão)` : 'Escolha o carteiro de hoje'}</option>
                {carteiros.filter((c) => c.ativo && c.id !== padrao?.id).map((c) => <option key={c.id} value={c.id}>{c.nome ?? c.matricula}</option>)}
              </select>
              {semCarteiro && <span className="text-[13px] text-[#8a5a00]">Sem carteiro: o distrito não pode ser liberado</span>}
              {liberado && <span className="text-[13px] text-ce-suave">Já liberado: o novo carteiro recebe o resumo das orientações.</span>}
            </div>
          );
        })}
      </div>
    </Cartao>
  );
}

// ——— Carteiros ———————————————————————————————————————————————————————

function FormCarteiro({ carteiro, distritos, aoFechar, aoSalvar }: { carteiro: CarteiroCadastro | null; distritos: Distrito[]; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const [nome, setNome] = useState(carteiro?.nome ?? '');
  const [matricula, setMatricula] = useState(carteiro?.matricula ?? '');
  const [whatsapp, setWhatsapp] = useState(carteiro ? formatarWhatsapp(carteiro.whatsapp).replace('—', '') : '');
  const [distritoPadraoId, setDistrito] = useState(carteiro?.distritosPadrao[0]?.id ?? '');
  const [ativo, setAtivo] = useState(carteiro?.ativo ?? true);
  return (
    <DialogoFormulario
      titulo={carteiro ? `Editar ${carteiro.nome ?? carteiro.matricula}` : 'Novo carteiro'}
      aberto
      aoFechar={aoFechar}
      aoEnviar={async () => {
        const dados = { nome: nome.trim(), matricula: matricula.trim(), whatsapp: whatsapp.trim(), distritoPadraoId: distritoPadraoId || null };
        if (carteiro) await entregasApi.editarCarteiro(carteiro.id, { ...dados, ativo, atualizadoEm: carteiro.atualizadoEm });
        else await entregasApi.criarCarteiro(dados);
        toast.success(carteiro ? 'Carteiro atualizado.' : 'Carteiro cadastrado.');
        await aoSalvar();
      }}
    >
      <Campo rotulo="Nome">{entrada({ value: nome, onChange: (e) => setNome(e.target.value), required: true, minLength: 2, maxLength: 120 })}</Campo>
      <Campo rotulo="Matrícula" dica="8 dígitos, com ou sem pontos">{entrada({ value: matricula, onChange: (e) => setMatricula(e.target.value), required: true, maxLength: 20 })}</Campo>
      <Campo rotulo="WhatsApp" dica="Com DDD, ex.: (61) 99155-3301">{entrada({ value: whatsapp, onChange: (e) => setWhatsapp(e.target.value), required: true, inputMode: 'tel' })}</Campo>
      <Campo rotulo="Distrito padrão">
        {(id) => (
          <select id={id} value={distritoPadraoId} onChange={(e) => setDistrito(e.target.value)} className={CLASSE_ENTRADA}>
            <option value="">— (volante)</option>
            {distritos.filter((d) => d.ativo).map((d) => <option key={d.id} value={d.id}>{d.codigo} · {d.nome}</option>)}
          </select>
        )}
      </Campo>
      {carteiro && (
        <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-5" /> Carteiro ativo
        </label>
      )}
    </DialogoFormulario>
  );
}

/** Senha temporária do app de captura (ADR-004): o carteiro troca no primeiro acesso. */
function FormSenhaCarteiro({ carteiro, aoFechar, aoSalvar }: { carteiro: CarteiroCadastro; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const [senha, setSenha] = useState('');
  const nome = carteiro.nome ?? carteiro.matricula;
  return (
    <DialogoFormulario
      titulo={`Definir senha · ${nome}`}
      aberto
      aoFechar={aoFechar}
      rotuloEnviar="Definir senha"
      aoEnviar={async () => {
        await entregasApi.definirSenhaCarteiro(carteiro.id, senha);
        toast.success(`Senha de ${nome} definida. Passe-a ao carteiro: ele cria a própria senha no primeiro acesso.`);
        await aoSalvar();
      }}
    >
      <p className="m-0 text-[15px] leading-normal text-ce-tinta-2">
        O carteiro entra no app de captura com a matrícula <strong className="font-codigo">{carteiro.matricula}</strong> e esta senha.
        {carteiro.possuiLogin && ' A senha atual deixa de valer e o aparelho dele pede um novo login.'}
      </p>
      <Campo rotulo="Senha temporária" dica="De 8 a 72 caracteres.">
        {entrada({ value: senha, onChange: (e) => setSenha(e.target.value), required: true, minLength: 8, maxLength: 72, autoComplete: 'off', spellCheck: false })}
      </Campo>
    </DialogoFormulario>
  );
}

// ——— Pontos de retirada ——————————————————————————————————————————————

function FormPonto({ ponto, aoFechar, aoSalvar }: { ponto: PontoRetirada | null; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const [tipo, setTipo] = useState<TipoPonto>(ponto?.tipo ?? 'AGENCIA');
  const [nome, setNome] = useState(ponto?.nome ?? '');
  const [endereco, setEndereco] = useState(ponto?.endereco ?? '');
  const [horario, setHorario] = useState(ponto?.horario ?? '');
  const [ativo, setAtivo] = useState(ponto?.ativo ?? true);
  return (
    <DialogoFormulario
      titulo={ponto ? `Editar ${ponto.nome}` : 'Novo ponto de retirada'}
      aberto
      aoFechar={aoFechar}
      aoEnviar={async () => {
        const dados = { tipo, nome: nome.trim(), endereco: endereco.trim(), horario: horario.trim() };
        if (ponto) await entregasApi.editarPonto(ponto.id, { ...dados, ativo, atualizadoEm: ponto.atualizadoEm });
        else await entregasApi.criarPonto(dados);
        toast.success(ponto ? 'Ponto atualizado.' : 'Ponto de retirada cadastrado.');
        await aoSalvar();
      }}
    >
      <Campo rotulo="Tipo">
        {(id) => (
          <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value as TipoPonto)} className={CLASSE_ENTRADA}>
            <option value="AGENCIA">Agência</option>
            <option value="LOCKER">Locker</option>
          </select>
        )}
      </Campo>
      <Campo rotulo="Nome (até 24 caracteres)" dica={`${nome.length}/24 · aparece na lista do WhatsApp`}>
        {entrada({ value: nome, onChange: (e) => setNome(e.target.value), required: true, maxLength: 24 })}
      </Campo>
      <Campo rotulo="Endereço">{entrada({ value: endereco, onChange: (e) => setEndereco(e.target.value), required: true, minLength: 3, maxLength: 200 })}</Campo>
      <Campo rotulo="Horário">{entrada({ value: horario, onChange: (e) => setHorario(e.target.value), required: true, minLength: 2, maxLength: 120, placeholder: 'Seg–sex 9h–17h' })}</Campo>
      {ponto && (
        <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-5" /> Ponto ativo
        </label>
      )}
    </DialogoFormulario>
  );
}

// ——— Gestão: canais, unidades e supervisores ——————————————————————————

function FormCanal({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: (c: CanalProsio) => Promise<void> }) {
  const [nome, setNome] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [callbackSecret, setSegredo] = useState('');
  const [tipo, setTipo] = useState<'WAHA' | 'WABA'>('WAHA');
  const [compartilhado, setCompartilhado] = useState(false);
  return (
    <DialogoFormulario
      titulo="Novo canal de WhatsApp"
      aberto
      aoFechar={aoFechar}
      rotuloEnviar="Criar canal"
      aoEnviar={async () => {
        const canal = await entregasApi.criarCanal({ nome: nome.trim(), baseUrl: baseUrl.trim(), apiKey, callbackSecret, tipo, compartilhado });
        await aoCriar(canal);
      }}
    >
      <Campo rotulo="Nome">{entrada({ value: nome, onChange: (e) => setNome(e.target.value), required: true, minLength: 2, maxLength: 80 })}</Campo>
      <Campo rotulo="Endereço do Prosio" dica="Ex.: https://prosio.com.br">{entrada({ value: baseUrl, onChange: (e) => setBaseUrl(e.target.value), required: true, type: 'url' })}</Campo>
      <Campo rotulo="Chave de API do Prosio">{entrada({ value: apiKey, onChange: (e) => setApiKey(e.target.value), required: true, minLength: 8, type: 'password', autoComplete: 'off' })}</Campo>
      <Campo rotulo="Segredo dos callbacks" dica="Mínimo de 16 caracteres">{entrada({ value: callbackSecret, onChange: (e) => setSegredo(e.target.value), required: true, minLength: 16, type: 'password', autoComplete: 'off' })}</Campo>
      <Campo rotulo="Tipo do número">
        {(id) => (
          <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value as 'WAHA' | 'WABA')} className={CLASSE_ENTRADA}>
            <option value="WAHA">Número atual (WAHA)</option>
            <option value="WABA">Número oficial (WABA)</option>
          </select>
        )}
      </Campo>
      <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
        <input type="checkbox" checked={compartilhado} onChange={(e) => setCompartilhado(e.target.checked)} className="size-5" />
        Canal compartilhado entre unidades
      </label>
    </DialogoFormulario>
  );
}

function FormUnidade({ unidade, canais, aoFechar, aoSalvar }: { unidade: UnidadeGestao | null; canais: CanalProsio[]; aoFechar: () => void; aoSalvar: (u: UnidadeGestao) => Promise<void> }) {
  const [v, setV] = useState({
    codigo: '', nome: unidade?.nome ?? '', tipo: (unidade?.tipo ?? 'CDD') as string, logradouro: '', numero: '', bairro: '', cidade: '', uf: 'DF', cep: '',
    latitude: '', longitude: '',
    canalProsioId: unidade?.canalProsioId ?? '', prosioUnidadeRef: unidade?.prosioUnidadeRef ?? '', mediacaoAtiva: unidade?.mediacaoAtiva ?? false,
  });
  const muda = (k: keyof typeof v) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((a) => ({ ...a, [k]: e.target instanceof HTMLInputElement && e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const canal = canais.find((c) => c.id === v.canalProsioId);
  const camposCanal = {
    canalProsioId: v.canalProsioId || null,
    canal: canal?.tipo ?? null,
    prosioUnidadeRef: canal?.compartilhado ? v.prosioUnidadeRef.trim() || null : null,
    mediacaoAtiva: v.mediacaoAtiva,
  };
  return (
    <DialogoFormulario
      titulo={unidade ? `Editar ${unidade.nome}` : 'Nova unidade'}
      aberto
      aoFechar={aoFechar}
      aoEnviar={async () => {
        const salva = unidade
          ? await entregasApi.editarUnidade(unidade.id, { nome: v.nome.trim(), tipo: v.tipo, ...camposCanal })
          : await entregasApi.criarUnidade({
            codigo: v.codigo.trim(), nome: v.nome.trim(), tipo: v.tipo,
            logradouro: v.logradouro.trim(), numero: v.numero.trim(), bairro: v.bairro.trim(), cidade: v.cidade.trim(),
            uf: v.uf.trim().toUpperCase(), cep: v.cep.replace(/\D/g, ''),
            latitude: Number(v.latitude.replace(',', '.')), longitude: Number(v.longitude.replace(',', '.')),
            ...camposCanal,
          });
        toast.success(unidade ? 'Unidade atualizada.' : `Unidade ${salva.nome} cadastrada.`);
        await aoSalvar(salva);
      }}
    >
      {!unidade && <Campo rotulo="Código da unidade">{entrada({ value: v.codigo, onChange: muda('codigo'), required: true, minLength: 3 })}</Campo>}
      <Campo rotulo="Nome">{entrada({ value: v.nome, onChange: muda('nome'), required: true, minLength: 3 })}</Campo>
      <Campo rotulo="Tipo">
        {(id) => (
          <select id={id} value={v.tipo} onChange={muda('tipo')} className={CLASSE_ENTRADA}>
            <option value="CDD">CDD</option>
            <option value="CEE">CEE</option>
          </select>
        )}
      </Campo>
      {!unidade && (
        <>
          <Campo rotulo="Logradouro">{entrada({ value: v.logradouro, onChange: muda('logradouro'), required: true, minLength: 3 })}</Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Número">{entrada({ value: v.numero, onChange: muda('numero'), required: true })}</Campo>
            <Campo rotulo="Bairro">{entrada({ value: v.bairro, onChange: muda('bairro'), required: true, minLength: 2 })}</Campo>
            <Campo rotulo="Cidade">{entrada({ value: v.cidade, onChange: muda('cidade'), required: true, minLength: 2 })}</Campo>
            <Campo rotulo="UF">{entrada({ value: v.uf, onChange: muda('uf'), required: true, minLength: 2, maxLength: 2 })}</Campo>
            <Campo rotulo="CEP">{entrada({ value: v.cep, onChange: muda('cep'), required: true, inputMode: 'numeric', placeholder: '72110120' })}</Campo>
            <span />
            <Campo rotulo="Latitude">{entrada({ value: v.latitude, onChange: muda('latitude'), required: true, inputMode: 'decimal', placeholder: '-15.8335' })}</Campo>
            <Campo rotulo="Longitude">{entrada({ value: v.longitude, onChange: muda('longitude'), required: true, inputMode: 'decimal', placeholder: '-48.0566' })}</Campo>
          </div>
        </>
      )}
      <Campo rotulo="Canal de WhatsApp">
        {(id) => (
          <select id={id} value={v.canalProsioId} onChange={muda('canalProsioId')} className={CLASSE_ENTRADA}>
            <option value="">Sem canal</option>
            {canais.filter((c) => c.ativo).map((c) => (
              <option key={c.id} value={c.id}>{c.nome} · {c.tipo === 'WABA' ? 'número oficial' : 'número atual'}{c.compartilhado ? ' · compartilhado' : ''}</option>
            ))}
          </select>
        )}
      </Campo>
      {canal?.compartilhado && (
        <Campo rotulo="Referência da unidade no canal" dica="Identifica a caixa da unidade no Prosio">
          {entrada({ value: v.prosioUnidadeRef, onChange: muda('prosioUnidadeRef'), required: true, maxLength: 64 })}
        </Campo>
      )}
      <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
        <input type="checkbox" checked={v.mediacaoAtiva} onChange={muda('mediacaoAtiva')} className="size-5" />
        Mediação carteiro ↔ destinatário ativa
      </label>
    </DialogoFormulario>
  );
}

function FormSupervisor({ unidades, aoFechar, aoSalvar }: { unidades: UnidadeGestao[]; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const [v, setV] = useState({ nome: '', email: '', matricula: '', telefoneCelular: '', unidadeId: unidades[0]?.id ?? '', senha: '' });
  const muda = (k: keyof typeof v) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((a) => ({ ...a, [k]: e.target.value }));
  return (
    <DialogoFormulario
      titulo="Novo supervisor"
      aberto
      aoFechar={aoFechar}
      aoEnviar={async () => {
        await entregasApi.criarSupervisor({ ...v, nome: v.nome.trim(), email: v.email.trim() });
        toast.success(`Supervisor ${v.nome.trim()} cadastrado.`);
        await aoSalvar();
      }}
    >
      <Campo rotulo="Nome">{entrada({ value: v.nome, onChange: muda('nome'), required: true, minLength: 3 })}</Campo>
      <Campo rotulo="E-mail de acesso">{entrada({ value: v.email, onChange: muda('email'), required: true, type: 'email' })}</Campo>
      <Campo rotulo="Matrícula" dica="8 dígitos, com ou sem pontos">{entrada({ value: v.matricula, onChange: muda('matricula'), required: true })}</Campo>
      <Campo rotulo="WhatsApp" dica="Com DDD, ex.: (61) 99301-2210">{entrada({ value: v.telefoneCelular, onChange: muda('telefoneCelular'), required: true, inputMode: 'tel' })}</Campo>
      <Campo rotulo="Unidade">
        {(id) => (
          <select id={id} value={v.unidadeId} onChange={muda('unidadeId')} required className={CLASSE_ENTRADA}>
            <option value="">Escolha a unidade</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        )}
      </Campo>
      <Campo rotulo="Senha inicial" dica="Mínimo de 6 caracteres">{entrada({ value: v.senha, onChange: muda('senha'), required: true, minLength: 6, type: 'password', autoComplete: 'new-password' })}</Campo>
    </DialogoFormulario>
  );
}

// ——— Página ———————————————————————————————————————————————————————

type Edicao =
  | { tipo: 'distrito'; item: Distrito | null }
  | { tipo: 'carteiro'; item: CarteiroCadastro | null }
  | { tipo: 'senha'; item: CarteiroCadastro }
  | { tipo: 'ponto'; item: PontoRetirada | null }
  | { tipo: 'unidade'; item: UnidadeGestao | null }
  | { tipo: 'supervisor' }
  | { tipo: 'canal' }
  | null;

export function CadastroPage() {
  const user = useAuthStore((s) => s.user);
  const unidadeNomeSalvo = useAuthStore((s) => s.unidadeNome);
  const ehGestao = user?.role === 'GESTAO';
  const unidadeGestaoId = useEntregasContextoStore((s) => s.unidadeGestaoId);
  const escolherUnidade = useEntregasContextoStore((s) => s.escolherUnidade);
  const cad = useEntregasCadastroStore();
  const [params, setParams] = useSearchParams();
  const abas = ehGestao ? ABAS_GESTAO : ABAS_UNIDADE;
  const pedida = params.get('aba') as Aba | null;
  const aba: Aba = pedida && abas.includes(pedida) ? pedida : abas[0];
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [token, setToken] = useState<CanalProsio | null>(null);
  const [quadro, setQuadro] = useState<Quadro | null>(null);

  const unidadeId = ehGestao ? unidadeGestaoId ?? undefined : undefined;
  const operacional = !ABAS[aba].gestao;
  const podeEditar = !ehGestao || ABAS[aba].gestao;
  const unidadeFoco = ehGestao ? cad.unidades?.find((u) => u.id === unidadeGestaoId) : null;

  const recarregar = useCallback(async () => {
    try {
      if (operacional) {
        if (ehGestao && !unidadeId) return;
        await Promise.all([cad.carregarDistritos(unidadeId), cad.carregarCarteiros(unidadeId), aba === 'pontos' ? cad.carregarPontos(unidadeId) : null]);
        if (aba === 'distritos' && !ehGestao) setQuadro(await entregasApi.quadro({}));
      } else if (aba === 'canais') {
        await cad.carregarCanais();
      } else if (aba === 'unidades') {
        await Promise.all([cad.carregarUnidades(), cad.carregarCanais()]);
      } else {
        await Promise.all([cad.carregarSupervisores(), cad.carregarUnidades()]);
      }
    } catch (err) {
      avisarErro(err, 'Não foi possível carregar o cadastro.');
    }
    // `cad` é o store inteiro; as funções dele são estáveis.
  }, [aba, operacional, ehGestao, unidadeId]);

  useEffect(() => {
    if (operacional) cad.limparUnidade();
    void recarregar();
  }, [recarregar]);

  const fechar = () => setEdicao(null);
  const salvarERecarregar = async () => {
    setEdicao(null);
    await recarregar();
  };

  const linhas = useMemo(() => {
    const editar = (rotulo: string, fn: () => void) => (
      <Botao variante="texto" onClick={fn} aria-label={rotulo}>Editar</Botao>
    );
    switch (aba) {
      case 'distritos':
        return cad.distritos?.map((d) => ({
          id: d.id,
          celulas: [
            <span className="font-codigo font-medium">{d.codigo}</span>,
            d.nome,
            d.carteiroPadrao?.nome ?? '—',
            <Situacao ativo={d.ativo} extra={!d.carteiroPadrao ? 'sem carteiro padrão' : undefined} />,
            podeEditar ? editar(`Editar ${d.codigo}`, () => setEdicao({ tipo: 'distrito', item: d })) : null,
          ],
        })) ?? null;
      case 'carteiros':
        return cad.carteiros?.map((c) => ({
          id: c.id,
          celulas: [
            c.nome ?? '—',
            c.matricula,
            <span className="tabular-nums">{formatarWhatsapp(c.whatsapp)}</span>,
            c.distritosPadrao.map((d) => d.codigo).join(', ') || '— (volante)',
            <Situacao ativo={c.ativo} />,
            podeEditar ? (
              <div className="flex flex-wrap gap-x-1">
                {editar(`Editar ${c.nome ?? c.matricula}`, () => setEdicao({ tipo: 'carteiro', item: c }))}
                <Botao variante="texto" onClick={() => setEdicao({ tipo: 'senha', item: c })} aria-label={`Definir senha de ${c.nome ?? c.matricula}`}>Definir senha</Botao>
              </div>
            ) : null,
          ],
        })) ?? null;
      case 'pontos':
        return cad.pontos?.map((p) => ({
          id: p.id,
          celulas: [
            p.nome,
            p.tipo === 'AGENCIA' ? 'Agência' : 'Locker',
            p.endereco,
            p.horario,
            <Situacao ativo={p.ativo} feminino={p.tipo === 'AGENCIA'} />,
            podeEditar ? editar(`Editar ${p.nome}`, () => setEdicao({ tipo: 'ponto', item: p })) : null,
          ],
        })) ?? null;
      case 'unidades':
        return cad.unidades?.map((u) => ({
          id: u.id,
          celulas: [
            u.nome,
            u.tipo,
            `${u.logradouro} ${u.numero} · ${u.bairro} · ${u.uf}`,
            u.canalProsio ? `${u.canalProsio.tipo === 'WABA' ? 'Número oficial (WABA)' : 'Número atual (WAHA)'} · ${u.canalProsio.nome}` : '—',
            u.semSupervisor ? '0 · sem supervisor' : String(u.supervisoresAtivos),
            editar(`Editar ${u.nome}`, () => setEdicao({ tipo: 'unidade', item: u })),
          ],
        })) ?? null;
      case 'supervisores':
        return cad.supervisores?.map((s) => ({
          id: s.id,
          celulas: [s.nome, s.matricula ?? '—', <span className="tabular-nums">{formatarWhatsapp(s.telefoneCelular)}</span>, s.unidade?.nome ?? '—', <Situacao ativo={s.ativo} />],
        })) ?? null;
      case 'canais':
        return cad.canais?.map((c) => ({
          id: c.id,
          celulas: [c.nome, c.baseUrl, c.tipo === 'WABA' ? 'Número oficial (WABA)' : 'Número atual (WAHA)', c.compartilhado ? 'Sim' : 'Não', String(c.unidades ?? 0), <Situacao ativo={c.ativo} />],
        })) ?? null;
      default:
        return null;
    }
  }, [aba, cad.distritos, cad.carteiros, cad.pontos, cad.unidades, cad.supervisores, cad.canais, podeEditar]);

  const colunas: Record<Aba, string[]> = {
    distritos: ['Código', 'Nome', 'Carteiro padrão', 'Situação', ''],
    carteiros: ['Nome', 'Matrícula', 'WhatsApp', 'Distrito padrão', 'Situação', ''],
    pontos: ['Nome', 'Tipo', 'Endereço', 'Horário', 'Situação', ''],
    unidades: ['Unidade', 'Tipo', 'Endereço', 'Canal de WhatsApp', 'Supervisores', ''],
    supervisores: ['Nome', 'Matrícula', 'WhatsApp', 'Unidade', 'Situação'],
    canais: ['Nome', 'Endereço do Prosio', 'Tipo', 'Compartilhado', 'Unidades', 'Situação'],
  };

  function novo() {
    if (aba === 'distritos') setEdicao({ tipo: 'distrito', item: null });
    else if (aba === 'carteiros') setEdicao({ tipo: 'carteiro', item: null });
    else if (aba === 'pontos') setEdicao({ tipo: 'ponto', item: null });
    else if (aba === 'unidades') setEdicao({ tipo: 'unidade', item: null });
    else if (aba === 'supervisores') setEdicao({ tipo: 'supervisor' });
    else setEdicao({ tipo: 'canal' });
  }

  const unidadeNome = ehGestao ? unidadeFoco?.nome : user?.unidade?.nome ?? unidadeNomeSalvo;
  const dica = operacional && unidadeNome ? `${unidadeNome} · ${ABAS[aba].dica}` : ABAS[aba].dica;

  return (
    <>
      <CabecalhoPagina
        titulo="Cadastro"
        subtitulo={dica}
        acoes={podeEditar ? <Botao onClick={novo}>{ABAS[aba].acao}</Botao> : undefined}
      />

      <div role="tablist" aria-label="Cadastros" className="-mx-4 flex gap-1 overflow-x-auto border-b border-[#dce1e8] px-4 md:mx-0 md:flex-wrap md:px-0">
        {abas.map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={a === aba}
            onClick={() => setParams({ aba: a }, { replace: true })}
            className={`-mb-px min-h-11 shrink-0 whitespace-nowrap border-0 border-b-[3px] bg-transparent px-4 text-[15px] ${FOCO} ${a === aba ? 'border-ce-azul font-bold text-ce-azul' : 'border-transparent font-medium text-ce-suave'}`}
          >
            {ABAS[a].rotulo}
          </button>
        ))}
      </div>

      {operacional && ehGestao && !unidadeId ? (
        <p className="m-0 text-[15px] text-ce-suave">Escolha a unidade em foco no menu para consultar {ABAS[aba].rotulo.toLowerCase()}.</p>
      ) : (
        <div role="tabpanel" aria-label={ABAS[aba].rotulo} className="flex flex-col gap-5">
          {operacional && ehGestao && <Pilula classe="bg-ce-linha-fraca text-ce-tinta-2" className="self-start">Somente consulta · o supervisor da unidade faz as alterações</Pilula>}
          {aba === 'pontos' && cad.pontos && (
            <p className="m-0 text-sm text-ce-suave">Ativos: {cad.ativosPorTipo.AGENCIA}/10 agências · {cad.ativosPorTipo.LOCKER}/10 lockers</p>
          )}
          <Tabela colunas={colunas[aba]} linhas={linhas} rotulo={ABAS[aba].rotulo} vazio="Nada cadastrado ainda." />
          {aba === 'distritos' && !ehGestao && cad.distritos && cad.carteiros && (
            <CarteiroDoDia distritos={cad.distritos} carteiros={cad.carteiros} quadro={quadro} aoMudar={recarregar} />
          )}
        </div>
      )}

      {edicao?.tipo === 'distrito' && <FormDistrito distrito={edicao.item} carteiros={cad.carteiros ?? []} aoFechar={fechar} aoSalvar={salvarERecarregar} />}
      {edicao?.tipo === 'carteiro' && <FormCarteiro carteiro={edicao.item} distritos={cad.distritos ?? []} aoFechar={fechar} aoSalvar={salvarERecarregar} />}
      {edicao?.tipo === 'senha' && <FormSenhaCarteiro carteiro={edicao.item} aoFechar={fechar} aoSalvar={salvarERecarregar} />}
      {edicao?.tipo === 'ponto' && <FormPonto ponto={edicao.item} aoFechar={fechar} aoSalvar={salvarERecarregar} />}
      {edicao?.tipo === 'canal' && (
        <FormCanal
          aoFechar={fechar}
          aoCriar={async (canal) => {
            setEdicao(null);
            setToken(canal);
            await recarregar();
          }}
        />
      )}
      {edicao?.tipo === 'unidade' && (
        <FormUnidade
          unidade={edicao.item}
          canais={cad.canais ?? []}
          aoFechar={fechar}
          aoSalvar={async (u) => {
            if (!unidadeGestaoId) escolherUnidade(u.id);
            await salvarERecarregar();
          }}
        />
      )}
      {edicao?.tipo === 'supervisor' && <FormSupervisor unidades={cad.unidades ?? []} aoFechar={fechar} aoSalvar={salvarERecarregar} />}

      <Dialogo
        titulo="Canal criado"
        aberto={!!token}
        aoFechar={() => setToken(null)}
        rodape={<Botao onClick={() => setToken(null)}>Já copiei o token</Botao>}
      >
        <p className="m-0 text-[15px] text-ce-tinta-2">
          Token de entrada do canal <strong>{token?.nome}</strong>. Configure-o nas integrações do Prosio.{' '}
          <strong>Ele é exibido só esta vez.</strong>
        </p>
        <label htmlFor="token-entrada" className="text-sm font-semibold">Token de entrada</label>
        <input id="token-entrada" readOnly value={token?.tokenEntrada ?? ''} onFocus={(e) => e.target.select()} className={`${CLASSE_ENTRADA} font-codigo text-[13px]`} />
      </Dialogo>
    </>
  );
}
