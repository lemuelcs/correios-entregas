import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Languages, Loader2, RefreshCcw, RotateCcw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Panel } from '@/shared/ui/Panel';
import { AlertBanner } from '@/shared/ui/AlertBanner';
import {
  DEFAULT_TERMINOLOGY,
  TERMINOLOGY_TERM_KEYS,
  TERMINOLOGY_TERM_LABELS,
  useTerminologiaStore,
} from '@/stores/terminologia.store';
import {
  SUPPORTED_TERM_LOCALES,
  type Locale,
  type TermDef,
  type TerminologyV2,
} from '@/features/gestao/api/terminologia.api';

type TermsFormState = Record<string, Record<Locale, TermDef>>;

const LOCALE_LABELS: Record<Locale, string> = {
  'pt-BR': 'Portugues (pt-BR)',
  'en-US': 'English (en-US)',
  'es-ES': 'Espanol (es-ES)',
};

function buildFormStateFromTerminology(terminology: TerminologyV2): TermsFormState {
  const result: TermsFormState = {};

  for (const key of TERMINOLOGY_TERM_KEYS) {
    const tenantTerms = terminology.terms?.[key] ?? {};
    const defaultTerms = DEFAULT_TERMINOLOGY.terms[key] ?? {};
    const perLocale = {} as Record<Locale, TermDef>;

    for (const locale of SUPPORTED_TERM_LOCALES) {
      const tenantValue = tenantTerms[locale];
      const defaultValue = defaultTerms[locale];
      perLocale[locale] = {
        singular: tenantValue?.singular ?? defaultValue?.singular ?? '',
        plural: tenantValue?.plural ?? defaultValue?.plural ?? '',
      };
    }
    result[key] = perLocale;
  }

  return result;
}

function buildPayload(state: TermsFormState): TerminologyV2 {
  const terms: TerminologyV2['terms'] = {};
  for (const key of TERMINOLOGY_TERM_KEYS) {
    terms[key] = { ...state[key] };
  }
  return {
    schemaVersion: 'v2',
    terms,
  };
}

export function GestaoTerminologiaPage() {
  const terminology = useTerminologiaStore((s) => s.terminology);
  const loading = useTerminologiaStore((s) => s.loading);
  const saving = useTerminologiaStore((s) => s.saving);
  const error = useTerminologiaStore((s) => s.error);
  const load = useTerminologiaStore((s) => s.load);
  const save = useTerminologiaStore((s) => s.save);
  const resetToDefault = useTerminologiaStore((s) => s.reset);

  const initialState = useMemo<TermsFormState>(
    () => buildFormStateFromTerminology(terminology ?? DEFAULT_TERMINOLOGY),
    [terminology],
  );

  const [formState, setFormState] = useState<TermsFormState>(initialState);

  useEffect(() => {
    if (!terminology && !loading) {
      load();
    }
  }, [terminology, loading, load]);

  useEffect(() => {
    setFormState(initialState);
  }, [initialState]);

  const handleFieldChange = (
    termKey: string,
    locale: Locale,
    field: keyof TermDef,
    value: string,
  ) => {
    setFormState((prev) => ({
      ...prev,
      [termKey]: {
        ...prev[termKey],
        [locale]: {
          ...prev[termKey][locale],
          [field]: value,
        },
      },
    }));
  };

  const handleRestoreDefaults = () => {
    resetToDefault();
    setFormState(buildFormStateFromTerminology(DEFAULT_TERMINOLOGY));
    toast.success('Terminologia restaurada para os valores padrao. Clique em Salvar para persistir.');
  };

  const handleRefresh = async () => {
    await load();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await save(buildPayload(formState));
      toast.success('Terminologia salva com sucesso!');
    } catch {
      toast.error('Erro ao salvar terminologia');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-correios-blue focus:border-transparent disabled:opacity-60';

  if (loading && !terminology) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-correios-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Languages className="mt-1 h-8 w-8 text-correios-blue" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Configuracao de Terminologia</h1>
            <p className="text-sm text-slate-500">
              Personalize os nomes usados pelo sistema (ex.: Carteiro vs Motorista) em multiplos idiomas.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={saving || loading}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCcw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {error && (
        <AlertBanner title="Erro" variant="danger">
          {error}
        </AlertBanner>
      )}

      <Panel
        title="Termos do sistema"
        description="Cada termo possui forma singular e plural em cada idioma suportado."
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3 align-bottom">Termo</th>
                  {SUPPORTED_TERM_LOCALES.map((locale) => (
                    <th key={locale} className="px-3 py-3 align-bottom">
                      {LOCALE_LABELS[locale]}
                    </th>
                  ))}
                  <th className="px-3 py-3 align-bottom">Pre-visualizacao (pt-BR)</th>
                </tr>
              </thead>
              <tbody>
                {TERMINOLOGY_TERM_KEYS.map((termKey) => {
                  const previewValues = formState[termKey]?.['pt-BR'];
                  const previewPlural = previewValues?.plural || termKey;
                  return (
                    <tr key={termKey} className="border-b border-slate-100">
                      <td className="px-3 py-4 align-top font-medium text-slate-800">
                        <div>{TERMINOLOGY_TERM_LABELS[termKey] ?? termKey}</div>
                        <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-slate-400">
                          {termKey}
                        </div>
                      </td>
                      {SUPPORTED_TERM_LOCALES.map((locale) => {
                        const fieldId = `${termKey}-${locale}`;
                        const values = formState[termKey]?.[locale] ?? { singular: '', plural: '' };
                        return (
                          <td key={locale} className="px-3 py-4 align-top">
                            <div className="flex min-w-[180px] flex-col gap-2">
                              <label
                                htmlFor={`${fieldId}-singular`}
                                className="text-[11px] font-medium uppercase tracking-wider text-slate-500"
                              >
                                Singular
                              </label>
                              <input
                                id={`${fieldId}-singular`}
                                type="text"
                                value={values.singular}
                                onChange={(event) =>
                                  handleFieldChange(termKey, locale, 'singular', event.target.value)
                                }
                                disabled={saving}
                                className={inputClass}
                              />
                              <label
                                htmlFor={`${fieldId}-plural`}
                                className="text-[11px] font-medium uppercase tracking-wider text-slate-500"
                              >
                                Plural
                              </label>
                              <input
                                id={`${fieldId}-plural`}
                                type="text"
                                value={values.plural}
                                onChange={(event) =>
                                  handleFieldChange(termKey, locale, 'plural', event.target.value)
                                }
                                disabled={saving}
                                className={inputClass}
                              />
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-4 align-top text-sm text-slate-600">
                        Lista de {previewPlural}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar padrao
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-correios-blue px-6 py-2 text-sm font-semibold text-white hover:bg-correios-blue-mid disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

export default GestaoTerminologiaPage;
