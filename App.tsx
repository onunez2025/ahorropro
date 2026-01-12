import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import StatsPanel from './components/StatsPanel';
import GridSystem from './components/GridSystem';
import Collaborators from './components/Collaborators';
import WithdrawalManager from './components/WithdrawalManager';
import AICoach from './components/AICoach';
import { generateSavingGrid } from './utils/algorithm';
import { User, Challenge, Withdrawal } from './types';
import { LEVELS, getUserAvatar } from './constants';
import { db, firebaseReady } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc
} from "firebase/firestore";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [view, setView] = useState<'AUTH' | 'LIST' | 'CHALLENGE'>('AUTH');
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<{cellId: number} | null>(null);

  useEffect(() => {
    if (!firebaseReady) return;
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const usersList = snap.docs.map(d => d.data() as User);
      setAllUsers(usersList);
      const savedId = localStorage.getItem('ahorropro_current_user_id');
      if (savedId && !currentUser) {
        const found = usersList.find(u => u.id === savedId);
        if (found) { setCurrentUser(found); setView('LIST'); }
      }
    });
    const unsubChs = onSnapshot(collection(db, "challenges"), (snap) => {
      setChallenges(snap.docs.map(d => d.data() as Challenge));
    });
    return () => { unsubUsers(); unsubChs(); };
  }, []);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = (data.get('userName') as string).trim();
    const password = data.get('password') as string;
    if (authMode === 'LOGIN') {
      const user = allUsers.find(u => u.name.toLowerCase() === name.toLowerCase() && u.password === password);
      if (user) {
        localStorage.setItem('ahorropro_current_user_id', user.id);
        setCurrentUser(user);
        setView('LIST');
      } else { alert("Credenciales incorrectas."); }
    } else {
      if (allUsers.some(u => u.name.toLowerCase() === name.toLowerCase())) return alert("Este apodo ya existe.");
      const newUser: User = {
        id: 'u_' + Date.now(),
        name: name,
        password: password,
        avatar: Math.random().toString(36).substring(7),
        activeSkin: 'avataaars',
        unlockedSkins: ['avataaars'],
        xp: 0,
        level: 1
      };
      await setDoc(doc(db, "users", newUser.id), newUser);
      localStorage.setItem('ahorropro_current_user_id', newUser.id);
      setCurrentUser(newUser);
      setView('LIST');
    }
  };

  const handleCreateChallenge = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const target = Number(d.get('target'));
    const days = Number(d.get('days'));

    if (target % 10 !== 0) return alert("La meta total debe ser múltiplo de 10.");
    if (days < 365) return alert("El plazo mínimo es de 365 días.");
    if (target < days * 10) return alert(`La meta mínima para ${days} días es S/ ${days * 10}.`);

    const newCh: Challenge = {
      id: Math.random().toString(36).substr(2, 6).toUpperCase(),
      name: d.get('name') as string,
      targetAmount: target,
      days: days,
      createdAt: new Date().toISOString(),
      cells: generateSavingGrid(target, days),
      participants: [currentUser!.id],
      streak: 0
    };
    await setDoc(doc(db, "challenges", newCh.id), newCh);
    setIsCreateModalOpen(false);
    setSelectedChallengeId(newCh.id);
    setView('CHALLENGE');
  };

  const handleMarkCell = async (receiptUrl?: string) => {
    if (!currentUser || !selectedChallengeId || !isReceiptModalOpen) return;
    const challenge = challenges.find(c => c.id === selectedChallengeId);
    if (!challenge) return;

    const cellId = isReceiptModalOpen.cellId;
    const updatedCells = challenge.cells.map(cell => {
      if (cell.id === cellId) {
        return { 
          ...cell, 
          isPaid: true, 
          paidBy: currentUser.id, 
          paidAt: new Date().toISOString(),
          receiptUrl: receiptUrl || null
        };
      }
      return cell;
    });

    const cellAmount = challenge.cells.find(c => c.id === cellId)?.amount || 0;
    const newXp = (currentUser.xp || 0) + cellAmount;
    let newLevel = 1;
    for (const lvl of LEVELS) { if (newXp >= lvl.xpRequired) newLevel = lvl.level; else break; }

    await updateDoc(doc(db, "challenges", challenge.id), { cells: updatedCells, streak: (challenge.streak || 0) + 1 });
    await updateDoc(doc(db, "users", currentUser.id), { xp: newXp, level: newLevel });
    setIsReceiptModalOpen(null);
  };

  return (
    <Layout currentUser={currentUser ? { ...currentUser, avatar: getUserAvatar(currentUser) } : null} onLogout={() => {
      localStorage.removeItem('ahorropro_current_user_id');
      setCurrentUser(null);
      setView('AUTH');
    }}>
      {view === 'AUTH' && (
        <div className="max-w-md mx-auto py-20 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-700 rounded-[2.5rem] mx-auto flex items-center justify-center text-5xl mb-8 shadow-2xl rotate-3">🐷</div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter mb-2 text-white">Ahorro<span className="text-green-500">Pro</span></h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em] mb-12">Alcancía Familiar 🇵🇪</p>
          <div className="bg-slate-900/80 border border-slate-800 p-10 rounded-[4rem] shadow-2xl backdrop-blur-xl">
            <div className="flex bg-slate-950 p-1.5 rounded-3xl mb-10 border border-slate-800">
              <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest ${authMode === 'LOGIN' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Entrar</button>
              <button onClick={() => setAuthMode('REGISTER')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest ${authMode === 'REGISTER' ? 'bg-green-600 text-slate-950' : 'text-slate-500'}`}>Unirse</button>
            </div>
            <form onSubmit={handleAuth} className="space-y-5">
              <input name="userName" required placeholder="Tu apodo" className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-8 py-5 font-bold outline-none text-white focus:border-green-500" />
              <input name="password" type="password" required placeholder="Contraseña" className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-8 py-5 font-bold outline-none text-white focus:border-green-500" />
              <button type="submit" className="w-full bg-green-600 text-slate-950 py-6 rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl mt-4">{authMode === 'LOGIN' ? 'Ingresar' : 'Crear Cuenta'}</button>
            </form>
          </div>
        </div>
      )}

      {view === 'LIST' && (
        <div className="space-y-12 animate-in fade-in duration-500">
           <header className="flex flex-col md:flex-row justify-between items-end gap-6">
              <div><h2 className="text-5xl font-black italic uppercase tracking-tighter text-white">Mis <span className="text-green-500">Retos</span></h2><p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">Colaborando en tus alcancías digitales</p></div>
              <div className="flex gap-4">
                <button onClick={() => setIsJoinModalOpen(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase">Unirse</button>
                <button onClick={() => setIsCreateModalOpen(true)} className="bg-green-600 hover:bg-green-500 text-slate-950 px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl">+ Nuevo Proyecto</button>
              </div>
           </header>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {challenges.filter(c => currentUser && c.participants.includes(currentUser.id)).map(ch => (
                <div key={ch.id} onClick={() => { setSelectedChallengeId(ch.id); setView('CHALLENGE'); }} className="bg-slate-900/60 border border-slate-800 p-10 rounded-[3.5rem] hover:border-green-500/40 cursor-pointer transition-all group shadow-2xl">
                   <div className="w-16 h-16 bg-slate-800 rounded-2xl mb-8 flex items-center justify-center text-3xl group-hover:bg-green-500 transition-all">🏺</div>
                   <h3 className="text-3xl font-black uppercase italic mb-3 text-white">{ch.name}</h3>
                   <span className="bg-slate-950 px-3 py-1 rounded-lg text-[10px] font-mono text-green-400 border border-slate-800">ID: {ch.id}</span>
                </div>
              ))}
           </div>
        </div>
      )}

      {view === 'CHALLENGE' && selectedChallengeId && (
        <div className="animate-in slide-in-from-right-8 duration-500">
          {(() => {
            const ch = challenges.find(c => c.id === selectedChallengeId);
            if (!ch) return null;
            return (
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-8">
                  <header className="flex justify-between items-center bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-800">
                    <button onClick={() => setView('LIST')} className="bg-slate-800 hover:bg-slate-700 p-4 rounded-2xl text-slate-400 hover:text-white transition-all text-xs font-bold uppercase px-6">← Volver</button>
                    <h2 className="text-2xl font-black italic uppercase text-white">{ch.name}</h2>
                    <div className="bg-slate-950 px-5 py-2.5 rounded-2xl border border-slate-800 text-[10px] font-black text-green-400">ID: {ch.id}</div>
                  </header>
                  <StatsPanel user={currentUser!} challenge={ch} />
                  <GridSystem cells={ch.cells} onMark={(id) => setIsReceiptModalOpen({cellId: id})} currentUser={currentUser!} allUsers={allUsers} />
                </div>
                <aside className="w-full lg:w-96 shrink-0 space-y-8">
                  <AICoach challenge={ch} user={currentUser!} />
                  <Collaborators challenge={ch} users={allUsers} />
                  <WithdrawalManager challenge={ch} users={allUsers} onAddWithdrawal={async (w) => {
                    const newW: Withdrawal = { ...w, id: Date.now().toString(), withdrawnAt: new Date().toISOString(), withdrawnBy: currentUser!.id };
                    await updateDoc(doc(db, "challenges", ch.id), { withdrawals: [...(ch.withdrawals || []), newW] });
                  }} />
                </aside>
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal Crear */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <form onSubmit={handleCreateChallenge} className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 max-w-lg w-full space-y-6">
            <h2 className="text-3xl font-black italic uppercase text-white">Configurar Reto</h2>
            <div className="space-y-4">
              <input name="name" required placeholder="Nombre (ej. Mi Casa Propia)" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 outline-none text-white focus:border-green-500" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Meta Total (S/)</label>
                  <input name="target" type="number" step="10" defaultValue={5000} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 outline-none text-white focus:border-green-500" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Días (Min 365)</label>
                  <input name="days" type="number" defaultValue={365} min="365" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 outline-none text-white focus:border-green-500" />
                </div>
              </div>
              <p className="text-[9px] text-slate-500 font-bold uppercase italic">La cuadrícula se generará con billetes de 10, 20, 50, 100 y 200.</p>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl font-black text-xs uppercase text-white">Cerrar</button>
              <button type="submit" className="flex-1 bg-green-600 text-slate-950 py-4 rounded-2xl font-black text-xs uppercase shadow-xl">Crear Alcancía</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Unirse */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 max-w-sm w-full space-y-6">
            <h2 className="text-3xl font-black italic uppercase text-white">Ingresar Código</h2>
            <input id="joinId" placeholder="ID DEL RETO" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 outline-none text-white focus:border-green-500 uppercase font-mono text-center text-xl" />
            <div className="flex gap-4">
              <button onClick={() => setIsJoinModalOpen(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl font-black text-xs uppercase text-white">Cerrar</button>
              <button onClick={async () => {
                const id = (document.getElementById('joinId') as HTMLInputElement).value.toUpperCase();
                const ch = challenges.find(c => c.id === id);
                if (ch && currentUser) {
                  const updatedParts = [...new Set([...ch.participants, currentUser.id])];
                  await updateDoc(doc(db, "challenges", ch.id), { participants: updatedParts });
                  setSelectedChallengeId(ch.id); setView('CHALLENGE'); setIsJoinModalOpen(false);
                } else { alert("Código no encontrado."); }
              }} className="flex-1 bg-green-600 text-slate-950 py-4 rounded-2xl font-black text-xs uppercase">Unirse</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Comprobante (Carga) */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-[500] flex items-center justify-center p-4">
          <div className="bg-slate-900 p-10 rounded-[3rem] border-2 border-green-500/30 max-w-sm w-full space-y-8 text-center">
            <div className="text-5xl">📸</div>
            <h3 className="text-2xl font-black italic uppercase text-white">Ahorro de S/ {challenges.find(c => c.id === selectedChallengeId)?.cells.find(c => c.id === isReceiptModalOpen.cellId)?.amount}</h3>
            <p className="text-xs text-slate-400 font-medium">¿Quieres adjuntar una foto de tu comprobante de Yape/Plin o depósito?</p>
            <div className="space-y-4">
              <button onClick={() => handleMarkCell()} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Marcar sin foto</button>
              <button onClick={() => {
                const url = prompt("Ingresa la URL de la imagen del comprobante (Simulación):");
                if(url) handleMarkCell(url);
              }} className="w-full bg-green-600 text-slate-950 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Subir Comprobante</button>
              <button onClick={() => setIsReceiptModalOpen(null)} className="w-full text-slate-600 font-black text-[10px] uppercase hover:text-red-400">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
