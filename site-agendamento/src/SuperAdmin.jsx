import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, query, where, 
  doc, updateDoc, setDoc, getDoc 
} from 'firebase/firestore';
import { CheckCircle, ShieldAlert, User, Smartphone, FileText, ExternalLink } from 'lucide-react'; // Ajustado para ExternalLink
import { toast, Toaster } from 'react-hot-toast';

const SuperAdmin = () => {
  const [solicitacoes, setSolicitacoes] = useState([]);

  useEffect(() => {
    // Monitora usuários que estão com status pendente (aguardando aprovação)
    const q = query(collection(db, "usuarios_barbeiros"), where("status", "==", "pendente"));
    const unsub = onSnapshot(q, (snap) => {
      setSolicitacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const aprovarProfissional = async (dados) => {
    const idUsuario = dados.id;

    try {
      // 1. Criar a coleção 'empresas' para este usuário
      await setDoc(doc(db, "empresas", idUsuario), {
        nomeLoja: dados.nomeLoja || "Nova Loja",
        whatsapp: dados.whatsapp || "",
        slug: dados.slug,
        corPrincipal: dados.corPrincipal || "#6366f1",
        logoUrl: dados.logoUrl || "",
        status: 'ativo',
        donoUid: idUsuario,
        dataAprovacao: new Date().toISOString()
      });

      // 2. Atualizar o status dele para 'ativo' na coleção de acesso
      await updateDoc(doc(db, "usuarios_barbeiros", idUsuario), {
        status: 'ativo'
      });

      toast.success(`${dados.nomeLoja} agora está ONLINE!`, {
        style: { background: '#111', color: '#fff', border: '1px solid #222' }
      });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao ativar empresa.");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 font-sans">
      <Toaster position="top-center" />
      
      <header className="max-w-4xl mx-auto mb-12 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-500/20">
            <ShieldAlert size={28} />
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">Nex <span className="text-indigo-500">Master</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Controle de Licenças</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-4">
        <h2 className="text-[10px] font-black uppercase text-slate-600 mb-6 tracking-widest text-left ml-2">Solicitações de Acesso (CPF)</h2>
        
        {solicitacoes.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[40px]">
            <p className="text-slate-700 font-black uppercase text-xs">Nenhum profissional aguardando</p>
          </div>
        ) : (
          solicitacoes.map(sol => (
            <div key={sol.id} className="bg-[#0A0A0A] border border-white/5 p-8 rounded-[40px] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all hover:border-indigo-500/20">
              
              <div className="text-left space-y-2">
                <div className="flex items-center gap-2">
                   <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                   <h3 className="font-black italic uppercase text-lg text-white">{sol.nomeLoja}</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase">
                    <User size={12} className="text-indigo-500" /> ID: {sol.id.slice(0,8)}...
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase">
                    <Smartphone size={12} className="text-indigo-500" /> {sol.whatsapp}
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase">
                    <FileText size={12} className="text-indigo-500" /> Slug: /{sol.slug}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => aprovarProfissional(sol)}
                className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 active:scale-95 transition-all"
              >
                <CheckCircle size={18} /> Liberar Acesso
              </button>
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default SuperAdmin;