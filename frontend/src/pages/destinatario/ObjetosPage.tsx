export function ObjetosPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Meus Objetos</h2>
      <p className="text-gray-500">Nenhum objeto vinculado ainda.</p>
      <button className="w-full bg-correios-blue text-white py-3 rounded-xl font-semibold hover:bg-correios-blue-mid transition-colors">
        Vincular Objeto
      </button>
    </div>
  );
}
