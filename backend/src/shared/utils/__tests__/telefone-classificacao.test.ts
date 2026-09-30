import { classificarTelefone, mesmoNumero } from '../telefone-classificacao';
import { TelefoneInvalido } from '../telefone';

describe('classificarTelefone / mesmoNumero', () => {
  it('UT-013 celular com máscara é WhatsApp', () => {
    expect(classificarTelefone('(61) 99340-1287')).toEqual({ whatsappE164: '+5561993401287', outro: null });
  });

  it('UT-014 fixo não é WhatsApp e vai para outro', () => {
    expect(classificarTelefone('(61) 3340-1287')).toEqual({ whatsappE164: null, outro: '+556133401287' });
  });

  it('UT-015 celular de DDD de outro estado é WhatsApp', () => {
    expect(classificarTelefone('11 98765-4321').whatsappE164).toBe('+5511987654321');
  });

  it('UT-016 celular sem o nono dígito ganha o 9 e é WhatsApp', () => {
    expect(classificarTelefone('61 9340-1287').whatsappE164).toBe('+5561993401287');
  });

  it('UT-017 mesmo número com formatações diferentes é igual', () => {
    expect(mesmoNumero('+5561993401287', '(61) 99340-1287')).toBe(true);
    expect(mesmoNumero('+5561993401287', '(61) 99111-2222')).toBe(false);
    expect(mesmoNumero(null, '')).toBe(true);
    expect(mesmoNumero(null, '+5561993401287')).toBe(false);
  });

  it('vazio dá os dois nulos; malformado lança TelefoneInvalido', () => {
    expect(classificarTelefone('  ')).toEqual({ whatsappE164: null, outro: null });
    expect(classificarTelefone(null)).toEqual({ whatsappE164: null, outro: null });
    expect(() => classificarTelefone('61 9abc-4412')).toThrow(TelefoneInvalido);
  });
});
