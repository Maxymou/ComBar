import { Denomination } from '../types';

export const DENOMINATIONS: Denomination[] = [
  { id: '50', label: '50€',  value: 50,  type: 'billet' },
  { id: '20', label: '20€',  value: 20,  type: 'billet' },
  { id: '10', label: '10€',  value: 10,  type: 'billet' },
  { id: '5',  label: '5€',   value: 5,   type: 'billet' },
  { id: '2',  label: '2€',   value: 2,   type: 'piece'  },
  { id: '1',  label: '1€',   value: 1,   type: 'piece'  },
  { id: '05', label: '0,5€', value: 0.5, type: 'piece'  },
];
