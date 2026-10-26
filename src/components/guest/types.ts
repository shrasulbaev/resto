import type { Lang } from "@/lib/i18n";

// Plain data passed from the server page to the guest UI.
export type GuestDish = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  composition: string | null;
  price: number;
  weight: string | null;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  allergens: string[];
  tags: string[];
  isSignature: boolean;
  photoUrl: string | null;
  searchText: string;
};

export type GuestCategory = { id: string; name: string; dishIds: string[] };

export type GuestVenue = {
  name: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
  backgroundDim: number;
};

export type GuestMenuData = {
  lang: Lang;
  venue: GuestVenue;
  tableNumber: number;
  tableToken: string;
  dishes: GuestDish[];
  categories: GuestCategory[];
  hitIds: string[];
};
