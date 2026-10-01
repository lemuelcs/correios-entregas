/**
 * Formulários do cadastro da unidade (rotas, carteiros, senha do app, agências e lockers)
 * e o carteiro do dia. Cada edição manda a versão lida (`atualizadoEm`); se outra pessoa
 * gravou antes, o formulário recarrega com a versão atual (ver `DialogoFormulario`).
 *
 * (Nos identificadores, rotas e campos da API a rota ainda se chama "distrito".)
 */
import { useState, type InputHTMLAttributes } from 'react';
import toast from 'react-hot-toast';
import { entregasApi } from '../entregas.api';
import type { CarteiroCadastro, CartaoDistrito, Distrito, PontoRetirada, Quadro, TipoPonto } from '../entregas.types';
import { AVISOS_CADASTRO, avisarErro, formatarDataCurta, formatarWhatsapp } from '../mensagens';
import { CampoF, DialogoFormulario, avisarAtencao } from './DialogoFormulario';
import { CLASSE_ENTRADA, Cartao } from './ui';

export const entrada = (props: InputHTMLAttributes<HTMLInputElement>) => (id: string) => <input id={id} className={CLASSE_ENTRADA} {...props} />;

export function Marcador({ marcado, aoMudar, children }: { marcado: boolean; aoMudar: (v: boolean) => void; children: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
      <input type="checkbox" checked={marcado} onChange={(e) => aoMudar(e.target.checked)} className="size-5" /> {children}
    </label>
  );
}

const whatsappParaCampo = (e164: string | null | undefined) => (e164 ? formatarWhatsapp(e164) : '');

// ——— Rotas ———————————————————————————————————————————————————————————

export function FormDistrito({ distrito, carteiros, aoFechar, aoSalvar }: { distrito: Distrito | null; carteiros: CarteiroCadastro[]; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const [base, setBase] = useState(distrito);
  const [codigo, setCodigo] = useState(distrito?.codigo ?? '');
  const [nome, setNome] = useState(distrito?.nome ?? '');
  const [carteiroPadraoId, setCarteiro] = useState(distrito?.carteiroPadrao?.id ?? '');
  const [ativo, setAtivo] = useState(distrito?.ativo ?? true);

  function recarregar(atual: Distrito) {
    setBase(atual);
    setCodigo(atual.codigo);
    setNome(atual.nome);
    setCarteiro(atual.carteiroPadrao?.id ?? '');
    setAtivo(atual.ativo);
  }

  return (
    <DialogoFormulario<Distrito>
      titulo={base ? `Editar ${base.codigo}` : 'Nova rota'}
      aberto
      aoFechar={aoFechar}
      aoConflito={recarregar}
      aoEnviar={async () => {
        const dados = { codigo: codigo.trim(), nome: nome.trim(), carteiroPadraoId: carteiroPadraoId || null };
        if (base) await entregasApi.editarDistrito(base.id, { ...dados, ativo, atualizadoEm: base.atualizadoEm });
        else await entregasApi.criarDistrito(dados);
        toast.success(base ? 'Rota atualizada.' : `Rota ${dados.codigo.toUpperCase()} cadastrada.`);
        await aoSalvar();
      }}
    >
      <CampoF nome="codigo" rotulo="Código">{entrada({ value: codigo, onChange: (e) => setCodigo(e.target.value), required: true, maxLength: 20, placeholder: 'D-09' })}</CampoF>
      <CampoF nome="nome" rotulo="Nome">{entrada({ value: nome, onChange: (e) => setNome(e.target.value), required: true, maxLength: 80, placeholder: 'Taguatinga Oeste' })}</CampoF>
      <CampoF nome="carteiroPadraoId" rotulo="Carteiro padrão">
        {(id) => (
          <select id={id} value={carteiroPadraoId} onChange={(e) => setCarteiro(e.target.value)} className={CLASSE_ENTRADA}>
            <option value="">Sem carteiro padrão</option>
            {carteiros.filter((c) => c.ativo || c.id === carteiroPadraoId).map((c) => <option key={c.id} value={c.id}>{c.nome ?? c.matricula}</option>)}
          </select>
        )}
      </CampoF>
      {base && <Marcador marcado={ativo} aoMudar={setAtivo}>Rota ativa</Marcador>}
    </DialogoFormulario>
  );
}

export function CarteiroDoDia({ distritos, carteiros, quadro, aoMudar }: { distritos: Distrito[]; carteiros: CarteiroCadastro[]; quadro: Quadro | null; aoMudar: () => Promise<void> }) {
  const [salvando, setSalvando] = useState<string | null>(null);
  if (!quadro) return null;
  const cartoes = new Map<string, CartaoDistrito>(quadro.distritos.map((c) => [c.distritoId, c]));
  const ativos = distritos.filter((d) => d.ativo);
  if (ativos.length === 0) return null;

  async function trocar(d: Distrito, carteiroId: string) {
    setSalvando(d.id);
    try {
      const r = await entregasApi.definirEscalaComAvisos(d.id, quadro!.data, carteiroId || null);
      toast.success(`Carteiro de hoje da rota ${d.codigo} atualizado.`);
      for (const aviso of r?.avisos ?? []) avisarAtencao(AVISOS_CADASTRO[aviso] ?? 'Atenção: confira a escala de hoje.');
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
      <p className="m-0 text-sm text-ce-suave">A troca vale só para hoje. Amanhã volta o carteiro padrão da rota.</p>
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
              {semCarteiro && <span className="text-[13px] text-[#8a5a00]">Sem carteiro: a rota não pode ser liberada</span>}
              {liberado && <span className="text-[13px] text-ce-suave">Já liberada: o novo carteiro recebe o resumo das orientações.</span>}
            </div>
          );
        })}
      </div>
    </Cartao>
  );
}

