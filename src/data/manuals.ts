import type { Manual } from '../types';

export const MANUALS: Manual[] = [
  {
    id: 'battlefield',
    title: 'Battlefield Repairs Manual',
    filename: 'Battlefield_Repairs_Manual.pdf',
    pageCount: 8,
    language: 'en',
    description: 'Compact field repair guide covering emergency procedures and quick fixes.',
  },
  {
    id: 'hebrew',
    title: 'CJ8 Manual (Hebrew) — JEEPOLOG',
    filename: 'CJ8_Hebrew_Manual_(JEEPOLOG).pdf',
    pageCount: 0,
    language: 'he',
    description: 'Comprehensive CJ8 manual in Hebrew. Primary technical reference.',
  },
  {
    id: 'gimel',
    title: 'CJ8 Manual — Gimel (JEEPOLOG)',
    filename: 'CJ8_Manual_-_Gimel_(JEEPOLOG).pdf',
    pageCount: 0,
    language: 'he',
    description: 'Supplementary CJ8 reference manual.',
  },
];
