import React from 'react';
import { ShieldCheck, UserPlus, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();
  
  const navItems = [
    { id: 'recognize', path: '/recognize', label: 'Reconhecer', icon: ShieldCheck },
    { id: 'register', path: '/register', label: 'Cadastrar', icon: UserPlus },
    { id: 'admin', path: '/admin', label: 'Painel Admin', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 lg:top-0 lg:bottom-auto bg-white/80 backdrop-blur-md border-t lg:border-t-0 lg:border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 lg:h-20">
          <Link to="/" className="hidden lg:flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
            <span className="font-bold text-xl tracking-tight text-gray-900">FaceAuth ID</span>
          </Link>
          
          <div className="flex flex-1 lg:flex-none justify-around lg:justify-end gap-1 sm:gap-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`flex flex-col lg:flex-row items-center gap-1 sm:gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                    isActive 
                      ? 'text-indigo-600 bg-indigo-50 lg:bg-indigo-600 lg:text-white shadow-sm scale-105' 
                      : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] sm:text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
