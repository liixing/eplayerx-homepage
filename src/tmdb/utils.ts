import { tmdb } from "./client.js";

/**
 * Get thumb from TMDB images API
 * Returns the first backdrop file_path, or null if not found
 */
export async function getThumbFromImages(
  tmdbId: number,
  type: "movie" | "tv",
  language = "zh"
): Promise<string | null> {
  try {
    let result;
    if (type === "movie") {
      result = await tmdb.GET(`/3/movie/${tmdbId}/images`, {
        params: {
          path: {
            movie_id: tmdbId,
          },
          query: {
            include_image_language: `${language},en`,
          },
        },
      });
    } else {
      result = await tmdb.GET(`/3/tv/${tmdbId}/images`, {
        params: {
          path: {
            series_id: tmdbId,
          },
          query: {
            include_image_language: `${language},en`,
          },
        },
      });
    }

    if (result.response.status === 200 && result.data) {
      const data = result.data as any;
      if (
        data.backdrops &&
        Array.isArray(data.backdrops) &&
        data.backdrops.length > 0
      ) {
        const firstBackdrop = data.backdrops[0];
        if (firstBackdrop?.file_path) {
          return firstBackdrop.file_path;
        }
      }
    }
    return null;
  } catch (error) {
    console.error(`TMDB images error for ${type} ${tmdbId}:`, error);
    return null;
  }
}

