import React, { useRef, useState, useEffect, useMemo } from 'react';
import * as faceapi from 'face-api.js';
import { ShieldCheck, User, Search, Loader2, UserCheck, UserX, Camera, Clock, History, Settings2, Sliders } from 'lucide-react';
import { loadModels, fetchUserEncodings, UserEncoding, logAccess, sendHeartbeat } from '../services/faceService';
import { motion, AnimatePresence } from 'motion/react';

interface LogEntry {
  id: string;
  type: 'success' | 'unknown';
  user: string | null;
  time: string;
}

export default function Recognize() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snapshotCanvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ user: string | null; confidence: number } | null>(null);
  const [knownUsers, setKnownUsers] = useState<UserEncoding[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [faceInFrame, setFaceInFrame] = useState(false);
  const [ssdMinConfidence, setSsdMinConfidence] = useState(0.01);
  const [tinyScoreThreshold, setTinyScoreThreshold] = useState(0.01);
  const [showSettings, setShowSettings] = useState(false);

  // Memoize descriptors to avoid recreating them every frame (MASSIVE PERFORMANCE GAIN)
  const labeledDescriptors = useMemo(() => {
    return knownUsers.map(u => new faceapi.LabeledFaceDescriptors(u.name, [new Float32Array(u.encoding)]));
  }, [knownUsers]);

  const faceMatcher = useMemo(() => {
    if (labeledDescriptors.length === 0) return null;
    // 0.6 é o padrão da indústria. 0.65 permite um pouco mais de flexibilidade.
    return new faceapi.FaceMatcher(labeledDescriptors, 0.65);
  }, [labeledDescriptors]);

  // Debug distance
  useEffect(() => {
    if (result && result.user) {
      console.log(`Reconhecido: ${result.user} com confiança ${result.confidence.toFixed(2)}`);
    }
  }, [result]);

  // Machine ID for persistent tracking of this specific station
  const machineId = useMemo(() => {
    let id = localStorage.getItem('station_machine_id');
    if (!id) {
      id = 'STATION-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem('station_machine_id', id);
    }
    return id;
  }, []);

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        streamRef.current = mediaStream;
      }
    } catch (err: any) {
      console.error(err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message.includes('denied')) {
        alert('Câmera bloqueada. Por favor, libere o acesso nas configurações do seu navegador.');
      }
    }
  };

  const captureSnapshot = () => {
    if (!videoRef.current || !snapshotCanvasRef.current || videoRef.current.readyState < 4) return null;
    const canvas = snapshotCanvasRef.current;
    const video = videoRef.current;
    
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.5);
    if (data.length < 1000) return null;
    return data;
  };

  useEffect(() => {
    async function init() {
      try {
        await loadModels();
        const users = await fetchUserEncodings();
        console.log("Usuários carregados para reconhecimento:", users.length, users.map(u => u.name));
        setKnownUsers(users);
        setLoading(false);
        await startCamera();
      } catch (err: any) {
        console.error(err);
        setLoading(false);
      }
    }
    init();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!stream) return;
    const interval = setInterval(() => {
      const snapshot = captureSnapshot();
      if (snapshot) {
        sendHeartbeat(machineId, snapshot, result?.user || undefined).catch(() => {});
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [stream, machineId, result]);

  const [isAutoScanning, setIsAutoScanning] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (type: 'success' | 'unknown', user: string | null) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      user,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  const [manualZoom, setManualZoom] = useState({ scale: 1, x: 0, y: 0 });
  const [zoom, setZoom] = useState({ scale: 1, originX: 0.5, originY: 0.5 });

  const resetAllZoom = () => {
    setManualZoom({ scale: 1, x: 0, y: 0 });
    setZoom({ scale: 1, originX: 0.5, originY: 0.5 });
  };

  const handleZoom = (delta: number) => {
    setManualZoom(prev => ({
      ...prev,
      scale: Math.max(1, Math.min(3, prev.scale + delta))
    }));
  };

  const lastFullScan = useRef<number>(0);
  const [matchCount, setMatchCount] = useState<{ label: string; count: number }>({ label: '', count: 0 });
  const [unknownCount, setUnknownCount] = useState(0);
  const isProcessing = useRef(false);

  const recognizeFace = async () => {
    if (isProcessing.current || !videoRef.current || !videoRef.current.srcObject || videoRef.current.readyState < 2 || knownUsers.length === 0 || scanning || !isAutoScanning) return;
    
    isProcessing.current = true;
    const video = videoRef.current;
    const now = Date.now();
    
    try {
      // ESTÁGIO 1: Rastreamento Ultra-Rápido (TinyFace - 60 FPS feel)
      // Usamos o motor leve apenas para detectar a presença e posição do rosto
      const trackerDetection = await faceapi.detectSingleFace(
        video, 
        new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: tinyScoreThreshold })
      ).withFaceLandmarks();

      if (!trackerDetection) {
        setFaceInFrame(false);
        setMatchCount({ label: '', count: 0 });
        setUnknownCount(0);
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        isProcessing.current = false;
        return;
      }

      // Desenho da UI (Instantâneo)
      const canvas = canvasRef.current;
      if (!canvas) { isProcessing.current = false; return; }
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);
      const ctx = canvas.getContext('2d');
      if (!ctx) { isProcessing.current = false; return; }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const resized = faceapi.resizeResults(trackerDetection, displaySize);
      const { box } = resized.detection;
      const landmarks = resized.landmarks;

      const videoHeight = video.videoHeight;
      const videoWidth = video.videoWidth;
      const faceCenterX = box.x + box.width / 2;
      
      const isTooFar = box.height < videoHeight * 0.12; 
      const isTooClose = box.height > videoHeight * 0.95;
      const isOffCenter = Math.abs(faceCenterX - videoWidth / 2) > videoWidth * 0.40;
      
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const eyeDiff = Math.abs(leftEye[0].y - rightEye[0].y);
      const isAligned = eyeDiff < box.height * 0.45;

      setFaceInFrame(true);

      const isStable = isAligned && !isTooFar && !isOffCenter;
      const color = isStable ? '#22c55e' : '#f59e0b';
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      
      const lenCorner = 50;
      ctx.beginPath();
      ctx.moveTo(box.x, box.y + lenCorner); ctx.lineTo(box.x, box.y); ctx.lineTo(box.x + lenCorner, box.y);
      ctx.moveTo(box.right - lenCorner, box.y); ctx.lineTo(box.right, box.y); ctx.lineTo(box.right, box.y + lenCorner);
      ctx.moveTo(box.x, box.bottom - lenCorner); ctx.lineTo(box.x, box.bottom); ctx.lineTo(box.x + lenCorner, box.bottom);
      ctx.moveTo(box.right - lenCorner, box.bottom); ctx.lineTo(box.right, box.bottom); ctx.lineTo(box.right, box.bottom - lenCorner);
      ctx.stroke();

      // ESTÁGIO 2: Reconhecimento Biométrico (Qualidade Máxima - Modo AGRESSIVO)
      // Removida a exigência de "isStable" para garantir reconhecimento em qualquer condição
      if (faceMatcher && !scanning && (now - lastFullScan.current > 150)) {
        lastFullScan.current = now;
        
        // Efeito Visual de Scanline (Otimizado)
        const scanY = ((now % 800) / 800) * box.height + box.y;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(box.x, scanY); ctx.lineTo(box.right, scanY); ctx.stroke();
        
        // Ativando detecção SSD de ultra-alta sensibilidade
        const biometricDetection = await faceapi.detectSingleFace(
          video, 
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.01 })
        ).withFaceLandmarks().withFaceDescriptor();

        if (biometricDetection) {
          const match = faceMatcher.findBestMatch(biometricDetection.descriptor);
          
          // Limite de distância aumentado para 0.65 para permitir reconhecimento em luz ruim
          if (match.label !== 'unknown' && match.distance < 0.65) {
            setUnknownCount(0);
            if (matchCount.label === match.label) {
              const newCount = matchCount.count + 1;
              
              // Barra de Progresso Biométrico (Verde)
              const progress = (newCount / 2);
              ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
              ctx.fillRect(box.x, box.bottom + 15, box.width, 8);
              ctx.fillStyle = '#22c55e';
              ctx.fillRect(box.x, box.bottom + 15, box.width * progress, 8);

              if (newCount >= 2) { 
                setScanning(true);
                setMatchCount({ label: '', count: 0 });
                const originX = (box.x + box.width / 2) / video.videoWidth;
                const originY = (box.y + box.height / 2) / video.videoHeight;
                setZoom({ scale: 1.5, originX, originY });
                setResult({ user: match.label, confidence: 1 - match.distance });
                addLog('success', match.label);
                logAccess(match.label).catch(console.error);
                setIsAutoScanning(false);
                setTimeout(() => { 
                  setResult(null); 
                  setZoom({ scale: 1, originX: 0.5, originY: 0.5 });
                  setIsAutoScanning(true); 
                  setScanning(false);
                }, 3500);
              } else { setMatchCount({ ...matchCount, count: newCount }); }
            } else { setMatchCount({ label: match.label, count: 1 }); }
          } else {
            setMatchCount({ label: '', count: 0 });
            const nextUnknown = unknownCount + 1;
            
            // Barra de Progresso Desconhecido (Laranja)
            const progress = (nextUnknown / 8);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
            ctx.fillRect(box.x, box.bottom + 15, box.width, 8);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(box.x, box.bottom + 15, box.width * progress, 8);

            if (nextUnknown >= 8) { 
              setScanning(true);
              setUnknownCount(0);
              setResult({ user: null, confidence: 0 });
              addLog('unknown', null);
              setIsAutoScanning(false);
              setTimeout(() => { setResult(null); setIsAutoScanning(true); setScanning(false); }, 3000);
            } else { setUnknownCount(nextUnknown); }
          }
        }
      }

      // Instruções em tempo real
      ctx.font = 'bold 16px Inter';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      if (isTooFar) ctx.fillText('APROXIME-SE', videoWidth / 2, videoHeight - 40);
      else if (isOffCenter) ctx.fillText('CENTRALIZE O ROSTO', videoWidth / 2, videoHeight - 40);
      else if (!isAligned) ctx.fillText('MANTENHA A CABEÇA RETA', videoWidth / 2, videoHeight - 40);

    } catch (err) { console.error(err); } 
    finally { isProcessing.current = false; }
  };

  useEffect(() => {
    let tid: any;
    if (stream && isAutoScanning && !loading && knownUsers.length > 0) {
      const run = async () => { 
        await recognizeFace(); 
        // 10ms de intervalo garante fluidez total, mas evita colisão de threads
        tid = setTimeout(run, 10); 
      };
      run();
    }
    return () => clearTimeout(tid);
  }, [stream, isAutoScanning, loading, knownUsers, ssdMinConfidence, tinyScoreThreshold]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-gray-500 font-medium animate-pulse">Sincronizando base biométrica...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <canvas ref={snapshotCanvasRef} className="hidden" />
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight flex items-center justify-center gap-3">
            <ShieldCheck className="w-10 h-10 text-indigo-600" />
            Check-in Facial
          </h1>
          <p className="text-gray-500 text-lg">Posicione-se em frente à câmera para identificação rápida.</p>
        </div>

        <div className={`relative group max-w-xl mx-auto aspect-video bg-gray-950 rounded-[2.5rem] overflow-hidden shadow-2xl ring-8 transition-all duration-500 ${faceInFrame ? 'ring-indigo-500/20 shadow-indigo-500/10' : 'ring-white'} flex items-center justify-center`}>
          <motion.div 
            drag={manualZoom.scale > 1}
            dragConstraints={{ left: -300, right: 300, top: -200, bottom: 200 }}
            animate={{ 
              scale: zoom.scale * manualZoom.scale, 
              originX: zoom.originX, 
              originY: zoom.originY,
              x: manualZoom.x,
              y: manualZoom.y
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            className="w-full h-full relative scale-x-[-1]"
          >
            <video ref={videoRef} autoPlay muted className="w-full h-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none z-10" />
          </motion.div>

          {/* Controles de Zoom Manuais */}
          <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => handleZoom(0.2)}
              className="p-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl text-white hover:bg-indigo-600 transition-all shadow-xl"
              title="Zoom In"
            >
              <Search className="w-5 h-5" />
            </button>
            <button 
              onClick={() => handleZoom(-0.2)}
              className="p-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl text-white hover:bg-indigo-600 transition-all shadow-xl"
              title="Zoom Out"
            >
              <Search className="w-5 h-5 rotate-90" />
            </button>
            <button 
              onClick={resetAllZoom}
              className="p-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl text-white hover:bg-red-500 transition-all shadow-xl"
              title="Reset Zoom"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
          {!stream && !loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 text-center z-10">
              <button onClick={startCamera} className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-2xl hover:bg-indigo-700 transition-all flex items-center gap-3">
                <Camera className="w-6 h-6" />
                Ativar Câmera para Reconhecimento
              </button>
            </div>
          )}
          
          <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute top-0 w-full h-1 bg-indigo-500/50 blur-[2px] transition-all duration-[3000ms] ease-linear ${scanning ? 'translate-y-[100%] animate-scan' : 'hidden'}`} />
            <div className="absolute inset-0 border-[20px] border-black/10 rounded-[2.5rem]" />
          </div>

          <div className="absolute top-6 right-6 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/20 text-white text-xs font-mono tracking-widest flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${stream ? 'bg-green-500' : 'bg-red-500'}`} />
              {knownUsers.length === 0 ? <span className="text-amber-400 font-bold uppercase">Base Vazia</span> : 
               faceInFrame ? <span className="text-green-400 font-bold uppercase">Rosto em Foco</span> : 'Aguardando Rosto'}
            </div>
            <div className="text-[8px] opacity-60 uppercase font-bold tracking-tighter">
              {knownUsers.length} Perfis Biométricos Sincronizados
            </div>
          </div>

          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="absolute inset-0 flex items-center justify-center p-6">
                <div className={`w-full max-w-sm backdrop-blur-xl p-8 rounded-3xl border-2 flex flex-col items-center gap-4 text-center shadow-2xl ${result.user ? 'bg-green-500/20 border-green-400/50' : 'bg-red-500/20 border-red-400/50'}`}>
                  <div className={`p-4 rounded-full ${result.user ? 'bg-green-400/20' : 'bg-red-400/20'}`}>
                    {result.user ? <UserCheck className="w-12 h-12 text-green-400" /> : <UserX className="w-12 h-12 text-red-400" />}
                  </div>
                  <div className="space-y-1">
                    <h3 className={`text-2xl font-bold ${result.user ? 'text-green-50' : 'text-red-50'}`}>{result.user ? `Bem-vindo, ${result.user}` : 'Usuário não identificado'}</h3>
                    <p className="text-white/60 text-sm font-medium uppercase tracking-wider">{result.user ? `Confiança: ${(result.confidence * 100).toFixed(1)}%` : 'Rosto não coincide com a base'}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col gap-4 max-w-sm mx-auto">
          <div className="w-full p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-center gap-3">
             <div className="w-2 h-2 bg-indigo-600 rounded-full animate-ping" />
             <span className="text-indigo-600 font-bold uppercase tracking-widest text-xs">Escaneamento Ativo</span>
          </div>
          <button onClick={() => setResult(null)} className="w-full py-3 text-gray-400 font-medium hover:text-indigo-600 transition-colors text-sm">Resetar Status</button>
        </div>

        {/* Painel de Sensibilidade */}
        <div className="max-w-xl mx-auto space-y-4">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors mx-auto"
          >
            <Settings2 className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-90' : ''}`} />
            AJUSTAR SENSIBILIDADE
          </button>

          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white p-6 rounded-3xl border border-indigo-100 shadow-sm space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-bold text-gray-700">Motor SSD (Principal)</span>
                      </div>
                      <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg">
                        {ssdMinConfidence.toFixed(2)}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0.01" 
                      max="0.95" 
                      step="0.01"
                      value={ssdMinConfidence}
                      onChange={(e) => setSsdMinConfidence(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <p className="text-[10px] text-gray-400 font-medium leading-relaxed italic">
                      Valores menores aumentam a chance de detecção, mas podem gerar mais falsos positivos em ambientes com muita sombra ou luz.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-gray-50 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-bold text-gray-700">Motor Tiny (Fallback)</span>
                      </div>
                      <span className="text-xs font-mono bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">
                        {tinyScoreThreshold.toFixed(2)}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0.01" 
                      max="0.95" 
                      step="0.01"
                      value={tinyScoreThreshold}
                      onChange={(e) => setTinyScoreThreshold(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <p className="text-[10px] text-gray-400 font-medium leading-relaxed italic">
                      Usado quando o SSD falha. Muito útil para câmeras de baixa resolução ou rostos distantes.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Painel de Logs */}
        <div className="max-w-xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              Histórico de Acessos
            </h3>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Tempo Real</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
            <AnimatePresence initial={false}>
              {logs.length === 0 ? (
                <div className="p-8 text-center text-gray-400 italic text-sm">
                  Nenhuma atividade registrada ainda.
                </div>
              ) : (
                logs.map((log) => (
                  <motion.div 
                    key={log.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="px-6 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${log.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                        {log.type === 'success' ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          {log.type === 'success' ? `Usuário ${log.user} identificado` : 'Usuário não reconhecido'}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">
                          {log.type === 'success' ? 'Acesso Liberado' : 'Não encontrado na base'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs font-mono">{log.time}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
