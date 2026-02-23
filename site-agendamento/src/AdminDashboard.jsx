import { useState } from 'react';
import { Users, DollarSign, Calendar, Star, CheckCircle, XCircle, Search } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  // Dados de exemplo para a tabela
  const agendamentos = [
    { id: 1, nome: "Carlos Silva", servico: "Combo NEX", data: "Hoje, 14:00", status: "Pago", valor: 65.0 },
    { id: 2, nome: "Rafael Souza", servico: "Corte Social", data: "Hoje, 15:30", status: "Pendente", valor: 40.0 },
    { id: 3, nome: "Lucas Mendes", servico: "Barba Terapia", data: "Amanhã, 09:00", status: "Pago", valor: 35.0 },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      
      {/* HEADER DO ADMIN */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter text-indigo-500">NEX ADMIN</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Centro de Comando</p>
        </div>
        <button className="bg-white/5 border border-white/10 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all">
          Sair
        </button>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-3 gap-6 mb-10">
        <div className="bg-white/5 border border-white/10 p-6 rounded-[30px] flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center text-green-500"><DollarSign size={24}/></div>
          <div><p className="text-[10px] font-black uppercase text-slate-500">Caixa Hoje</p><p className="text-2xl font-black italic">R$ 450,00</p></div>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-[30px] flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400"><Calendar size={24}/></div>
          <div><p className="text-[10px] font-black uppercase text-slate-500">Agendamentos</p><p className="text-2xl font-black italic">12 Pendentes</p></div>
        </div>
        <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 p-6 rounded-[30px] flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-300"><Star size={24}/></div>
          <div><p className="text-[10px] font-black uppercase text-indigo-300">Clube NEX</p><p className="text-2xl font-black italic">28 Ativos</p></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* TABELA DE AGENDAMENTOS (Ocupa 2/3 da tela) */}
        <div className="col-span-2 bg-white/5 border border-white/10 p-8 rounded-[40px]">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-black uppercase tracking-widest flex items-center gap-2"><Users size={18} className="text-indigo-400"/> Fila de Clientes</h2>
            <div className="bg-black/50 border border-white/10 rounded-full px-4 py-2 flex items-center gap-2">
              <Search size={14} className="text-slate-500" />
              <input type="text" placeholder="Buscar..." className="bg-transparent border-none outline-none text-xs text-white" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/10">
                  <th className="pb-4">Cliente</th>
                  <th className="pb-4">Serviço</th>
                  <th className="pb-4">Data/Hora</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {agendamentos.map((ag) => (
                  <tr key={ag.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                    <td className="py-4 font-bold text-sm">{ag.nome}</td>
                    <td className="py-4 text-xs text-slate-300">{ag.servico}</td>
                    <td className="py-4 text-xs font-mono">{ag.data}</td>
                    <td className="py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${ag.status === 'Pago' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                        {ag.status}
                      </span>
                    </td>
                    <td className="py-4 flex justify-end gap-2">
                      <button className="p-2 text-green-500 hover:bg-green-500/10 rounded-xl transition-all"><CheckCircle size={16}/></button>
                      <button className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><XCircle size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ÁREA DE ASSINATURAS VIP (Ocupa 1/3 da tela) */}
        <div className="col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border border-indigo-500/30 p-8 rounded-[40px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10"><Star size={100} /></div>
            <h2 className="text-2xl font-black italic tracking-tighter mb-2 text-indigo-300">CLUBE NEX VIP</h2>
            <p className="text-xs text-indigo-200/60 mb-8 font-bold">Gestão de assinaturas recorrentes.</p>
            
            <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]">
              + Novo Assinante
            </button>
            
            <div className="mt-6 space-y-3">
              <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm">Plano Ilimitado</p>
                  <p className="text-[9px] uppercase tracking-widest text-slate-500">R$ 150/mês • 18 ativos</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse"></div>
              </div>
              <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm">Combo Semanal</p>
                  <p className="text-[9px] uppercase tracking-widest text-slate-500">R$ 100/mês • 10 ativos</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}