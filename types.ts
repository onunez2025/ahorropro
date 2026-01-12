
export enum LevelTitle {
  NOVATO = 'Novato',
  APRENDIZ = 'Aprendiz',
  AHORRADOR = 'Ahorrador Pro',
  ESTRATEGA = 'Estratega',
  INVERSIONISTA = 'Inversionista',
  MAGNATE = 'Magnate',
  MISIONERO = 'Misionero Financiero',
  ELITE = 'Élite del Ahorro',
  MAESTRO = 'Maestro de la Fortuna',
  LEYENDA = 'Leyenda Financiera'
}

export interface User {
  id: string;
  name: string;
  password?: string;
  email?: string;
  phone?: string;
  avatar: string; // This is the seed
  activeSkin: string; // The DiceBear collection name
  unlockedSkins: string[]; // List of collection names
  xp: number;
  level: number;
}

export interface Cell {
  id: number;
  amount: number;
  isPaid: boolean;
  paidBy?: string; // User ID
  paidAt?: string; // ISO Date string
  receiptUrl?: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  reason: string;
  withdrawnBy: string; // User ID
  withdrawnAt: string; // ISO Date
}

export interface Challenge {
  id: string;
  name: string;
  targetAmount: number;
  days: number;
  createdAt: string;
  cells: Cell[];
  participants: string[];
  withdrawals?: Withdrawal[];
  streak: number;
  lastPaymentDate?: string;
  paymentQr?: string; // Base64 image string for Yape/Plin QR
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
}
