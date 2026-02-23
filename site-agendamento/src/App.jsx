import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Toaster, toast } from 'react-hot-toast';

// Componentes
import Admin from './Admin';
import Cliente from './Cliente';
import LoginCliente from './LoginCliente';
import CadastroBarbeiro from './CadastroBarbeiro';
import SuperAdmin from './SuperAdmin';

function App() {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // SEU E-MAIL DE ADMINISTRADOR MASTER
  const EMAIL_MASTER = "j33061393@gmail.com";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usuarioFirebase) => {
      if (usuarioFirebase) {
        setUser(usuarioFirebase);
        
        // Busca o perfil na coleção de controle de acesso
        const docRef = doc(db, "usuarios_barbeiros", usuarioFirebase.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const dados = docSnap.data();
          setPerfil({ tipo: 'barbeiro', ...dados });
        } else {
          setPerfil({ tipo: 'cliente' });
        }
      } else {
        setUser(null);
        setPerfil(null);
      }
      setCarregando(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/";
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-indigo-500">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-black italic uppercase text-[10px] tracking-widest">Nex Barber</p>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-center" />
      <Routes>
        
        {/* 1. ROTA INICIAL / DECISÃO */}
        <Route path="/" element={
          !user ? (
            <LoginCliente aoLogar={(u) => setUser(u)} />
          ) : (
            // Se for o Master, botão para ir ao painel secreto
            user.email === EMAIL_MASTER ? <Navigate to="/master-painel-secreto" /> :
            // Se for barbeiro ativo, vai pro admin dele
            perfil?.tipo === 'barbeiro' && perfil?.status === 'ativo' 
              ? <Navigate to={`/admin/${perfil.slug}`} /> 
              : perfil?.status === 'pendente' 
                ? <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
                    <p className="text-amber-500 font-black uppercase italic text-sm">Sua conta está em análise pelo Admin Master! ⏳</p>
                  </div>
                : <div className="min-h-screen bg-black flex items-center justify-center text-center p-6 text-white">
                    <div>
                      <h2 className="text-2xl font-black italic uppercase mb-2">Nex Barber</h2>
                      <p className="text-slate-500 text-[10px] font-bold uppercase mb-8">Escolha seu caminho</p>
                      <button onClick={() => window.location.href = '/onboarding'} className="w-full bg-indigo-600 p-6 rounded-3xl font-black uppercase italic text-xs shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">Abrir minha Própria Loja</button>
                      <p className="mt-6 text-[9px] text-slate-700 font-bold uppercase">Ou acesse o link de uma barbearia para agendar.</p>
                    </div>
                  </div>
          )
        } />

        {/* 2. ROTA DE CADASTRO (ONBOARDING) */}
        <Route path="/onboarding" element={
          user && perfil?.tipo === 'cliente' ? (
            <CadastroBarbeiro user={user} onFinalizar={() => window.location.reload()} />
          ) : <Navigate to="/" />
        } />

        {/* 3. ROTA DO CLIENTE (DINÂMICA) */}
        <Route path="/:lojaId" element={<Cliente user={user} onLogout={handleLogout} />} />

        {/* 4. ROTA DO ADMIN (PROTEGIDA POR STATUS) */}
        <Route path="/admin/:lojaId" element={
          user && perfil?.tipo === 'barbeiro' && perfil?.status === 'ativo' ? (
            <Admin user={user} onSair={handleLogout} />
          ) : <Navigate to="/" />
        } />

        {/* 5. ROTA MASTER (PROTEGIDA POR E-MAIL) */}
        <Route path="/master-painel-secreto" element={
          user?.email === EMAIL_MASTER ? (
            <SuperAdmin />
          ) : <Navigate to="/" />
        } />

      </Routes>
    </Router>
  );
}

export default App;