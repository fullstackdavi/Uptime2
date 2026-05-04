import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, UserPlus, CheckCircle2, RotateCw, AlertCircle } from 'lucide-react';
import { loadModels, registerUser } from '../services/faceService';
import { motion, AnimatePresence } from 'motion/react';

export default function Register() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error', text: string } | null>(null);
  const [userData, setUserData] = useState({ name: '', phone: '' });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isFaceDetected, setIsFaceDetected] = useState(false);

  useEffect(() => {
    let tid: any;
    const runTracking = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2 && canvasRef.current && !capturing) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

          try {
            // Tentativa 1: SSD (Mais sensível)
            let detection = await faceapi.detectSingleFace(
              video,
              new faceapi.SsdMobilenetv1Options({ minConfidence: 0.25 })
            ).withFaceLandmarks();

            // Tentativa 2: Tiny (Fallback ultra sensível)
            if (!detection) {
              detection = await faceapi.detectSingleFace(
                video,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.1 })
              ).withFaceLandmarks();
            }

            setIsFaceDetected(!!detection);

          const ctx = canvas.getContext('2d');
          if (ctx && !capturing) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (detection) {
              const resized = faceapi.resizeResults(detection, displaySize);
              const { box } = resized.detection;
              const landmarks = resized.landmarks;
            
              // Positioning feedback (Guia de Pose para Registro)
              const videoHeight = video.videoHeight;
              const videoWidth = video.videoWidth;
              const faceCenterX = box.x + box.width / 2;
              
              const isTooFar = box.height < videoHeight * 0.18;
              const isTooClose = box.height > videoHeight * 0.85;
              const isOffCenter = Math.abs(faceCenterX - videoWidth / 2) > videoWidth * 0.25;
              
              const leftEye = landmarks.getLeftEye();
              const rightEye = landmarks.getRightEye();
              const eyeDiff = Math.abs(leftEye[0].y - rightEye[0].y);
              const isAligned = eyeDiff < box.height * 0.15;

              const isPositionValid = !isTooFar && !isTooClose && !isOffCenter && isAligned;
              const color = isPositionValid ? '#22c55e' : '#f59e0b';

              // "Target Locked" feel
              ctx.strokeStyle = '#4f46e5';
              ctx.lineWidth = 2;
              ctx.setLineDash([5, 5]);
              ctx.strokeRect(box.x - 10, box.y - 10, box.width + 20, box.height + 20);
              ctx.setLineDash([]);
              
              // Heavy Corners
              ctx.strokeStyle = color;
              ctx.lineWidth = 6;
              ctx.lineCap = 'round';
              const len = 40;
              ctx.beginPath();
              ctx.moveTo(box.x, box.y + len); ctx.lineTo(box.x, box.y); ctx.lineTo(box.x + len, box.y);
              ctx.moveTo(box.right - len, box.y); ctx.lineTo(box.right, box.y); ctx.lineTo(box.right, box.y + len);
              ctx.moveTo(box.x, box.bottom - len); ctx.lineTo(box.x, box.bottom); ctx.lineTo(box.x + len, box.bottom);
              ctx.moveTo(box.right - len, box.bottom); ctx.lineTo(box.right, box.bottom); ctx.lineTo(box.right, box.bottom - len);
              ctx.stroke();

              // Reticle
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(box.x + box.width / 2 - 20, box.y + box.height / 2);
              ctx.lineTo(box.x + box.width / 2 + 20, box.y + box.height / 2);
              ctx.moveTo(box.x + box.width / 2, box.y + box.height / 2 - 20);
              ctx.lineTo(box.x + box.width / 2, box.y + box.height / 2 + 20);
              ctx.stroke();
              
              ctx.fillStyle = 'rgba(79, 70, 229, 0.1)';
              ctx.fillRect(box.x, box.y, box.width, box.height);
            
              if (!isPositionValid) {
                ctx.fillStyle = '#ef4444';
                ctx.font = 'bold 16px Inter';
                ctx.textAlign = 'center';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;
                
                if (isTooFar) ctx.fillText('APROXIME-SE MAIS', videoWidth / 2, videoHeight - 30);
                else if (isTooClose) ctx.fillText('AFASTE O ROSTO', videoWidth / 2, videoHeight - 30);
                else if (isOffCenter) ctx.fillText('CENTRALIZE O ROSTO', videoWidth / 2, videoHeight - 30);
                else if (!isAligned) ctx.fillText('MANTENHA A CABEÇA RETA', videoWidth / 2, videoHeight - 30);
                
                ctx.shadowBlur = 0;
              } else {
                ctx.fillStyle = '#22c55e';
                ctx.font = 'bold 16px Inter';
                ctx.textAlign = 'center';
                ctx.fillText('POSIÇÃO ÓTIMA', videoWidth / 2, videoHeight - 30);
              }
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    tid = setTimeout(runTracking, 150);
  };

    if (stream) {
      runTracking();
    }
    return () => clearTimeout(tid);
  }, [stream, capturing]);

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
      setMessage(null);
    } catch (err: any) {
      console.error(err);
      let errorMsg = 'Erro ao acessar câmera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message.includes('denied')) {
        errorMsg = 'Permissão de câmera negada. Clique no ícone de cadeado na barra de endereços para permitir o acesso.';
      }
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  useEffect(() => {
    async function init() {
      try {
        await loadModels();
        setLoading(false);
        // Don't auto-start camera if it might cause issues, let the user click or try once
        await startCamera();
      } catch (err) {
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

  const handleCapture = async () => {
    if (!userData.name) {
      setMessage({ type: 'error', text: 'Por favor, insira o nome.' });
      return;
    }

    if (!videoRef.current || videoRef.current.readyState < 2) {
      setMessage({ type: 'error', text: 'Câmera inicializando... Aguarde um instante.' });
      return;
    }

    setCapturing(true);
    setMessage({ type: 'info', text: 'Analisando biometria (mantenha o rosto parado)...' });

    try {
      // Small delay and check dimensions
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (!videoRef.current || videoRef.current.videoWidth === 0) {
        setMessage({ type: 'error', text: 'Câmera não enviou imagem. Ative a câmera primeiro.' });
        setCapturing(false);
        return;
      }

      // Layer 1: Best Accuracy for Registration (SSD)
      let detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.25 })
      ).withFaceLandmarks().withFaceDescriptor();

      // Layer 2: Sensitivity Fallback (Tiny)
      if (!detection) {
        detection = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.1 })
        ).withFaceLandmarks().withFaceDescriptor();
      }

      if (!detection) {
        setMessage({ type: 'error', text: 'Nenhum rosto identificado. Tente se aproximar mais ou olhar diretamente para a lente.' });
      } else {
        await registerUser(userData.name, userData.phone, detection.descriptor);
        setMessage({ type: 'success', text: `Usuário ${userData.name} cadastrado com sucesso!` });
        setUserData({ name: '', phone: '' });
      }
    } catch (err) {
      console.error('Registration error:', err);
      setMessage({ type: 'error', text: 'Erro ao processar imagem.' });
    } finally {
      setCapturing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
        <RotateCw className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-gray-500 font-medium italic">Carregando inteligência artificial...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100"
      >
        <div className="p-6 bg-indigo-600">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserPlus className="w-6 h-6" />
            Novo Cadastro Facial
          </h2>
          <p className="text-indigo-100 mt-1">Capture a biometria para identificação segura.</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo</label>
              <input
                type="text"
                value={userData.name}
                onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="Ex: João Silva"
                id="input-name"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Telefone (Opcional)</label>
              <input
                type="text"
                value={userData.phone}
                onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="(00) 00000-0000"
                id="input-phone"
              />
            </div>
          </div>

          <div className="relative group aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-inner ring-4 ring-gray-100 flex items-center justify-center">
            <div className="w-full h-full relative scale-x-[-1]">
              <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
              <canvas 
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
              />
            </div>
            {!stream && !loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-6 text-center">
                <button 
                  onClick={startCamera}
                  className="px-6 py-3 bg-white text-gray-900 font-bold rounded-xl shadow-lg hover:bg-gray-100 transition-all flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Ativar Câmera
                </button>
              </div>
            )}
            <div className="absolute inset-0 border-2 border-dashed border-white/30 rounded-2xl pointer-events-none" />
            
            <AnimatePresence>
              {isFaceDetected && !capturing && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute top-4 left-4 px-3 py-1 bg-green-500/80 backdrop-blur-md rounded-full text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2"
                >
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  Rosto Identificado
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {capturing && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-indigo-600/20 backdrop-blur-[2px] flex items-center justify-center"
                >
                  <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin shadow-lg" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-4 rounded-xl flex items-center gap-3 ${
                  message.type === 'success' ? 'bg-green-50 text-green-700' :
                  message.type === 'error' ? 'bg-red-50 text-red-700' :
                  'bg-indigo-50 text-indigo-700'
                }`}
                id="capture-msg"
              >
                {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : 
                 message.type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
                 <RotateCw className="w-5 h-5 animate-spin" />}
                <span className="text-sm font-medium">{message.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleCapture}
            disabled={capturing || !userData.name}
            className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
              capturing || !userData.name
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 shadow-xl'
            }`}
            id="register-btn"
          >
            <Camera className="w-6 h-6" />
            Capturar e Salvar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
