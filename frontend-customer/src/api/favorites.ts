import api from "@/api/client";
export type Favorite = { id:number; product:number; created_at?:string };

export async function fetchFavorites(): Promise<Favorite[]> {
  const { data } = await api.get("/api/orders/favorites/");
  return data as Favorite[];
}
export async function addFavorite(productId: number): Promise<Favorite> {
  const { data } = await api.post("/api/orders/favorites/", { product: productId });
  return data as Favorite;
}
export async function removeFavoriteByProduct(productId: number): Promise<void> {
  await api.delete("/api/orders/favorites/", { params: { product: productId } });
}
export async function removeFavoriteById(id: number): Promise<void> {
  await api.delete(`/api/orders/favorites/${id}/`);
}