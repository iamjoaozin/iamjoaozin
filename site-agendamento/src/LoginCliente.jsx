import React from 'react';
import { motion } from 'framer-motion';
import { Scissors, LayoutDashboard } from 'lucide-react';
import { entrarComGoogle } from './firebase';

const LoginCliente = ({ aoLogar }) => {
  
  const handleGoogle = async () => {
    try {
      // Faz o login social
      const usuario = await entrarComGoogle();
      
      if (usuario) {
        // Envia o usuário para o App.jsx, que vai decidir:
        // Se vai para /admin, /onboarding ou /master
        aoLogar(usuario);
      }
    } catch (error) {
      console.error("Falha no login:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-white font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="w-full max-w-sm text-center"
      >
        {/* LOGO PREMIUM */}
        <div className="mb-12">
          <motion.div 
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            className="w-20 h-20 bg-indigo-600 rounded-[30px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-500/30"
          >
            <Scissors size={40} className="text-white" />
          </motion.div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
            Nex <span className="text-indigo-500">Barber</span>
          </h1>
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em] mt-3 opacity-60">
            Professional Platform
          </p>
        </div>

        <div className="space-y-4">
          {/* BOTÃO ÚNICO DE ACESSO */}
          <button 
            onClick={handleGoogle} 
            className="w-full bg-white text-black py-6 rounded-[28px] font-black flex items-center justify-center gap-3 hover:bg-slate-200 transition-all shadow-xl active:scale-95 group"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            <span className="text-xs tracking-widest">ENTRAR COM GOOGLE</span>
          </button>

          <div className="flex items-center gap-4 py-6">
            <div className="h-[1px] bg-white/5 flex-1"></div>
            <span className="text-slate-700 text-[8px] font-black uppercase tracking-widest italic">Acesso Restrito</span>
            <div className="h-[1px] bg-white/5 flex-1"></div>
          </div>

          {/* BOTÃO PARA PROFISSIONAIS (USA O MESMO LOGIN) */}
          <button 
            onClick={handleGoogle} 
            className="w-full bg-[#0A0A0A] border border-white/5 py-5 rounded-[28px] font-bold text-slate-400 hover:text-white hover:border-indigo-500/50 transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            <LayoutDashboard size={18} className="text-indigo-500" /> 
            <span className="text-[10px] uppercase tracking-widest font-black">Área do Profissional</span>
          </button>
        </div>

        <p className="mt-12 text-slate-700 text-[9px] font-bold uppercase tracking-widest leading-relaxed">
          Agende serviços em segundos <br /> ou gerencie seu próprio negócio.
        </p>
      </motion.div>
    </div>
  );
};

export default LoginCliente;