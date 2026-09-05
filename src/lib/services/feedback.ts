import { supabase } from "../supabase";

// CSAT puntual por feature — hoy solo "price_suggestion" (el precio que
// sugiere lucIA al publicar), pero el nombre de la tabla y la columna
// `feature` son genéricos a propósito para reusar esto con otras
// funcionalidades más adelante sin crear una tabla nueva por cada una.
export type FeedbackScore = "positive" | "negative";

export async function submitFeatureFeedback(
  userId: string,
  feature: string,
  score: FeedbackScore,
  context?: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("feature_feedback")
    .insert([{ user_id: userId, feature, score, context: context ?? null }]);

  if (error) {
    console.error("Error submitting feedback:", error);
    throw error;
  }
}
