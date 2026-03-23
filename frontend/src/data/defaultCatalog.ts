import { Product } from '../types';

export const DEFAULT_PRODUCTS: Product[] = [
  { id: 'biere25',        name: 'Bière 25cl',  icon: '🍺', normalPrice: 2,  hhPrice: 2,  hhBonus: true,  category: 'drink',    displayOrder: 0 },
  { id: 'biere50',        name: 'Bière 50cl',  icon: '🍺', normalPrice: 4,  hhPrice: 2,  hhBonus: true,  category: 'drink',    displayOrder: 1 },
  { id: 'pichet',         name: 'Pichet 1,5L', icon: '🍻', normalPrice: 10, hhPrice: 10, hhBonus: true,  category: 'drink',    displayOrder: 2 },
  { id: 'shooter',        name: 'Shooter',     icon: '🥃', normalPrice: 1,  hhPrice: 1,  hhBonus: false, category: 'drink',    displayOrder: 3 },
  { id: 'vinRouge',       name: 'Vin Rouge',   icon: '🍷', normalPrice: 2,  hhPrice: 2,  hhBonus: false, category: 'drink',    displayOrder: 4 },
  { id: 'vinBlanc',       name: 'Vin Blanc',   icon: '🥂', normalPrice: 2,  hhPrice: 2,  hhBonus: false, category: 'drink',    displayOrder: 5 },
  { id: 'consigne25',     name: 'Csg. 25cl',   icon: '🫙', normalPrice: 1,  hhPrice: 1,  hhBonus: false, category: 'consigne', displayOrder: 0 },
  { id: 'consigne50',     name: 'Csg. 50cl',   icon: '🫙', normalPrice: 2,  hhPrice: 2,  hhBonus: false, category: 'consigne', displayOrder: 1 },
  { id: 'consignePichet', name: 'Csg. Pichet', icon: '🪣', normalPrice: 5,  hhPrice: 5,  hhBonus: false, category: 'consigne', displayOrder: 2 },
  { id: 'kebab',          name: 'Kebab',       icon: '🥙', normalPrice: 5,  hhPrice: 5,  hhBonus: false, category: 'food',     displayOrder: 0 },
  { id: 'vege',           name: 'Végé',        icon: '🥗', normalPrice: 5,  hhPrice: 5,  hhBonus: false, category: 'food',     displayOrder: 1 },
];
