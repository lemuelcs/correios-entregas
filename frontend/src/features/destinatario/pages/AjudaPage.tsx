import { helpTopics } from '../destinatario.data';

export function AjudaPage() {
  return (
    <div className="space-y-3 px-4 pt-4 pb-4">
      {helpTopics.map((topic) => (
        <div key={topic.title} className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold text-slate-900">{topic.title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{topic.detail}</p>
        </div>
      ))}
    </div>
  );
}
