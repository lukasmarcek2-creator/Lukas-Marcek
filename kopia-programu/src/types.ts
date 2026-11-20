export interface Cafe {
  id: string;
  name: string;
  reward: string;
  rewardAmount: number; // Numeric parsed value, e.g. 4.50
  location: [number, number]; // Latitude, Longitude
  description: string;
  specialty: string;
  specialtySlovak: string;
  address: string;
  imageUrl: string;
}

export interface VisitLog {
  id: string;
  cafeId: string;
  cafeName: string;
  amount: number;
  date: string;
  photoUrl?: string;
  instagramScreenshotUrl?: string;
  instagramStatus?: 'not_uploaded' | 'pending' | 'verified';
}

export interface CafeRewardGoal {
  id: string;
  name: string;
  nameSlovak: string;
  cost: number;
  descriptionSlovak: string;
  icon: string;
}
