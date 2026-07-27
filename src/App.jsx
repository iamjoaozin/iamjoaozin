import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Clock3, LogOut, ShieldCheck } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { isSuperAdmin } from './admins';
import { auth, db } from './firebase';

import Admin from './Admin';
import CadastroBarbeiro from './CadastroBarbeiro';
import Cliente from './Cliente';
import LoginCliente from './LoginCliente';
import SuperAdmin from './SuperAdmin';
import PainelProfissional from './PainelProfissional';
import InstallAppButton from './InstallAppButton';

const TopInstallBanner = () => (
  <div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between gap-3 bg-slate-950 px-4 py-2 sm:px-6">
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-lg shrink-0">📲</span>
      <p className="text-[11px] font-black uppercase tracking-widest text-white truncate">
        Baixe o app grátis
      </p>
      <p className="hidden sm:block text-[10px] text-slate-400 font-bold">· acesso rápido e notificações</p>
    </div>
    <InstallAppButton variant="banner" />
  </div>
);

const LoadingScreen = () => (
  <div className="min-h-screen bg-[#f7f8fb] flex flex-col items-center justify-center text-slate-950">
    <div className="h-10 w-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-4" />
    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">AgendaLink</p>
  </div>
);

const ApprovalPending = ({ user, perfil, onLogout }) => {
  const link = perfil?.slug || perfil?.lojaId || user?.uid;

  return (
    <div className="min-h-screen bg-[#f7f8fb] px-4 py-6 text-slate-950 font-sans">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-xl shadow-slate-300">
              <ShieldCheck size={21} />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight">AgendaLink</p>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Validação de conta</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500 shadow-sm transition-all hover:text-red-500 active:scale-95"
          >
            <LogOut size={15} />
            Sair
          </button>
        </header>

        <main className="grid flex-1 place-items-center rounded-[36px] border border-slate-200 bg-white p-6 text-center shadow-[0_25px_70px_rgba(15,23,42,0.08)]">
          <div className="max-w-lg">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[28px] bg-amber-50 text-amber-600 ring-8 ring-amber-50/70">
              <Clock3 size={38} />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-amber-600">Em análise</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Seu painel está quase pronto.</h1>
            <p className="mt-5 text-sm font-medium leading-7 text-slate-500">
              Seu cadastro foi recebido e precisa da aprovação manual do administrador. Depois da liberação, você entra direto no painel para configurar agenda, serviços e horários.
            </p>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Link reservado</p>
              <p className="mt-2 truncate text-sm font-black text-slate-900">/{link}</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usuarioFirebase) => {
      setCarregando(true);

      if (!usuarioFirebase) {
        setUser(null);
        setPerfil(null);
        setCarregando(false);
        return;
      }

      setUser(usuarioFirebase);

      try {
        const docRef = doc(db, 'usuarios_barbeiros', usuarioFirebase.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setPerfil({ tipo: 'barbeiro', ...docSnap.data() });
        } else {
          // Check if this user is a professional in any store
          const qProf = query(collection(db, 'profissionais'), where('emailVinculado', '==', usuarioFirebase.email));
          const querySnap = await getDocs(qProf);
          
          if (!querySnap.empty) {
            const data = querySnap.docs[0].data();
            setPerfil({ tipo: 'profissional', status: 'ativo', ...data, id: querySnap.docs[0].id });
          } else {
            setPerfil({ tipo: 'cliente' });
          }
        }
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        setPerfil({ tipo: 'cliente' });
      } finally {
        setCarregando(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/';
  };

  const getAdminPath = () => {
    const lojaId = perfil?.slug || perfil?.lojaId || user?.uid;
    return `/admin/${lojaId}`;
  };

  const getHomeElement = () => {
    if (!user) return <LoginCliente aoLogar={setUser} />;
    if (isSuperAdmin(user)) return <Navigate to="/master-painel-secreto" replace />;
    if (perfil?.tipo === 'barbeiro' && perfil?.status === 'ativo') return <Navigate to={getAdminPath()} replace />;
    if (perfil?.tipo === 'barbeiro' && perfil?.status === 'pendente') {
      return <ApprovalPending user={user} perfil={perfil} onLogout={handleLogout} />;
    }
    if (perfil?.tipo === 'profissional') {
      return <Navigate to={`/painel-profissional/${perfil.lojaId}`} replace />;
    }

    return <Navigate to="/onboarding" replace />;
  };

  if (carregando) return <LoadingScreen />;

  return (
    <Router>
      <TopInstallBanner />
      <div className="pt-10">
      <Toaster position="top-center" />
      <Routes>
        <Route path="/" element={getHomeElement()} />

        <Route
          path="/onboarding"
          element={
            user && perfil?.tipo === 'cliente' ? (
              <CadastroBarbeiro user={user} onFinalizar={() => window.location.href = '/'} />
            ) : perfil?.status === 'pendente' ? (
              <ApprovalPending user={user} perfil={perfil} onLogout={handleLogout} />
            ) : user && perfil?.status === 'ativo' ? (
              <Navigate to={getAdminPath()} replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route path="/admin/:lojaId" element={
          user && perfil?.tipo === 'barbeiro' && perfil?.status === 'ativo' ? (
            <Admin user={user} onSair={handleLogout} />
          ) : (
            <Navigate to="/" replace />
          )
        } />

        <Route path="/painel-profissional/:lojaId" element={
          user && perfil?.tipo === 'profissional' ? (
            <PainelProfissional user={user} onSair={handleLogout} />
          ) : (
            <Navigate to="/" replace />
          )
        } />

        <Route path="/master-painel-secreto" element={
          isSuperAdmin(user) ? <SuperAdmin user={user} onSair={handleLogout} /> : <Navigate to="/" replace />
        } />

        <Route path="/:lojaId" element={<Cliente user={user} onLogout={handleLogout} />} />
      </Routes>
      </div>
    </Router>
  );
}

export default App;
