/** Auditoria da interface: diálogo (foco preso, rolagem travada, não dispensável), mensagens de erro e sinais. */
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/services/api';
import { Botao, Dialogo } from '../components/ui';
import { errosPorCampo, mensagemDeErro } from '../mensagens';
import { descreverSinal, sinaisDoPacote } from '../sinais';

function Exemplo({ dispensavel = true, aoFechar }: { dispensavel?: boolean; aoFechar?: () => void }) {
  const [aberto, setAberto] = useState(false);
  const fechar = () => {
    aoFechar?.();
    setAberto(false);
  };
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>Abrir</button>
      <button type="button">Por baixo</button>
      <Dialogo titulo="Exemplo" aberto={aberto} aoFechar={fechar} dispensavel={dispensavel} rodape={<Botao onClick={fechar}>Concluir</Botao>}>
        <label htmlFor="campo-a">Campo A</label>
        <input id="campo-a" />
        <label htmlFor="campo-b">Campo B</label>
        <input id="campo-b" />
      </Dialogo>
    </>
  );
}

describe('Dialogo', () => {
  it('prende o foco: Tab no último volta ao primeiro, Shift+Tab no primeiro vai ao último', async () => {
    const user = userEvent.setup();
    render(<Exemplo />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(screen.getByLabelText('Campo A')).toHaveFocus();
    // O primeiro focável na ordem do documento é o "Fechar" do cabeçalho; antes dele, a volta.
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Concluir' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Concluir' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Por baixo' })).not.toHaveFocus();
  });

  it('trava a rolagem da página enquanto está aberto e devolve o foco ao gatilho ao fechar com Esc', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'auto';
    render(<Exemplo />);
    const gatilho = screen.getByRole('button', { name: 'Abrir' });
    await user.click(gatilho);
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('auto');
    expect(gatilho).toHaveFocus();
    document.body.style.overflow = '';
  });

  it('não dispensável: sem "Fechar", o Esc não fecha; só o botão do rodapé', async () => {
    const user = userEvent.setup();
    const aoFechar = vi.fn();
    render(<Exemplo dispensavel={false} aoFechar={aoFechar} />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Exemplo' })).toBeInTheDocument();
    expect(aoFechar).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});

describe('mensagemDeErro', () => {
  it('prefere o texto que o servidor mandou (details.mensagem) ao texto genérico do código', () => {
    const err = new ApiError(400, 'unidade_obrigatoria', { mensagem: 'Escolha a unidade para abrir o atendimento' });
    expect(mensagemDeErro(err)).toBe('Escolha a unidade para abrir o atendimento');
    expect(mensagemDeErro(new ApiError(400, 'unidade_obrigatoria'))).toBe('Escolha a unidade.');
  });

  it('traduz os códigos que apareciam crus e nunca mostra um código sem tradução', () => {
    for (const codigo of ['data_passada', 'upload_invalido', 'matricula_invalida', 'distrito_invalido', 'unidade_invalida', 'telefone_obrigatorio']) {
      const texto = mensagemDeErro(new ApiError(400, codigo));
      expect(texto).not.toBe(codigo);
      expect(texto).not.toMatch(/_/);
    }
    expect(mensagemDeErro(new ApiError(400, 'codigo_que_ninguem_traduziu'), 'Não foi possível salvar.')).toBe('Não foi possível salvar.');
    expect(mensagemDeErro(new ApiError(500, 'HTTP 500'), 'Falhou.')).toBe('Falhou.');
    // Um `error` que já é uma frase (rotas antigas) continua aparecendo.
    expect(mensagemDeErro(new ApiError(409, 'Email já cadastrado'))).toBe('Email já cadastrado');
  });

  it('a área fala "rota": nenhum texto de erro diz "distrito"', () => {
    for (const codigo of ['sem_carteiro', 'carga_vazia', 'distrito_inativo', 'codigo_em_uso', 'distrito_liberado_hoje', 'distrito_invalido', 'distrito_em_operacao']) {
      expect(mensagemDeErro(new ApiError(409, codigo))).not.toMatch(/distrito/i);
    }
  });

  it('falta de rede vira um texto de conexão, não "Failed to fetch"', () => {
    expect(mensagemDeErro(new TypeError('Failed to fetch'))).toMatch(/Sem conexão/);
  });
});

describe('errosPorCampo', () => {
  it('leva os problemas do Zod ao campo, em português', () => {
    const err = new ApiError(400, 'Dados inválidos', [
      { code: 'too_small', minimum: 3, type: 'string', path: ['nome'], message: 'String must contain at least 3 character(s)' },
      { code: 'invalid_string', validation: 'email', path: ['email'], message: 'Invalid email' },
      { code: 'too_big', maximum: 8, type: 'string', path: ['endereco', 'cep'], message: 'String must contain at most 8 character(s)' },
      { code: 'invalid_type', expected: 'number', received: 'nan', path: ['latitude'], message: 'Expected number, received nan' },
    ]);
    expect(errosPorCampo(err)).toEqual({
      nome: 'Use ao menos 3 caracteres.',
      email: 'E-mail inválido.',
      cep: 'Use no máximo 8 caracteres.',
      latitude: 'Valor inválido.',
    });
  });

  it('erro de regra com details.campo vai para o campo, com a mensagem do servidor', () => {
    const err = new ApiError(409, 'matricula_em_uso', { campo: 'matricula', mensagem: 'Matrícula já cadastrada' });
    expect(errosPorCampo(err)).toEqual({ matricula: 'Matrícula já cadastrada' });
    expect(errosPorCampo(new ApiError(409, 'limite_pontos'))).toEqual({});
    expect(errosPorCampo(new Error('x'))).toEqual({});
  });
});

describe('sinais', () => {
  it('cada sinal do backend tem rótulo legível', () => {
    const codigos = ['divergencia', 'nao_entregue_carteiro', 'falha_envio_carteiro', 'nao_foi_possivel', 'retido_consentimento', 'descadastrado'];
    for (const c of codigos) {
      const s = descreverSinal(c);
      expect(s.rotulo).not.toMatch(/_/);
      expect(s.detalhe.length).toBeGreaterThan(10);
    }
    expect(descreverSinal('caso_recusado:opt_out')).toMatchObject({ rotulo: 'Mediação recusada', tom: 'erro' });
    expect(descreverSinal('caso_recusado:opt_out').detalhe).toContain('pediu para não receber');
    expect(descreverSinal('caso_recusado:motivo_novo').detalhe).toContain('motivo novo');
    expect(descreverSinal('sinal_futuro').rotulo).toBe('Sinal futuro');
  });

  it('junta os sinais do pacote e da orientação sem repetir, e não redobra o "descadastrado"', () => {
    const base = { naoEnviadoMotivo: null, descadastrado: false, orientacaoVigente: null };
    expect(sinaisDoPacote({ ...base, sinais: null })).toEqual([]);
    expect(sinaisDoPacote({ ...base, sinais: 'x' })).toEqual([]);
    const sinais = sinaisDoPacote({
      ...base,
      sinais: ['divergencia', 'falha_envio_carteiro'],
      orientacaoVigente: { id: 'o1', tipo: 'MANUAL', texto: 't', estado: 'ENVIADA', origem: 'SUPERVISOR', valeAPartirDe: null, pontoDesativado: false, sinais: ['falha_envio_carteiro', 'nao_entregue_carteiro'] },
    });
    expect(sinais.map((s) => s.codigo)).toEqual(['divergencia', 'falha_envio_carteiro', 'nao_entregue_carteiro']);
    expect(sinaisDoPacote({ ...base, sinais: ['descadastrado'], naoEnviadoMotivo: 'descadastrado' })).toEqual([]);
    expect(sinaisDoPacote({ ...base, sinais: ['descadastrado'] }).map((s) => s.rotulo)).toEqual(['Descadastrado']);
  });
});
