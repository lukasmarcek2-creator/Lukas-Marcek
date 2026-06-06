import { Cafe, CafeRewardGoal } from './types';

export const CAFES: Cafe[] = [
  {
    id: 'wallner',
    name: 'Café Wallner (St. Wolfgang)',
    reward: '4.50 €',
    rewardAmount: 4.50,
    location: [47.7385, 13.4475],
    description: 'Slávna rodinná kaviareň priamo na brehu jazera Wolfgangsee, známa ručne pečenými perníkmi a tradičnými salzburskými múčnikmi už od roku 1928.',
    specialty: 'Original St. Wolfgang Lebkuchen',
    specialtySlovak: 'Originálny Wolfgangsee medovník a nadýchané penové šatôčky',
    address: 'Markt 33, 5360 St. Wolfgang im Salzkammergut',
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'hofzuckerbaeckerei',
    name: 'K.u.K. Hofzuckerbäckerei (Bad Ischl)',
    reward: '5.00 €',
    rewardAmount: 5.00,
    location: [47.7125, 13.6210],
    description: 'Bývalý cisársky a kráľovský dvorný cukrár. Miesto, ktoré navštevoval sám cisár František Jozef I. a cisárovná Sisi pri svojich pobytoch v Bad Ischli.',
    specialty: 'Ischler Zaunerstollen & Ischler Törtchen',
    specialtySlovak: 'Cisársky orechový rez Zaunerstollen a Ischler Törtchen',
    address: 'Pfarrgasse 2, 4820 Bad Ischl',
    imageUrl: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'seecafe',
    name: 'Seecafe Hallstatt',
    reward: '3.50 €',
    rewardAmount: 3.50,
    location: [47.5620, 13.6490],
    description: 'Kúzelná kaviareň s terasou priamo nad krištáľovo čistou hladinou jazera Hallstättersee. Ponúka bezkonkurenčný výhľad na svetové dedičstvo UNESCO.',
    specialty: 'Hausgemachter Apfelstrudel mit Vanillesauce',
    specialtySlovak: 'Domáca jablková štrúdľa s vanilkovou omáčkou',
    address: 'Seestrasse 102, 4830 Hallstatt',
    imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
  }
];

export const REWARD_GOALS: CafeRewardGoal[] = [
  {
    id: 'melange',
    name: 'Wiener Melange',
    nameSlovak: 'Viedenská káva Melange',
    cost: 3.80,
    descriptionSlovak: 'Tradičné viedenské espresso so speneným mliekom a jemnou čiapočkou peny.',
    icon: 'Coffee'
  },
  {
    id: 'strudel',
    name: 'Apfelstrudel mit Schlagobers',
    nameSlovak: 'Jablková štrúdľa so šľahačkou',
    cost: 4.50,
    descriptionSlovak: 'Tenké chrumkavé cesto, voňavé kyselkavé jablká, škorica, hrozienka a kopec pravej šľahačky.',
    icon: 'Cookie'
  },
  {
    id: 'sachertorte',
    name: 'Original Sacher Torte slice',
    nameSlovak: 'Rez originálnej Sacherovej torty',
    cost: 5.80,
    descriptionSlovak: 'Hutný čokoládový korpus s marhuľovým džemom a lesklou tmavou čokoládovou polevou.',
    icon: 'Cake'
  },
  {
    id: 'zaunerstollen',
    name: 'Original Zaunerstollen',
    nameSlovak: 'Originálny cisársky Zaunerstollen',
    cost: 6.50,
    descriptionSlovak: 'Pravý nugátovo-orechový klenot cukrárne Zauner z Bad Ischlu podľa tajnej receptúry.',
    icon: 'Crown'
  }
];
