export interface CwsTokenResponse {
  token: string;
  expiraEm: string;
}

export interface RastreioResponse {
  objetos: Array<{
    codObjeto: string;
    tipoPostal: string;
    eventos: RastreioEvento[];
  }>;
}

export interface RastreioEvento {
  codigo: string;
  tipo: string;
  dtHrCriado: string;
  descricao: string;
  unidade: {
    tipo: string;
    nome: string;
    endereco: {
      cidade: string;
      uf: string;
    };
  };
}

export interface CepResponse {
  cep: string;
  logradouro: string;
  complemento?: string;
  bairro: string;
  localidade: string;
  uf: string;
  latitude?: string;
  longitude?: string;
}
