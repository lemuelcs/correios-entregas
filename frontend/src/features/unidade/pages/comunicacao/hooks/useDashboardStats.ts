/**
 * useDashboardStats.ts
 * Manages dashboard stats fetching and period selection state.
 */
import { useState, useEffect, useMemo } from 'react';
import { api } from '@/services/api';
import type { AdminStats } from '@/types/comunicacao.types';
import { formatWeekDay, formatDayMonth, toLocalDateInput, getStartOfWeek, getWeekDates } from '@/utils/date-helpers';

export type PeriodoFiltro = 'dia' | 'semana' | 'quinzena' | 'mes';

// ── Period helpers ─────────────────────────────────────────────────

const getISOWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const getWeeksOfMonth = (year: number, month: number): Array<{ start: Date; end: Date; weekNumber: number }> => {
  const weeks = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let current = getStartOfWeek(firstDay);
  while (current <= lastDay || weeks.length === 0) {
    const weekEnd = new Date(current);
    weekEnd.setDate(current.getDate() + 6);
    weeks.push({ start: new Date(current), end: weekEnd, weekNumber: getISOWeekNumber(current) });
    current = new Date(current);
    current.setDate(current.getDate() + 7);
    if (current > lastDay && weeks.length >= 1) break;
  }
  return weeks;
};

export const getQuinzenas = (offset: number = 0): Array<{ start: Date; end: Date; label: string }> => {
  const quinzenas = [];
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const isFirstHalf = diaAtual <= 15;
  const baseDate = new Date(hoje.getFullYear(), hoje.getMonth(), isFirstHalf ? 1 : 16);
  for (let i = 0; i < offset * 5; i++) {
    if (baseDate.getDate() === 1) { baseDate.setMonth(baseDate.getMonth() - 1); baseDate.setDate(16); }
    else { baseDate.setDate(1); }
  }
  for (let i = 0; i < 5; i++) {
    const start = new Date(baseDate);
    const end = new Date(baseDate);
    if (start.getDate() === 1) { end.setDate(15); }
    else { end.setMonth(end.getMonth() + 1); end.setDate(0); }
    const monthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(start);
    const year = start.getFullYear().toString().slice(-2);
    const label = `${start.getDate() === 1 ? '1a' : '2a'} Quinz ${monthShort}/${year}`;
    quinzenas.push({ start, end, label });
    if (baseDate.getDate() === 1) { baseDate.setMonth(baseDate.getMonth() - 1); baseDate.setDate(16); }
    else { baseDate.setDate(1); }
  }
  return quinzenas.reverse();
};

export const getVisibleMonths = (offset: number): Date[] => {
  const months = [];
  const baseDate = new Date();
  baseDate.setMonth(baseDate.getMonth() - offset);
  for (let i = 4; i >= 0; i--) {
    const monthDate = new Date(baseDate);
    monthDate.setMonth(monthDate.getMonth() - i);
    months.push(monthDate);
  }
  return months;
};

export const formatMonthYear = (date: Date): string => {
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
  const year = date.getFullYear().toString().slice(-2);
  return `${month}/${year}`;
};

// ── Hook ───────────────────────────────────────────────────────────

