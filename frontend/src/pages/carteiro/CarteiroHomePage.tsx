export function CarteiroHomePage() {
  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <h2 className="text-xl font-bold text-gray-900">Bom dia!</h2>
        <p className="text-gray-500 mt-1">CDD Brasília Centro</p>
      </div>

      <button className="w-full bg-correios-blue text-white py-4 rounded-xl font-semibold text-lg hover:bg-correios-blue-mid transition-colors">
        Iniciar Rota do Dia
      </button>

      <button className="w-full bg-white border border-gray-200 text-gray-700 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
        Histórico de Rotas
      </button>
    </div>
  );
}
