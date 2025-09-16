export type Brand = { id: number; name: string };
export type Category = { id: number; name: string };

export type ProductImage = {
  id: number;
  image_url: string;
  is_cover: boolean;
  sort_order: number;
};

export type Variant = {
  id: number;
  color: string;
  size_eu: string;
  size_cm: string;
  stock: number;
};

export type Product = {
  id: number;
  brand: number;
  category: number | null;
  name_en: string;
  name_th: string;
  description_en: string;
  description_th: string;
  base_price: string | number;
  sale_percent: number;
  sale_price: string;
  popularity: number;
  is_active: boolean;
  images: ProductImage[];
  variants: Variant[];
  average_rating?: number;   // 0–5
  review_count?: number;
};

export type HomeRows = {
  recommended: Product[];
  trending: Product[];
  personalized: Product[];
};

export type User = {
  id: number;
  username: string;
  email: string;
  role: "superadmin" | "subadmin" | "customer";
  phone?: string;
  default_address?: string;
};
