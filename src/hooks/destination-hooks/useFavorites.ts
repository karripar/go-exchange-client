"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * manage user's favorite destinations
 */

type Favorite = {
  destination: string;
  url: string;
  _id: string;
};

export const useFavorites = () => {
  const { user, updateUser } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // get the users favorites from their profile
  useEffect(() => {
    if (Array.isArray(user?.favorites)) {
      const rawFavorites = user.favorites as unknown[];

      const normalizedFavorites: Favorite[] = rawFavorites
        .map((fav) => {
          if (
            fav &&
            typeof fav === "object" &&
            "destination" in fav &&
            "url" in fav
          ) {
            const { destination, url, _id } = fav as {
              destination?: unknown;
              url?: unknown;
              _id?: unknown;
            };

            if (typeof destination === "string" && typeof url === "string") {
              return {
                destination,
                url,
                _id: typeof _id === "string" ? _id : "",
              };
            }
          }
          return null;
        })
        .filter((fav): fav is Favorite => fav !== null);

      setFavorites(normalizedFavorites);
    } else {
      setFavorites([]);
    }
  }, [user?.favorites]);

  /**
   * Add a destination to favorites
   */
  const addFavorite = useCallback(
    async (destination: string, url: string): Promise<boolean> => {
      const authToken = localStorage.getItem("authToken");
      if (!authToken) {
        setError("Not authenticated");
        return false;
      }

      const body = {
        destination,
        url,
      };

      setLoading(true);
      setError(null);

      console.log("Adding favorite:", body);

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_AUTH_API}/profile/favorites`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to add favorite: ${response.status}`);
        }

        const updatedUser = await response.json();
        setFavorites(
          Array.isArray(updatedUser.favorites)
            ? updatedUser.favorites.map(
                (fav: { destination: string; url: string }) => ({
                  destination: fav.destination,
                  url: fav.url,
                })
              )
            : []
        );

        // update user profile
        if (updateUser) {
          updateUser(updatedUser);
        }

        return true;
      } catch (err) {
        console.error("Error adding favorite:", err);
        setError("Failed to add favorite");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [updateUser]
  );

  /**
   * Remove a destination from favorites
   */
  const removeFavorite = useCallback(
    async (destination: string, url: string): Promise<boolean> => {
      const authToken = localStorage.getItem("authToken");
      if (!authToken) {
        setError("Not authenticated");
        return false;
      }

      setLoading(true);
      setError(null);

      const body = {
        destination,
        url,
      };

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_AUTH_API}/profile/favorites`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to remove favorite: ${response.status}`);
        }

        const updatedUser = await response.json();
        setFavorites(
          Array.isArray(updatedUser.favorites)
            ? updatedUser.favorites.map(
                (fav: { destination: string; url: string }) => ({
                  destination: fav.destination,
                  url: fav.url,
                })
              )
            : []
        );

        if (updateUser) {
          updateUser(updatedUser);
        }

        return true;
      } catch (err) {
        console.error("Error removing favorite:", err);
        setError("Failed to remove favorite");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [updateUser]
  );

  /**
   * toggle favorite status
   */
  const toggleFavorite = useCallback(
    async (destination: string, url: string): Promise<boolean> => {
      const isFavorite = favorites.some(
        (fav) => fav.destination === destination && fav.url === url
      );
      return isFavorite
        ? await removeFavorite(destination, url)
        : await addFavorite(destination, url);
    },
    [favorites, addFavorite, removeFavorite]
  );

  /**
   * check if destination is in favorites
   */
  const isFavorite = useCallback(
    (destination: string, url?: string): boolean => {
      return favorites.some((fav) => {
        if (url !== undefined) {
          return fav.destination === destination && fav.url === url;
        }
        return fav.destination === destination;
      });
    },
    [favorites]
  );

  return {
    favorites,
    loading,
    error,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
  };
};
