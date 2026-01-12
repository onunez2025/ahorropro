
import { LevelTitle, User } from './types';

export const BANKNOTES = [200, 100, 50, 20, 10];

export const SKINS = [
  { id: 'avataaars', name: 'Humano', minLevel: 1, icon: '👤' },
  { id: 'bottts', name: 'Robot Pro', minLevel: 2, icon: '🤖' },
  { id: 'pixel-art', name: 'Retro Pixel', minLevel: 4, icon: '👾' },
  { id: 'big-smile', name: 'Feliz', minLevel: 6, icon: '😊' },
  { id: 'lorelei', name: 'Elegante', minLevel: 8, icon: '✨' },
  { id: 'adventurer', name: 'Leyenda', minLevel: 10, icon: '⚔️' },
];

export const LEVELS = [
  { level: 1, title: LevelTitle.NOVATO, xpRequired: 0 },
  { level: 2, title: LevelTitle.APRENDIZ, xpRequired: 500 },
  { level: 3, title: LevelTitle.AHORRADOR, xpRequired: 1500 },
  { level: 4, title: LevelTitle.ESTRATEGA, xpRequired: 4000 },
  { level: 5, title: LevelTitle.INVERSIONISTA, xpRequired: 8000 },
  { level: 6, title: LevelTitle.MAGNATE, xpRequired: 15000 },
  { level: 7, title: LevelTitle.MISIONERO, xpRequired: 30000 },
  { level: 8, title: LevelTitle.ELITE, xpRequired: 60000 },
  { level: 9, title: LevelTitle.MAESTRO, xpRequired: 100000 },
  { level: 10, title: LevelTitle.LEYENDA, xpRequired: 200000 },
];

export const CHEST_MILESTONES = [0.25, 0.5, 0.75, 1.0];

export const getAvatarUrl = (skin: string, seed: string) => 
  `https://api.dicebear.com/7.x/${skin}/svg?seed=${seed}`;

/**
 * Retorna la fuente de la imagen del usuario (Avatar dinámico o imagen personalizada)
 */
export const getUserAvatar = (user: User) => {
  if (user.activeSkin === 'custom') {
    return user.avatar;
  }
  return getAvatarUrl(user.activeSkin, user.avatar);
};
