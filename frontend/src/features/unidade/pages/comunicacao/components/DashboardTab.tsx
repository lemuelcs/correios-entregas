import {
  Send, Users, DollarSign, Cpu, MessageSquare, CheckCheck, AlertCircle, User, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { AdminStats } from '@/types/comunicacao.types';
import { type PeriodoFiltro, formatMonthYear } from '../hooks/useDashboardStats';

interface DashboardTabProps {
  stats: AdminStats | null;
  loadingStats: boolean;
  periodo: PeriodoFiltro;
  setPeriodo: (p: PeriodoFiltro) => void;
  dataInicio: string;
  dataFim: string;
  weekDates: Date[];
  dataSelecionada: string;
  setDataSelecionada: (d: string) => void;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToToday: () => void;
  currentMonthForWeeks: Date;
  weeksOfMonth: Array<{ start: Date; end: Date; weekNumber: number }>;
  selectedWeekIndex: number;
  setSelectedWeekIndex: (i: number) => void;
  goToPreviousMonthForWeeks: () => void;
  goToNextMonthForWeeks: () => void;
  quinzenas: Array<{ start: Date; end: Date; label: string }>;
  quinzenasOffset: number;
  selectedQuinzenaIndex: number;
  setSelectedQuinzenaIndex: (i: number) => void;
  goToPreviousQuinzenas: () => void;
  goToNextQuinzenas: () => void;
  visibleMonths: Date[];
  monthsOffset: number;
  selectedMonthIndex: number;
  setSelectedMonthIndex: (i: number) => void;
  goToPreviousMonths: () => void;
  goToNextMonths: () => void;
  formatWeekDay: (d: Date) => string;
  formatDayMonth: (d: Date) => string;
  toLocalDateInput: (d: Date) => string;
}

export default function DashboardTab({
  stats, loadingStats, periodo, setPeriodo, dataInicio, dataFim,
  weekDates, dataSelecionada, setDataSelecionada, goToPreviousWeek, goToNextWeek, goToToday,
  currentMonthForWeeks, weeksOfMonth, selectedWeekIndex, setSelectedWeekIndex, goToPreviousMonthForWeeks, goToNextMonthForWeeks,
  quinzenas, quinzenasOffset, selectedQuinzenaIndex, setSelectedQuinzenaIndex, goToPreviousQuinzenas, goToNextQuinzenas,
  visibleMonths, monthsOffset, selectedMonthIndex, setSelectedMonthIndex, goToPreviousMonths, goToNextMonths,
  formatWeekDay, formatDayMonth, toLocalDateInput,
}: DashboardTabProps) {
  return (
    <div>
      {/* Period Selector */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-200 px-3 sm:px-4 py-3 mb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {(['dia', 'semana', 'quinzena', 'mes'] as PeriodoFiltro[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition whitespace-nowrap ${
                    periodo === p
                      ? 'bg-[#003399] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-600 whitespace-nowrap shrink-0">
                {dataInicio === dataFim
                  ? dataInicio
                  : `${dataInicio.split('-').slice(1).join('/')} - ${dataFim.split('-').slice(1).join('/')}`}
              </span>
            </div>
          </div>

          {/* Day carousel */}
          {periodo === 'dia' && (
            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={goToPreviousWeek} className="p-2 hover:bg-gray-100 rounded-lg transition shrink-0" title="Semana anterior">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex-1 overflow-x-auto">
                <div className="flex items-center gap-1.5 sm:gap-2 w-max mx-auto">
                  {weekDates.map((date, index) => {
                    const dateStr = toLocalDateInput(date);
                    const isToday = toLocalDateInput(new Date()) === dateStr;
                    const isSelected = dataSelecionada === dateStr;
                    return (
                      <button
                        key={index}
                        onClick={() => setDataSelecionada(dateStr)}
                        className={`flex flex-col items-center px-2.5 sm:px-3 py-2 rounded-xl transition min-w-14 sm:min-w-[4.25rem] ${
                          isSelected
                            ? 'bg-[#003399] text-white shadow-md'
                            : isToday
                            ? 'bg-blue-100 text-blue-900 ring-2 ring-blue-400'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className="text-[10px] sm:text-xs font-medium uppercase">{formatWeekDay(date)}</span>
                        <span className="text-xs sm:text-sm font-bold">{formatDayMonth(date)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={goToNextWeek} className="p-2 hover:bg-gray-100 rounded-lg transition shrink-0" title="Proxima semana">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
              <button onClick={goToToday} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition shrink-0" title="Ir para hoje">
                Hoje
              </button>
            </div>
          )}

          {/* Week carousel */}
          {periodo === 'semana' && (
            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={goToPreviousMonthForWeeks} className="p-2 hover:bg-gray-100 rounded-lg transition shrink-0">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex-1 overflow-x-auto">
                <div className="flex items-center gap-1.5 sm:gap-2 w-max mx-auto">
                  <span className="text-xs sm:text-sm font-medium text-gray-500 mr-1 sm:mr-2 capitalize whitespace-nowrap">
                    {new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(currentMonthForWeeks)}
                  </span>
                  {weeksOfMonth.map((week, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedWeekIndex(index)}
                      className={`flex flex-col items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl transition min-w-[4.375rem] sm:min-w-[5.3125rem] ${
                        selectedWeekIndex === index ? 'bg-[#003399] text-white shadow-md' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-[10px] sm:text-xs font-medium">S{week.weekNumber}</span>
                      <span className="text-[10px] sm:text-xs">{formatDayMonth(week.start)}-{formatDayMonth(week.end)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={goToNextMonthForWeeks} className="p-2 hover:bg-gray-100 rounded-lg transition shrink-0">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          )}

          {/* Quinzena carousel */}
          {periodo === 'quinzena' && (
            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={goToPreviousQuinzenas} className="p-2 hover:bg-gray-100 rounded-lg transition shrink-0">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex-1 overflow-x-auto">
                <div className="flex items-center gap-1.5 sm:gap-2 w-max mx-auto">
                  {quinzenas.map((quinzena, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedQuinzenaIndex(index)}
                      className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl transition text-[10px] sm:text-xs font-medium whitespace-nowrap ${
                        selectedQuinzenaIndex === index ? 'bg-[#003399] text-white shadow-md' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {quinzena.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={goToNextQuinzenas} disabled={quinzenasOffset === 0} className={`p-2 rounded-lg transition shrink-0 ${quinzenasOffset === 0 ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600'}`}>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Month carousel */}
          {periodo === 'mes' && (
            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={goToPreviousMonths} className="p-2 hover:bg-gray-100 rounded-lg transition shrink-0">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex-1 overflow-x-auto">
                <div className="flex items-center gap-1.5 sm:gap-2 w-max mx-auto">
                  {visibleMonths.map((monthDate, index) => {
                    const isCurrentMonth = monthDate.getMonth() === new Date().getMonth() && monthDate.getFullYear() === new Date().getFullYear();
                    return (
                      <button
                        key={index}
                        onClick={() => setSelectedMonthIndex(index)}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition text-xs sm:text-sm font-medium capitalize whitespace-nowrap ${
                          selectedMonthIndex === index
                            ? 'bg-[#003399] text-white shadow-md'
                            : isCurrentMonth
                            ? 'bg-blue-100 text-blue-900 ring-2 ring-blue-400'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {formatMonthYear(monthDate)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={goToNextMonths} disabled={monthsOffset === 0} className={`p-2 rounded-lg transition shrink-0 ${monthsOffset === 0 ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600'}`}>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {loadingStats ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#003399]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-4 flex items-start gap-3">
              <div className="p-2.5 bg-blue-50 rounded-xl shrink-0"><Send className="w-5 h-5 text-blue-500" /></div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-500">Mensagens Enviadas</span>
                <p className="text-2xl font-bold text-gray-900">{stats?.mensagensEnviadas ?? 0}</p>
                <span className="text-xs text-gray-400">{stats?.lidas ?? 0} lidas</span>
              </div>
            </div>
            <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-4 flex items-start gap-3">
              <div className="p-2.5 bg-green-50 rounded-xl shrink-0"><Users className="w-5 h-5 text-green-500" /></div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-500">Conversas</span>
                <p className="text-2xl font-bold text-gray-900">{stats?.sessoesAtivas ?? 0}</p>
                <span className="text-xs text-gray-400">{stats?.sessoesDispatcher ?? 0} resolvidas</span>
              </div>
            </div>
            <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-4 flex items-start gap-3">
              <div className="p-2.5 bg-amber-50 rounded-xl shrink-0"><DollarSign className="w-5 h-5 text-amber-500" /></div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-500">Custo LLM</span>
                <p className="text-2xl font-bold text-gray-900">${(stats?.llmCostUsd ?? 0).toFixed(2)}</p>
                <span className="text-xs text-gray-400">{stats?.llmRequests ?? 0} requests</span>
              </div>
            </div>
            <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-4 flex items-start gap-3">
              <div className="p-2.5 bg-purple-50 rounded-xl shrink-0"><Cpu className="w-5 h-5 text-purple-500" /></div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-500">Taxa Bot</span>
                <p className="text-2xl font-bold text-gray-900">{stats?.taxaBot ?? 0}%</p>
                <span className="text-xs text-gray-400">{stats?.sessoesBot ?? 0} pelo bot</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2"><div className="p-2 bg-gray-100 rounded-lg"><MessageSquare className="w-4 h-4 text-gray-600" /></div><span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recebidas</span></div>
              <p className="text-2xl font-bold text-gray-900">{stats?.mensagensRecebidas ?? 0}</p>
            </div>
            <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2"><div className="p-2 bg-green-100 rounded-lg"><CheckCheck className="w-4 h-4 text-green-600" /></div><span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Entregues</span></div>
              <p className="text-2xl font-bold text-gray-900">{stats?.entregues ?? 0}</p>
            </div>
            <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2"><div className="p-2 bg-red-100 rounded-lg"><AlertCircle className="w-4 h-4 text-red-600" /></div><span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Falhas</span></div>
              <p className="text-2xl font-bold text-gray-900">{stats?.falhas ?? 0}</p>
            </div>
            <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2"><div className="p-2 bg-orange-100 rounded-lg"><User className="w-4 h-4 text-orange-600" /></div><span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Atend. Humano</span></div>
              <p className="text-2xl font-bold text-gray-900">{stats?.sessoesDispatcher ?? 0}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
