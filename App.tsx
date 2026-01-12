
import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import StatsPanel from './components/StatsPanel';
import GridSystem from './components/GridSystem';
import Collaborators from './components/Collaborators';
import WithdrawalManager from './components/WithdrawalManager';
import { generateSavingGrid } from './utils/algorithm';
import { User, Challenge, Withdrawal } from './types';
import { LEVELS, SKINS, getAvatarUrl, getUserAvatar } from './constants';
import { sendWhatsAppMessage, formatAhorroMessage } from './utils/notifications';

// Firebase Imports
import { db, firebaseReady } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  
  const [view, setView] = useState<'AUTH' | 'LIST' | 'CHALLENGE' | 'PROFILE'>('AUTH');
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [isSyncing, setIsSyncing] = useState(false);
  const [firestoreError, setFirestoreError] = useState<{code: string, message: string} | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<{cellId: number} | null>(null);
  const [isShowQrModal, setIsShowQrModal] = useState<string | null>(null);
  
  // States for dynamic validation in Create Challenge Modal
  const [createDays, setCreateDays] = useState(365);
  const [createTarget, setCreateTarget] = useState(5000);
  const [createQrPreview, setCreateQrPreview] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseReady) return;
    setIsSyncing(true);
    
    const unsubUsers = onSnapshot(collection(db, "users"), 
      (snap) => {
        const usersList = snap.docs.map(d => d.data() as User);
        setAllUsers(usersList);
        setFirestoreError(null); 
        
        const savedId = localStorage.getItem('ahorropro_current_user_id');
        if (savedId && !currentUser) {
          const found = usersList.find(u => u.id === savedId);
          if (found) { 
            setCurrentUser(found); 
            if (view === 'AUTH') setView('LIST'); 
          }
        }
        setIsSyncing(false);
      }, 
      (err: any) => {
        setFirestoreError({ code: err.code, message: err.message });
        setIsSyncing(false);
      }
    );

    const unsubChs = onSnapshot(collection(db, "challenges"), (snap) => {
      setChallenges(snap.docs.map(d => d.data() as Challenge));
    }, (err: any) => {
      setFirestoreError({ code: err.code, message: err.message });
    });

    return () => { unsubUsers(); unsubChs(); };
  }, [view]);

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
      } else {
        alert("Credenciales incorrectas. Verifica tu apodo y contraseña.");
      }
    } else {
      if (allUsers.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        return alert("Este apodo ya existe. Por favor elige otro.");
      }
      const newUser: User = {
        id: 'u_' + Date.now(),
        name: name,
        password: password,
        avatar: previewAvatar || Math.random().toString(36).substring(7),
        activeSkin: previewAvatar ? 'custom' : 'avataaars',
        unlockedSkins: ['avataaars'],
        xp: 0,
        level: 1
      };
      try {
        await setDoc(doc(db, "users", newUser.id), newUser);
        localStorage.setItem('ahorropro_current_user_id', newUser.id);
        setCurrentUser(newUser);
        setView('LIST');
      } catch (err: any) {
        setFirestoreError({ code: err.code, message: err.message });
      }
    }
  };

  const handleCreateChallenge = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const target = Number(d.get('target'));
    const days = Number(d.get('days'));

    if (target < (days * 10)) {
      alert(`La meta mínima para ${days} días debe ser S/ ${days * 10}.`);
      return;
    }

    const newCh: Challenge = {
      id: Math.random().toString(36).substr(2, 6).toUpperCase(),
      name: d.get('name') as string,
      targetAmount: target,
      days: days,
      createdAt: new Date().toISOString(),
      cells: generateSavingGrid(target, days),
      participants: [currentUser!.id],
      streak: 0,
      paymentQr: createQrPreview || undefined
    };

    try {
      await setDoc(doc(db, "challenges", newCh.id), newCh);
      setIsCreateModalOpen(false);
      setCreateQrPreview(null);
      setSelectedChallengeId(newCh.id);
      setView('CHALLENGE');
    } catch (err: any) {
      setFirestoreError({ code: err.code, message: err.message });
    }
  };

  const handleMarkCell = async (cellId: number, receiptUrl?: string) => {
    if (!currentUser || !selectedChallengeId) return;
    const challenge = challenges.find(c => c.id === selectedChallengeId);
    if (!challenge) return;

    const updatedCells = challenge.cells.map(cell => {
      if (cell.id === cellId) {
        return { ...cell, isPaid: true, paidBy: currentUser.id, paidAt: new Date().toISOString(), receiptUrl };
      }
      return cell;
    });

    const cellAmount = challenge.cells.find(c => c.id === cellId)?.amount || 0;
    const newXp = (currentUser.xp || 0) + cellAmount;
    let newLevel = 1;
    for (const lvl of LEVELS) { if (newXp >= lvl.xpRequired) newLevel = lvl.level; else break; }

    try {
      await updateDoc(doc(db, "challenges", challenge.id), { cells: updatedCells, streak: (challenge.streak || 0) + 1 });
      await updateDoc(doc(db, "users", currentUser.id), { xp: newXp, level: newLevel });
      setIsReceiptModalOpen(null);
      setPreviewAvatar(null);
    } catch (err: any) {
      setFirestoreError({ code: err.code, message: err.message });
    }
  };

  return (
    <Layout currentUser={currentUser ? { ...currentUser, avatar: getUserAvatar(currentUser) } : null} onLogout={() => {
      localStorage.removeItem('ahorropro_current_user_id');
      setCurrentUser(null);
      setView('AUTH');
    }}>
      
      {firestoreError && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[999] flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-orange-500/50 p-10 rounded-[3rem] max-w-2xl w-full shadow-3xl text-center">
            <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl animate-bounce">🔐</div>
            <h2 className="text-3xl font-black italic uppercase text-white mb-4">Error de Nube</h2>
            <button onClick={() => window.location.reload()} className="w-full bg-orange-500 text-slate-950 py-5 rounded-2xl font-black uppercase tracking-widest text-xs">Recargar App</button>
          </div>
        </div>
      )}

      {view === 'AUTH' && (
        <div className="max-w-md mx-auto py-10 md:py-20 text-center animate-in fade-in duration-700">
          <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-700 rounded-[2.5rem] mx-auto flex items-center justify-center text-5xl mb-8 shadow-2xl rotate-3">🐷</div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter mb-2 text-white">Ahorro<span className="text-green-500">Pro</span></h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em] mb-12">Alcancía Familiar 🇵🇪</p>
          <div className="bg-slate-900/80 border border-slate-800 p-8 md:p-10 rounded-[4rem] shadow-2xl backdrop-blur-xl">
            <div className="flex bg-slate-950 p-1.5 rounded-3xl mb-10 border border-slate-800">
              <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'LOGIN' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Entrar</button>
              <button onClick={() => setAuthMode('REGISTER')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'REGISTER' ? 'bg-green-600 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Unirse</button>
            </div>
            <form onSubmit={handleAuth} className="space-y-5">
              <div className="text-left"><label className="text-[9px] font-black text-slate-500 uppercase ml-4 mb-1 block">Usuario</label><input name="userName" required placeholder="Tu apodo" className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-8 py-5 font-bold outline-none focus:border-green-500 transition-all text-white" /></div>
              <div className="text-left"><label className="text-[9px] font-black text-slate-500 uppercase ml-4 mb-1 block">Password</label><input name="password" type="password" required placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-8 py-5 font-bold outline-none focus:border-green-500 transition-all text-white" /></div>
              <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-slate-950 py-6 rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl mt-4">{authMode === 'LOGIN' ? 'Ingresar' : 'Crear Cuenta'}</button>
            </form>
          </div>
        </div>
      )}

      {view === 'LIST' && (
        <div className="space-y-12 animate-in fade-in duration-500">
           <header className="flex flex-col md:flex-row justify-between items-end gap-6">
              <div><h2 className="text-5xl font-black italic uppercase tracking-tighter text-white">Mis <span className="text-green-500">Retos</span></h2><p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">Colaborando en tus alcancías digitales</p></div>
              <div className="flex gap-4"><button onClick={() => setIsJoinModalOpen(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase">Unirse</button><button onClick={() => { setCreateTarget(5000); setCreateDays(365); setCreateQrPreview(null); setIsCreateModalOpen(true); }} className="bg-green-600 hover:bg-green-500 text-slate-950 px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl">+ Nuevo Proyecto</button></div>
           </header>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {challenges.filter(c => currentUser && c.participants.includes(currentUser.id)).map(ch => (
                <div key={ch.id} onClick={() => { setSelectedChallengeId(ch.id); setView('CHALLENGE'); }} className="bg-slate-900/60 border border-slate-800 p-10 rounded-[3.5rem] hover:border-green-500/40 cursor-pointer transition-all group shadow-2xl relative overflow-hidden">
                   <div className="w-16 h-16 bg-slate-800 rounded-2xl mb-8 flex items-center justify-center text-3xl group-hover:bg-green-500 group-hover:rotate-6 transition-all duration-500">🏺</div>
                   <h3 className="text-3xl font-black uppercase italic mb-3 text-white">{ch.name}</h3>
                   <span className="bg-slate-800 px-3 py-1 rounded-lg text-[10px] font-mono text-green-400">ID: {ch.id}</span>
                </div>
              ))}
              {challenges.filter(c => currentUser && c.participants.includes(currentUser.id)).length === 0 && !isSyncing && (
                <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-[4rem] bg-slate-900/20"><span className="text-5xl block mb-6">🏺</span><p className="text-slate-500 font-black uppercase text-xs tracking-[0.2em]">No tienes alcancías activas aún</p></div>
              )}
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
                    <button onClick={() => setView('LIST')} className="bg-slate-800 hover:bg-slate-700 p-4 rounded-2xl text-slate-400 hover:text-white transition-all">←</button>
                    <div className="text-center">
                      <h2 className="text-2xl font-black italic uppercase text-white">{ch.name}</h2>
                      <div className="flex items-center justify-center gap-3 mt-1">
                        <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">PROYECTO COLABORATIVO</span>
                        {ch.paymentQr && (
                          <button onClick={() => setIsShowQrModal(ch.paymentQr!)} className="bg-green-500 text-slate-950 text-[8px] font-black px-2 py-0.5 rounded-full hover:scale-110 transition-transform">VER QR</button>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-950 px-5 py-2.5 rounded-2xl border border-slate-800 text-[10px] font-black text-green-400">ID: {ch.id}</div>
                  </header>
                  <StatsPanel user={currentUser!} challenge={ch} />
                  <GridSystem cells={ch.cells} onMark={(id) => setIsReceiptModalOpen({cellId: id})} currentUser={currentUser!} allUsers={allUsers} />
                </div>
                <aside className="w-full lg:w-96 shrink-0 space-y-8">
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

      {/* MODAL: VISOR QR DE PAGO */}
      {isShowQrModal && (
        <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl z-[500] flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 max-w-sm w-full text-center">
            <h3 className="text-2xl font-black italic uppercase text-white mb-6">ESCANEAME PARA PAGAR</h3>
            <img src={isShowQrModal} className="w-full aspect-square object-contain bg-white rounded-3xl p-4 mb-8 shadow-2xl" />
            <button onClick={() => setIsShowQrModal(null)} className="w-full bg-slate-800 py-4 rounded-2xl font-black text-xs uppercase text-white">Cerrar Visor</button>
          </div>
        </div>
      )}

      {/* MODAL: UNIRSE AL RETO */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
           <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-[3rem] p-12 text-center shadow-3xl">
              <h3 className="text-3xl font-black mb-4 uppercase italic text-white">UNIRSE AL RETO</h3>
              <input id="joinIdInput" placeholder="XA39BZ" className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-6 py-6 text-center font-mono text-4xl text-green-400 mb-8 uppercase outline-none focus:border-green-500 shadow-inner" />
              <div className="flex gap-4">
                 <button onClick={() => setIsJoinModalOpen(false)} className="flex-1 bg-slate-800 py-5 rounded-[2rem] font-black text-xs uppercase text-white">Cerrar</button>
                 <button onClick={() => {
                   const val = (document.getElementById('joinIdInput') as HTMLInputElement).value;
                   const ch = challenges.find(c => c.id === val.toUpperCase());
                   if (ch) {
                     if (!ch.participants.includes(currentUser!.id)) { updateDoc(doc(db, "challenges", ch.id), { participants: [...ch.participants, currentUser!.id] }); }
                     setSelectedChallengeId(ch.id); setView('CHALLENGE'); setIsJoinModalOpen(false);
                   } else alert("Reto no encontrado");
                 }} className="flex-1 bg-green-600 text-slate-950 py-5 rounded-[2rem] font-black text-xs uppercase shadow-xl">Conectar</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: NUEVA ALCANCÍA */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[200] flex items-center justify-center p-4 overflow-y-auto">
           <div className="bg-slate-900 border border-slate-800 p-8 md:p-12 rounded-[4rem] max-w-md w-full shadow-3xl my-10">
              <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center text-3xl mb-8">🏺</div>
              <h2 className="text-4xl font-black italic uppercase mb-2 tracking-tighter text-white">NUEVA <span className="text-green-500">ALCANCÍA</span></h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-10">Define tu meta colaborativa</p>
              
              <form onSubmit={handleCreateChallenge} className="space-y-6">
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-4 block">Nombre del Reto</label>
                  <input name="name" required placeholder="Ej: Navidad en Familia" className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] px-8 py-5 font-black italic text-lg outline-none focus:border-green-500 text-white shadow-inner" />
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-4 block">Plazo del Reto (Días)</label>
                  <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-[2rem] px-4 py-2">
                    <button type="button" onClick={() => setCreateDays(Math.max(365, createDays - 30))} className="w-10 h-10 bg-slate-800 rounded-xl font-black">-</button>
                    <input name="days" type="number" value={createDays} readOnly className="flex-1 bg-transparent text-center font-black text-2xl text-white outline-none" />
                    <button type="button" onClick={() => setCreateDays(createDays + 30)} className="w-10 h-10 bg-slate-800 rounded-xl font-black">+</button>
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-4 block">Meta Total (Soles)</label>
                  <input name="target" type="number" step="10" min={createDays * 10} value={createTarget} onChange={(e) => setCreateTarget(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] px-8 py-5 font-black text-4xl text-green-400 shadow-inner text-center" />
                  <p className="text-[9px] text-orange-500 font-black uppercase italic ml-4">Mínimo S/ {createDays * 10}</p>
                </div>

                {/* CAMPO QR DE PAGO */}
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-4 block">QR de Pago (Opcional)</label>
                  <div onClick={() => qrInputRef.current?.click()} className="w-full bg-slate-950 border-2 border-dashed border-slate-800 rounded-[2rem] p-4 flex flex-col items-center justify-center cursor-pointer hover:border-green-500/50 transition-all min-h-[100px]">
                    {createQrPreview ? (
                      <img src={createQrPreview} className="h-24 object-contain rounded-xl" />
                    ) : (
                      <div className="text-center"><span className="text-2xl block mb-1">📸</span><p className="text-[8px] font-black text-slate-600 uppercase">Yape o Plin</p></div>
                    )}
                    <input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { const r = new FileReader(); r.onloadend = () => setCreateQrPreview(r.result as string); r.readAsDataURL(f); }
                    }} />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                   <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 bg-slate-800 py-6 rounded-[2rem] font-black text-xs uppercase text-slate-400">Cancelar</button>
                   <button type="submit" className="flex-1 bg-green-600 text-slate-950 py-6 rounded-2rem font-black text-xs uppercase shadow-xl hover:bg-green-500 transition-colors">Lanzar</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR PAGO */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[300] flex items-center justify-center p-4">
           <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-[3.5rem] p-12 text-center shadow-3xl">
              <h3 className="text-2xl font-black mb-4 uppercase italic text-white">CONFIRMAR PAGO</h3>
              <div className="mb-10 p-10 border-2 border-dashed border-slate-800 rounded-[3rem] bg-slate-950/50 cursor-pointer group" onClick={() => avatarInputRef.current?.click()}>
                 {previewAvatar ? <img src={previewAvatar} className="w-full h-40 object-contain rounded-2xl" /> : <div className="space-y-3"><span className="text-5xl inline-block">📸</span><p className="text-[10px] font-black text-slate-500 uppercase">+ FOTO VOUCHER</p></div>}
                 <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                   const f = e.target.files?.[0];
                   if (f) { const r = new FileReader(); r.onloadend = () => setPreviewAvatar(r.result as string); r.readAsDataURL(f); }
                 }} />
              </div>
              <div className="flex gap-4">
                 <button onClick={() => { setIsReceiptModalOpen(null); setPreviewAvatar(null); }} className="flex-1 bg-slate-800 py-5 rounded-[2rem] font-black text-xs uppercase text-slate-400">Sin foto</button>
                 <button onClick={() => handleMarkCell(isReceiptModalOpen.cellId, previewAvatar || undefined)} className="flex-1 bg-green-600 text-slate-950 py-5 rounded-[2rem] font-black text-xs uppercase shadow-xl">Confirmar</button>
              </div>
           </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