export function useDashboardStats(activeTab: string) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('dia');

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    return getStartOfWeek(ontem);
  });
  const [dataSelecionada, setDataSelecionada] = useState<string>(() => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    return toLocalDateInput(ontem);
  });

  const [currentMonthForWeeks, setCurrentMonthForWeeks] = useState(() => new Date());
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [quinzenasOffset, setQuinzenasOffset] = useState(0);
  const [selectedQuinzenaIndex, setSelectedQuinzenaIndex] = useState(4);
  const [monthsOffset, setMonthsOffset] = useState(0);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(4);

  const weekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart]);
  const weeksOfMonth = useMemo(
    () => getWeeksOfMonth(currentMonthForWeeks.getFullYear(), currentMonthForWeeks.getMonth()),
    [currentMonthForWeeks],
  );
  const quinzenas = useMemo(() => getQuinzenas(quinzenasOffset), [quinzenasOffset]);
  const visibleMonths = useMemo(() => getVisibleMonths(monthsOffset), [monthsOffset]);

  const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split('T')[0]);

  // Sync day carousel with selected date
  useEffect(() => {
    if (!dataSelecionada) return;
    const selected = new Date(`${dataSelecionada}T00:00:00`);
    setCurrentWeekStart((prev) => {
      const start = new Date(prev);
      const end = new Date(prev);
      end.setDate(start.getDate() + 6);
      if (selected >= start && selected <= end) return prev;
      return getStartOfWeek(selected);
    });
  }, [dataSelecionada]);

  // Derive dataInicio/dataFim from period selection
  useEffect(() => {
    switch (periodo) {
      case 'dia':
        setDataInicio(dataSelecionada);
        setDataFim(dataSelecionada);
        break;
      case 'semana':
        if (weeksOfMonth[selectedWeekIndex]) {
          setDataInicio(toLocalDateInput(weeksOfMonth[selectedWeekIndex].start));
          setDataFim(toLocalDateInput(weeksOfMonth[selectedWeekIndex].end));
        }
        break;
      case 'quinzena':
        if (quinzenas[selectedQuinzenaIndex]) {
          setDataInicio(toLocalDateInput(quinzenas[selectedQuinzenaIndex].start));
          setDataFim(toLocalDateInput(quinzenas[selectedQuinzenaIndex].end));
        }
        break;
      case 'mes':
        if (visibleMonths[selectedMonthIndex]) {
          const monthDate = visibleMonths[selectedMonthIndex];
          const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
          const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
          setDataInicio(toLocalDateInput(firstDay));
          setDataFim(toLocalDateInput(lastDay));
        }
        break;
    }
  }, [periodo, dataSelecionada, selectedWeekIndex, weeksOfMonth, selectedQuinzenaIndex, quinzenas, selectedMonthIndex, visibleMonths]);

  // Fetch stats when dates change (dashboard tab)
  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    if (!dataInicio || !dataFim) return;
    setLoadingStats(true);
    api.get<AdminStats>(`/comunicacao/admin/stats?dataInicio=${dataInicio}&dataFim=${dataFim}`)
      .then((data) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [activeTab, dataInicio, dataFim]);

  const goToPreviousWeek = () => { const n = new Date(currentWeekStart); n.setDate(n.getDate() - 7); setCurrentWeekStart(n); };
  const goToNextWeek = () => { const n = new Date(currentWeekStart); n.setDate(n.getDate() + 7); setCurrentWeekStart(n); };
  const goToPreviousMonthForWeeks = () => { const n = new Date(currentMonthForWeeks); n.setMonth(n.getMonth() - 1); setCurrentMonthForWeeks(n); setSelectedWeekIndex(0); };
  const goToNextMonthForWeeks = () => { const n = new Date(currentMonthForWeeks); n.setMonth(n.getMonth() + 1); setCurrentMonthForWeeks(n); setSelectedWeekIndex(0); };
  const goToPreviousQuinzenas = () => setQuinzenasOffset(quinzenasOffset + 1);
  const goToNextQuinzenas = () => { if (quinzenasOffset > 0) setQuinzenasOffset(Math.max(0, quinzenasOffset - 1)); };
  const goToPreviousMonths = () => setMonthsOffset(monthsOffset + 5);
  const goToNextMonths = () => { if (monthsOffset > 0) setMonthsOffset(Math.max(0, monthsOffset - 5)); };
  const goToToday = () => { const hoje = new Date(); setDataSelecionada(toLocalDateInput(hoje)); setCurrentWeekStart(getStartOfWeek(hoje)); };

  return {
    stats, loadingStats, periodo, setPeriodo, dataInicio, dataFim,
    weekDates, dataSelecionada, setDataSelecionada, currentWeekStart, goToPreviousWeek, goToNextWeek, goToToday,
    currentMonthForWeeks, weeksOfMonth, selectedWeekIndex, setSelectedWeekIndex, goToPreviousMonthForWeeks, goToNextMonthForWeeks,
    quinzenas, quinzenasOffset, selectedQuinzenaIndex, setSelectedQuinzenaIndex, goToPreviousQuinzenas, goToNextQuinzenas,
    visibleMonths, monthsOffset, selectedMonthIndex, setSelectedMonthIndex, goToPreviousMonths, goToNextMonths,
    formatWeekDay, formatDayMonth, toLocalDateInput,
  };
}
