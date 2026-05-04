import React, { useState, useEffect } from 'react';
import { Users, Phone, Calendar, Trash2, Search, Filter, Clock, History, LayoutGrid, Camera, Monitor, Loader2, RotateCw, ShieldCheck } from 'lucide-react';
import { fetchUsers, fetchLogs, deleteUser, fetchStations } from '../services/faceService';
import { motion, AnimatePresence } from 'motion/react';

interface UserData {
  id: number;
  name: string;
  phone: string;
  createdAt: string;
}

interface AccessLog {
  id: number;
  userId: number;
  userName: string;
  detectedAt: string;
}

interface StationData {
  machineId: string;
  lastSnapshot: string;
  lastDetectedUser: string | null;
  lastSeen: string;
}

export default function Admin() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [stations, setStations] = useState<StationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null);

  const loadData = async (isInitial = false) => {
    try {
      const [usersData, logsData, stationsData] = await Promise.all([
        fetchUsers(),
        fetchLogs(),
        fetchStations()
      ]);
      setUsers(usersData);
      setLogs(logsData);
      setStations(stationsData);
    } catch (err) {
      console.error(err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    // Polling a cada 2 segundos para manter o painel atualizado
    const interval = setInterval(() => {
      loadData(false);
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Sincroniza a estação selecionada com as atualizações em tempo real
  useEffect(() => {
    if (selectedStation) {
      const latest = stations.find(s => s.machineId === selectedStation.machineId);
      if (latest) {
        setSelectedStation(latest);
      } else {
        // Estação ficou offline
        setSelectedStation(null);
      }
    }
  }, [stations]);

  // Listener para fechar com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedStation(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const formatBrasiliaTime = (dateStr: string) => {
    if (!dateStr) return 'Sem registro';
    try {
      // Garantir que a string de data do SQLite (que é UTC) seja tratada como UTC adicionando o sufixo 'Z'
      // Se a string já tiver espaço ou não tiver 'T', normalizamos
      const normalizedDate = dateStr.includes(' ') ? dateStr.replace(' ', 'T') + 'Z' : dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
      const date = new Date(normalizedDate);
      
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este usuário? Isso também removerá seus logs.')) return;
    try {
      await deleteUser(id);
      await loadData();
    } catch (err) {
      alert('Erro ao excluir usuário.');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phone?.includes(searchTerm)
  );

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-12">
      <AnimatePresence>
        {selectedStation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 md:p-12 overflow-hidden"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-gray-950 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="absolute top-6 right-6 z-20">
                <button 
                  onClick={() => setSelectedStation(null)}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all group"
                >
                  <Trash2 className="w-6 h-6 rotate-45 group-hover:rotate-0 transition-transform" />
                </button>
              </div>

              <div className="relative aspect-video w-full bg-black">
                {selectedStation.lastSnapshot ? (
                  <img 
                    src={selectedStation.lastSnapshot} 
                    alt="Live View" 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                  </div>
                )}
                <div className="absolute top-8 left-8 flex items-center gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm uppercase tracking-widest animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full" />
                    LIVE
                  </div>
                  <div className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl font-bold text-sm">
                    {selectedStation.machineId}
                  </div>
                </div>
                {/* Overlay Scanning Effect */}
                <div className="absolute inset-0 pointer-events-none border-[20px] border-indigo-500/10 opacity-20" />
                <div className="absolute top-0 w-full h-1 bg-indigo-500/50 blur-sm animate-scan" />
              </div>

              <div className="p-8 bg-gray-900 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                 <div className="flex items-center gap-6">
                    <div className="space-y-1">
                       <p className="text-gray-500 text-xs font-black uppercase tracking-widest">Status da Estação</p>
                       <p className="text-white font-bold text-xl flex items-center gap-2">
                         Conectada há {formatBrasiliaTime(selectedStation.lastSeen).split(',')[1]}
                       </p>
                    </div>
                 </div>
                 {selectedStation.lastDetectedUser && (
                   <div className="px-6 py-3 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3">
                     <ShieldCheck className="w-6 h-6 text-green-400" />
                     <div>
                       <p className="text-green-400/60 text-[10px] font-black uppercase">Última Detecção</p>
                       <p className="text-green-400 font-bold text-lg">{selectedStation.lastDetectedUser}</p>
                     </div>
                   </div>
                 )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Central de Monitoramento Multi-Câmeras */}
      <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <Monitor className="w-8 h-8 text-indigo-600" />
              Monitoramento em Tempo Real
              <button 
                onClick={() => loadData()}
                className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-indigo-600"
                title="Recarregar Agora"
              >
                <RotateCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </h2>
            <p className="text-gray-500 font-medium italic">Visualização em tempo real das estações de reconhecimento conectadas.</p>
          </div>
          <div className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-bold flex items-center gap-2">
            <Camera className="w-4 h-4" />
            {stations.length} Estações Online
          </div>
        </div>
        
        <div className="p-8">
          {stations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence>
                {stations.map((station) => (
                  <motion.div 
                    key={station.machineId}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={() => setSelectedStation(station)}
                    className="group relative bg-gray-900 rounded-3xl overflow-hidden shadow-lg border-2 border-transparent hover:border-indigo-500 transition-all aspect-video cursor-pointer"
                  >
                    {station.lastSnapshot ? (
                      <img 
                        src={station.lastSnapshot} 
                        alt={station.machineId} 
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                    
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl text-white text-xs font-bold uppercase tracking-widest border border-white/30 shadow-lg">
                        Ver ao Vivo
                      </div>
                    </div>

                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <div className="px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-bold text-white tracking-widest uppercase">
                        {station.machineId}
                      </div>
                    </div>
                    
                    <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-1">
                       <div className="flex items-center justify-between">
                         <span className="text-[10px] text-white/60 font-mono">Último Visto: {formatBrasiliaTime(station.lastSeen).split(',')[1]}</span>
                       </div>
                       <div className="h-8 flex items-center gap-2">
                         {station.lastDetectedUser ? (
                           <div className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[10px] font-bold flex items-center gap-1">
                             <Users className="w-3 h-3" />
                             DETECÇÃO: {station.lastDetectedUser}
                           </div>
                         ) : (
                           <div className="px-2 py-0.5 bg-white/5 text-white/40 border border-white/10 rounded text-[10px] font-medium italic">
                             Aguardando detecção...
                           </div>
                         )}
                       </div>
                    </div>
                    
                    {/* Scan Line effect on specific station */}
                    <div className="absolute top-0 w-full h-0.5 bg-indigo-500/30 animate-scan pointer-events-none" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center gap-4 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
               <Monitor className="w-16 h-16 text-gray-200" />
               <div className="space-y-1">
                 <h3 className="text-xl font-bold text-gray-400">Nenhuma câmera ativa</h3>
                 <p className="text-gray-400 text-sm">Abra a tela de Reconhecimento em outro dispositivo para começar o monitoramento.</p>
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <History className="w-8 h-8 text-indigo-600" />
              Histórico de Acessos
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
            </h2>
            <p className="text-gray-500 font-medium italic">Registros de identificação em tempo real.</p>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {logs.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {logs.map((log, idx) => (
                <div key={log.id} className="px-8 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
                      {log.userName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{log.userName}</p>
                      <p className="text-xs text-gray-400">Identificado com sucesso</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 font-mono text-sm">
                    <Clock className="w-4 h-4 opacity-50" />
                    {formatBrasiliaTime(log.detectedAt)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400">Nenhum log de acesso registrado ainda.</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <Users className="w-8 h-8 text-indigo-600" />
              Base de Usuários
            </h2>
            <p className="text-gray-500 font-medium italic">Gestão de identidades biometrizadas.</p>
          </div>

          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type="text"
              placeholder="Pesquisar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all shadow-sm"
              id="admin-search"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 font-medium">Consultando banco de dados...</p>
            </div>
          ) : filteredUsers.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Usuário</th>
                  <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Contato</th>
                  <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Data de Cadastro</th>
                  <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((user, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={user.id}
                    className="hover:bg-indigo-50/30 transition-colors group"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg shadow-inner">
                          {user.name.charAt(0)}
                        </div>
                        <span className="font-bold text-gray-900 text-lg">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-gray-600 font-medium">
                        <Phone className="w-4 h-4 opacity-50" />
                        {user.phone || 'N/A'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <Calendar className="w-4 h-4 opacity-50" />
                        {formatBrasiliaTime(user.createdAt)}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => handleDelete(user.id)}
                        className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        title="Excluir Usuário"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-20 text-center space-y-4">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <Users className="w-10 h-10 text-gray-300" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Nenhum registro encontrado</h3>
                <p className="text-gray-500">Tente ajustar seus filtros de pesquisa.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
