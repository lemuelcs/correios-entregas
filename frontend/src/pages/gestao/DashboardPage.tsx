export function DashboardPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Na Unidade</p>
          <p className="text-3xl font-bold text-correios-blue mt-1">--</p>
          <p className="text-xs text-gray-400 mt-1">objetos</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Chegando</p>
          <p className="text-3xl font-bold text-correios-blue mt-1">--</p>
          <p className="text-xs text-gray-400 mt-1">estimados</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Rotas Ativas</p>
          <p className="text-3xl font-bold text-correios-blue mt-1">--</p>
          <p className="text-xs text-gray-400 mt-1">em andamento</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Alertas</p>
          <p className="text-3xl font-bold text-red-500 mt-1">--</p>
          <p className="text-xs text-gray-400 mt-1">pendentes</p>
        </div>
      </div>
    </div>
  );
}
