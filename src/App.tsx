import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Register from './components/Register';
import Recognize from './components/Recognize';
import Admin from './components/Admin';
import Footer from './components/Footer';
import { motion, AnimatePresence } from 'motion/react';

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.25, ease: 'easeInOut' }}
  >
    {children}
  </motion.div>
);

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 pb-24 lg:pb-0 lg:pt-20 flex flex-col">
        <Navbar />
        
        <main className="container mx-auto px-4 py-8 flex-grow">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Navigate to="/recognize" replace />} />
              <Route path="/recognize" element={<PageWrapper><Recognize /></PageWrapper>} />
              <Route path="/register" element={<PageWrapper><Register /></PageWrapper>} />
              <Route path="/admin" element={<PageWrapper><Admin /></PageWrapper>} />
              {/* Opção para rota secreta caso o usuário queira esconder o admin futuramente */}
              <Route path="/painel-controle" element={<Navigate to="/admin" replace />} />
            </Routes>
          </AnimatePresence>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
}
