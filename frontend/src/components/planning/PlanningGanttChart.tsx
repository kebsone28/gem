import React, { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { format, addDays, differenceInCalendarDays, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';

interface GanttTask {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  teamName?: string;
  phase: string;
  isDelayed: boolean;
  isBlocked: boolean;
  color: string;
  dependencies?: string[];
}

interface PlanningGanttChartProps {
  tasks: GanttTask[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onTaskClick?: (task: GanttTask) => void;
  isLoading?: boolean;
}

// Optimisation : Hook pour la navigation dans le temps
const useGanttNavigation = (currentDate: Date, onDateChange: (date: Date) => void) => {
  const navigateWeek = useCallback((direction: number) => {
    const newDate = addDays(currentDate, direction * 7);
    onDateChange(newDate);
  }, [currentDate, onDateChange]);

  const navigateMonth = useCallback((direction: number) => {
    const newDate = addDays(currentDate, direction * 30);
    onDateChange(newDate);
  }, [currentDate, onDateChange]);

  const goToToday = useCallback(() => {
    onDateChange(new Date());
  }, [onDateChange]);

  return {
    navigateWeek,
    navigateMonth,
    goToToday,
  };
};

// Optimisation : Hook pour le calcul des jours affichés
const useGanttDays = (currentDate: Date, windowDays: number = 21) => {
  return useMemo(() => {
    const startOfWeekDate = new Date(currentDate);
    const day = startOfWeekDate.getDay();
    const diff = startOfWeekDate.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeekDate.setDate(diff);

    const days = [];
    for (let i = 0; i < windowDays; i++) {
      const date = addDays(startOfWeekDate, i);
      days.push({
        date,
        label: format(date, 'dd'),
        dayLabel: format(date, 'EEEEEE', { locale: fr }),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isToday: isToday(date),
      });
    }
    return days;
  }, [currentDate, windowDays]);
};

// Optimisation : Composant de jour mémoïsé
const GanttDay = memo(({ 
  day, 
  index 
}: { 
  day: any; 
  index: number; 
}) => (
  <div
    className={`flex-shrink-0 w-12 text-center border-r border-white/10 ${
      day.isWeekend ? 'bg-red-500/10' : ''
    } ${day.isToday ? 'bg-blue-500/20' : ''}`}
  >
    <div className={`text-xs font-medium ${
      day.isWeekend ? 'text-red-400' : 'text-white/70'
    }`}>
      {day.dayLabel}
    </div>
    <div className={`text-sm font-bold ${
      day.isToday ? 'text-blue-400' : 'text-white'
    }`}>
      {day.label}
    </div>
  </div>
));

GanttDay.displayName = 'GanttDay';

// Optimisation : Composant de tâche Gantt
const GanttTaskBar = memo(({ 
  task, 
  ganttDays, 
  startIndex, 
  onClick 
}: { 
  task: GanttTask; 
  ganttDays: any[]; 
  startIndex: number; 
  onClick?: (task: GanttTask) => void; 
}) => {
  const taskStartIndex = Math.max(0, differenceInCalendarDays(task.startDate, ganttDays[0]?.date || new Date()));
  const taskEndIndex = Math.min(ganttDays.length - 1, differenceInCalendarDays(task.endDate, ganttDays[0]?.date || new Date()));
  const taskWidth = Math.max(1, taskEndIndex - taskStartIndex + 1);
  const taskLeft = taskStartIndex * 48; // 48px par jour

  const handleClick = useCallback(() => {
    onClick?.(task);
  }, [task, onClick]);

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.3, delay: startIndex * 0.05 }}
      className="absolute h-8 rounded cursor-pointer shadow-lg hover:shadow-xl transition-shadow"
      style={{
        left: `${taskLeft}px`,
        width: `${taskWidth * 48 - 4}px`,
        backgroundColor: task.color,
        top: `${startIndex * 40 + 4}px`,
      }}
      onClick={handleClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Barre de progression */}
      <div 
        className="h-full bg-white/30 rounded-l"
        style={{ width: `${task.progress}%` }}
      />
      
      {/* Contenu de la tâche */}
      <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
        <div className="flex items-center gap-1">
          {task.isBlocked && (
            <AlertTriangle className="w-3 h-3 text-red-300 flex-shrink-0" />
          )}
          {task.isDelayed && !task.isBlocked && (
            <AlertTriangle className="w-3 h-3 text-amber-300 flex-shrink-0" />
          )}
          {!task.isBlocked && !task.isDelayed && task.progress === 100 && (
            <CheckCircle2 className="w-3 h-3 text-green-300 flex-shrink-0" />
          )}
          <span className="text-xs text-white font-medium truncate">
            {task.name}
          </span>
        </div>
      </div>
      
      {/* Tooltip au survol */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileHover={{ opacity: 1, y: 0 }}
        className="absolute bottom-full left-0 mb-2 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-50 pointer-events-none whitespace-nowrap"
      >
        <div className="font-semibold">{task.name}</div>
        <div>{task.teamName || 'Non assigné'}</div>
        <div>{format(task.startDate, 'dd/MM/yyyy')} - {format(task.endDate, 'dd/MM/yyyy')}</div>
        <div>Progression: {task.progress}%</div>
        {task.isBlocked && <div className="text-red-400">⚠️ Bloqué</div>}
        {task.isDelayed && !task.isBlocked && <div className="text-amber-400">⚠️ En retard</div>}
      </motion.div>
    </motion.div>
  );
});

GanttTaskBar.displayName = 'GanttTaskBar';

// Optimisation : Composant de ligne de tâche
const GanttTaskRow = memo(({ 
  task, 
  ganttDays, 
  index, 
  onTaskClick 
}: { 
  task: GanttTask; 
  ganttDays: any[]; 
  index: number; 
  onTaskClick?: (task: GanttTask) => void; 
}) => (
  <div className="relative h-10 border-b border-white/5 hover:bg-white/5 transition-colors">
    <div className="absolute left-0 top-0 w-32 h-full flex items-center px-3 border-r border-white/10 bg-white/5">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${task.color}`} />
        <span className="text-sm text-white font-medium truncate">
          {task.name}
        </span>
      </div>
    </div>
    
    <div className="absolute left-32 right-0 top-0 h-full">
      <GanttTaskBar
        task={task}
        ganttDays={ganttDays}
        startIndex={index}
        onClick={onTaskClick}
      />
    </div>
  </div>
));

GanttTaskRow.displayName = 'GanttTaskRow';

export const PlanningGanttChart = memo(({
  tasks,
  currentDate,
  onDateChange,
  onTaskClick,
  isLoading = false,
}: PlanningGanttChartProps) => {
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const { navigateWeek, navigateMonth, goToToday } = useGanttNavigation(currentDate, onDateChange);
  const ganttDays = useGanttDays(currentDate);

  // Optimisation : Tri et filtrage des tâches
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [tasks]);

  // Optimisation : Gestion du clic sur tâche
  const handleTaskClick = useCallback((task: GanttTask) => {
    setSelectedTask(task);
    onTaskClick?.(task);
  }, [onTaskClick]);

  // Optimisation : Défilement automatique vers aujourd'hui
  useEffect(() => {
    if (scrollContainerRef.current) {
      const todayIndex = ganttDays.findIndex(day => day.isToday);
      if (todayIndex >= 0) {
        const scrollLeft = todayIndex * 48;
        scrollContainerRef.current.scrollLeft = scrollLeft;
      }
    }
  }, [ganttDays]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden"
    >
      {/* En-tête avec navigation */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-white">Diagramme de Gantt</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Semaine précédente"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Semaine suivante"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
            >
              <Calendar className="w-4 h-4" />
              Aujourd'hui
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Users className="w-4 h-4" />
          {tasks.length} tâches
        </div>
      </div>

      {/* Contenu du Gantt */}
      <div className="relative">
        {/* En-tête des jours */}
        <div className="flex border-b border-white/10 bg-white/5 sticky top-0 z-10">
          <div className="w-32 flex-shrink-0 p-2 border-r border-white/10">
            <div className="text-xs text-white/70 font-medium">TÂCHE</div>
          </div>
          <div 
            ref={scrollContainerRef}
            className="flex overflow-x-auto scrollbar-hide"
          >
            {ganttDays.map((day, index) => (
              <GanttDay key={index} day={day} index={index} />
            ))}
          </div>
        </div>

        {/* Liste des tâches */}
        <div className="relative">
          <AnimatePresence>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sortedTasks.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-white/50">
                Aucune tâche à afficher
              </div>
            ) : (
              <div className="relative">
                {sortedTasks.map((task, index) => (
                  <GanttTaskRow
                    key={task.id}
                    task={task}
                    ganttDays={ganttDays}
                    index={index}
                    onTaskClick={handleTaskClick}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Panneau de détails de tâche */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 right-4 w-80 bg-gray-900 rounded-lg shadow-xl border border-white/10 p-4 z-50"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-white">{selectedTask.name}</h4>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-white/50 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/70">Phase:</span>
                <span className="text-white">{selectedTask.phase}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Équipe:</span>
                <span className="text-white">{selectedTask.teamName || 'Non assigné'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Progression:</span>
                <span className="text-white">{selectedTask.progress}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Début:</span>
                <span className="text-white">{format(selectedTask.startDate, 'dd/MM/yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Fin:</span>
                <span className="text-white">{format(selectedTask.endDate, 'dd/MM/yyyy')}</span>
              </div>
              
              {selectedTask.isBlocked && (
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Tâche bloquée</span>
                </div>
              )}
              
              {selectedTask.isDelayed && !selectedTask.isBlocked && (
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Tâche en retard</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

PlanningGanttChart.displayName = 'PlanningGanttChart';
