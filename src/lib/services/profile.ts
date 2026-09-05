import { supabase } from "../supabase";
import type { TipoDocumento } from "../mock-data";

export async function updatePhone(userId: string, phone: string) {
  const { error } = await supabase.from("profiles").update({ phone }).eq("id", userId);
  if (error) {
    console.error("Error updating phone:", error);
    throw error;
  }
}

// Completa el documento de identidad de la cuenta — necesario para las
// cuentas creadas con Google (nunca pasan por el formulario de registro, que
// sí lo pide como campo obligatorio). Se gatea en el mismo punto donde ya se
// pedía sesión al pasar del Paso 1 al Paso 2 de Publicar.
export async function updateDocumentInfo(
  userId: string,
  documentType: TipoDocumento,
  documentNumber: string,
) {
  const { error } = await supabase
    .from("profiles")
    .update({ document_type: documentType, document_number: documentNumber })
    .eq("id", userId);
  if (error) {
    console.error("Error updating document info:", error);
    throw error;
  }
}
