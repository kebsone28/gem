import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Send, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Sparkles,
  RefreshCw,
  Zap,
  MapPin,
  Calendar
} from 'lucide-react';
import apiClient from '../api/client';
import toast from 'react-hot-toast';

interface Suggestion {
  id: string;
  type: 'action' | 'form';
  label: string;
  description: string;
  severity: 'info' | 'warning' | 'success' | 'error';
  action: any;
  fields?: any[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: Suggestion[];
}

export default function CopilotAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<Message[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis votre copilote GEM. Comment puis-je vous aider aujourd\'hui ?' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat]);

  const handleSend = async () => {
    if (!message.trim()) return;

    const userMessage = message;
    setChat(prev => [...prev, { role: 'user', content: userMessage }]);
    setMessage('');
    setIsTyping(true);

    try {
      const response = await apiClient.post('ai/agent/query', {
        message: userMessage,
        context: { projectId: 'active-project' } // POC placeholder
      });

      setChat(prev => [...prev, { 
        role: 'assistant', 
        content: response.data.text,
        suggestions: response.data.suggestions
      }]);
    } catch (error) {
      toast.error("Erreur de l'assistant");
    } finally {
      setIsTyping(false);
    }
  };

  const executeAction = async (suggestion: Suggestion) => {
    toast.loading(`Exécution : ${suggestion.label}...`, { id: 'agent-exec' });
    try {
      const response = await apiClient.post('ai/agent/execute', {
        action: suggestion.action
      });
      
      if (response.data.success) {
        toast.success(response.data.message, { id: 'agent-exec' });
        setChat(prev => [...prev, { role: 'assistant', content: `✅ ${response.data.message}` }]);
      }
    } catch (error) {
      toast.error("Échec de l'exécution", { id: 'agent-exec' });
    }
  };

  return (
    <div className="fixed bottom-8 left-8 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 left-0 w-96 h-[500px] bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="text-white font-black uppercase tracking-widest text-xs">Copilote GEM</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Assistant Actif</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Chat Content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {chat.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] space-y-4`}>
                    <div className={`p-4 rounded-3xl text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white/5 text-slate-300 rounded-tl-none border border-white/5'
                    }`}>
                      {msg.content}
                    </div>

                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="space-y-3">
                        {msg.suggestions.map((s) => (
                          <div key={s.id} className="bg-black/20 border border-white/5 p-4 rounded-2xl space-y-3">
                            <div className="flex items-start gap-3">
                              <div className={`mt-1 ${
                                s.severity === 'success' ? 'text-emerald-400' :
                                s.severity === 'warning' ? 'text-amber-400' :
                                'text-blue-400'
                              }`}>
                                {s.id === 'sync_kobo' ? <RefreshCw size={14} /> : 
                                 s.id === 'switch_plan_b' ? <Zap size={14} /> : 
                                 <Sparkles size={14} />}
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-white uppercase tracking-widest">{s.label}</p>
                                <p className="text-[10px] text-slate-500 mt-1">{s.description}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => executeAction(s)}
                              className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                s.severity === 'success' ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white' :
                                s.severity === 'warning' ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white' :
                                'bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white'
                              }`}
                            >
                              Approuver l'action
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/5 p-4 rounded-3xl rounded-tl-none border border-white/5">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 border-t border-white/5 bg-black/20">
              <div className="relative">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Posez-moi une question..."
                  className="w-full bg-slate-800 border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
                />
                <button 
                  onClick={handleSend}
                  className="absolute right-2 top-2 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-[8px] text-slate-600 text-center mt-4 font-bold uppercase tracking-widest">
                Appuyez sur Entrée pour envoyer
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-[1.5rem] shadow-2xl flex items-center justify-center text-white transition-all ${
          isOpen ? 'bg-slate-800 rotate-90' : 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-blue-600/20'
        }`}
      >
        {isOpen ? <X size={24} /> : <Bot size={28} />}
      </motion.button>
    </div>
  );
}
