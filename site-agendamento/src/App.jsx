import React, { useState } from 'react';
import Admin from './Admin';
import Cliente from './Cliente';

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [senha, setSenha] = useState('');
  const [mostrarLogin, setMostrarLogin] = useState(false);

  const SENHA_MESTRE = "1234"; 

  const verificarSenha = () => {
    if (senha === SENHA_MESTRE) {
      setIsAdmin(true);
      setMostrarLogin(false);
    } else {
      alert("Senha incorreta!");
    }
  };

  if (isAdmin) {
    return (
      <>
        <Admin />
        <button onClick={() => setIsAdmin(false)} className="fixed bottom-4 left-4 bg-red-600 text-white text-[10px] font-bold p-2 rounded-lg z-[1000]">SAIR</button>
      </>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setMostrarLogin(true)} className="fixed bottom-2 right-2 opacity-10 text-[8px] text-white z-50">ADMIN</button>

      {mostrarLogin && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-[#111] p-8 rounded-[32px] w-full max-w-sm border border-white/10">
            <h2 className="text-xl font-black mb-6 text-center italic">ACESSO BARBEIRO</h2>
            <input type="password" placeholder="Senha" className="w-full p-4 bg-white/5 rounded-2xl mb-4 text-center border border-white/10" value={senha} onChange={(e)=>setSenha(e.target.value)} />
            <button onClick={verificarSenha} className="w-full bg-indigo-600 p-4 rounded-2xl font-black italic">ENTRAR</button>
            <button onClick={()=>setMostrarLogin(false)} className="w-full p-4 text-slate-500 text-xs">CANCELAR</button>
          </div>
        </div>
      )}

      <Cliente />
    </div>
  );
}

export default App;