// ——— Carteiros ———————————————————————————————————————————————————————

export function FormCarteiro({ carteiro, distritos, aoFechar, aoSalvar }: { carteiro: CarteiroCadastro | null; distritos: Distrito[]; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const [base, setBase] = useState(carteiro);
  const [nome, setNome] = useState(carteiro?.nome ?? '');
  const [matricula, setMatricula] = useState(carteiro?.matricula ?? '');
  const [whatsapp, setWhatsapp] = useState(whatsappParaCampo(carteiro?.whatsapp));
  const [distritoPadraoId, setDistrito] = useState(carteiro?.distritosPadrao[0]?.id ?? '');
  const [ativo, setAtivo] = useState(carteiro?.ativo ?? true);

  function recarregar(atual: CarteiroCadastro) {
    setBase(atual);
    setNome(atual.nome ?? '');
    setMatricula(atual.matricula);
    setWhatsapp(whatsappParaCampo(atual.whatsapp));
    setDistrito(atual.distritosPadrao?.[0]?.id ?? '');
    setAtivo(atual.ativo);
  }

  return (
    <DialogoFormulario<CarteiroCadastro>
      titulo={base ? `Editar ${base.nome ?? base.matricula}` : 'Novo carteiro'}
      aberto
      aoFechar={aoFechar}
      aoConflito={recarregar}
      aoEnviar={async () => {
        const dados = { nome: nome.trim(), matricula: matricula.trim(), whatsapp: whatsapp.trim(), distritoPadraoId: distritoPadraoId || null };
        if (base) await entregasApi.editarCarteiro(base.id, { ...dados, ativo, atualizadoEm: base.atualizadoEm });
        else await entregasApi.criarCarteiro(dados);
        toast.success(base ? 'Carteiro atualizado.' : 'Carteiro cadastrado.');
        await aoSalvar();
      }}
    >
      <CampoF nome="nome" rotulo="Nome">{entrada({ value: nome, onChange: (e) => setNome(e.target.value), required: true, minLength: 2, maxLength: 120 })}</CampoF>
      <CampoF nome="matricula" rotulo="Matrícula" dica="8 dígitos, com ou sem pontos">{entrada({ value: matricula, onChange: (e) => setMatricula(e.target.value), required: true, maxLength: 20 })}</CampoF>
      <CampoF nome="whatsapp" rotulo="WhatsApp" dica="Com DDD, ex.: (61) 99155-3301">{entrada({ value: whatsapp, onChange: (e) => setWhatsapp(e.target.value), required: true, inputMode: 'tel' })}</CampoF>
      <CampoF nome="distritoPadraoId" rotulo="Rota padrão">
        {(id) => (
          <select id={id} value={distritoPadraoId} onChange={(e) => setDistrito(e.target.value)} className={CLASSE_ENTRADA}>
            <option value="">— (volante)</option>
            {distritos.filter((d) => d.ativo || d.id === distritoPadraoId).map((d) => <option key={d.id} value={d.id}>{d.codigo} · {d.nome}</option>)}
          </select>
        )}
      </CampoF>
      {base && <Marcador marcado={ativo} aoMudar={setAtivo}>Carteiro ativo</Marcador>}
    </DialogoFormulario>
  );
}

/** Senha temporária do app de captura (ADR-004): o carteiro troca no primeiro acesso. */
export function FormSenhaCarteiro({ carteiro, aoFechar, aoSalvar }: { carteiro: CarteiroCadastro; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
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
      <CampoF nome="senha" rotulo="Senha temporária" dica="De 8 a 72 caracteres.">
        {entrada({ value: senha, onChange: (e) => setSenha(e.target.value), required: true, minLength: 8, maxLength: 72, autoComplete: 'off', spellCheck: false })}
      </CampoF>
    </DialogoFormulario>
  );
}

// ——— Pontos de retirada ——————————————————————————————————————————————

export function FormPonto({ ponto, aoFechar, aoSalvar }: { ponto: PontoRetirada | null; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const [base, setBase] = useState(ponto);
  const [tipo, setTipo] = useState<TipoPonto>(ponto?.tipo ?? 'AGENCIA');
  const [nome, setNome] = useState(ponto?.nome ?? '');
  const [endereco, setEndereco] = useState(ponto?.endereco ?? '');
  const [horario, setHorario] = useState(ponto?.horario ?? '');
  const [ativo, setAtivo] = useState(ponto?.ativo ?? true);

  function recarregar(atual: PontoRetirada) {
    setBase(atual);
    setTipo(atual.tipo);
    setNome(atual.nome);
    setEndereco(atual.endereco);
    setHorario(atual.horario);
    setAtivo(atual.ativo);
  }

  return (
    <DialogoFormulario<PontoRetirada>
      titulo={base ? `Editar ${base.nome}` : 'Novo ponto de retirada'}
      aberto
      aoFechar={aoFechar}
      aoConflito={recarregar}
      aoEnviar={async () => {
        const dados = { tipo, nome: nome.trim(), endereco: endereco.trim(), horario: horario.trim() };
        if (base) await entregasApi.editarPonto(base.id, { ...dados, ativo, atualizadoEm: base.atualizadoEm });
        else await entregasApi.criarPonto(dados);
        toast.success(base ? 'Ponto atualizado.' : 'Ponto de retirada cadastrado.');
        await aoSalvar();
      }}
    >
      <CampoF nome="tipo" rotulo="Tipo">
        {(id) => (
          <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value as TipoPonto)} className={CLASSE_ENTRADA}>
            <option value="AGENCIA">Agência</option>
            <option value="LOCKER">Locker</option>
          </select>
        )}
      </CampoF>
      <CampoF nome="nome" rotulo="Nome (até 24 caracteres)" dica={`${nome.length}/24 · aparece na lista do WhatsApp`}>
        {entrada({ value: nome, onChange: (e) => setNome(e.target.value), required: true, maxLength: 24 })}
      </CampoF>
      <CampoF nome="endereco" rotulo="Endereço">{entrada({ value: endereco, onChange: (e) => setEndereco(e.target.value), required: true, minLength: 3, maxLength: 200 })}</CampoF>
      <CampoF nome="horario" rotulo="Horário">{entrada({ value: horario, onChange: (e) => setHorario(e.target.value), required: true, minLength: 2, maxLength: 120, placeholder: 'Seg–sex 9h–17h' })}</CampoF>
      {base && <Marcador marcado={ativo} aoMudar={setAtivo}>Ponto ativo</Marcador>}
    </DialogoFormulario>
  );
}
