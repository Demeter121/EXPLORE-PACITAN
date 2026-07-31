import { useEffect, useState } from "react";
import { 
  getAuth, 
  onAuthStateChanged, 
  verifyBeforeUpdateEmail, 
  User as FirebaseUser 
} from "firebase/auth";
import { auth } from "./firebase";

/**
 * Custom hook to monitor the Firebase Authentication state reactively.
 * This guarantees the user's email and profile details are fully loaded and never
 * evaluated prematurely as null on initial page render.
 */
export function useActiveAuthUser() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    // Subscribe to real-time auth changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      console.log("Firebase Auth State Changed. Active User:", firebaseUser?.email);
    }, (error) => {
      console.error("Auth state subscription error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}

interface UpdateEmailResult {
  success: boolean;
  message: string;
}

/**
 * Modern, safe callback for updating the logged-in user's email address.
 * Initiates the Firebase verify-before-update process and handles errors gracefully.
 * 
 * @param newEmail The target email address (must end with @gmail.com or valid domain)
 * @param onToast Callback to trigger aesthetic notification toasts to the user
 */
export async function handleRequestEmailChange(
  newEmail: string,
  onToast?: (message: string, type: "success" | "error" | "info") => void
): Promise<UpdateEmailResult> {
  const currentAuth = auth || getAuth();
  const user = currentAuth.currentUser;

  if (!user) {
    const errorMsg = "Anda harus login terlebih dahulu sebelum mengubah email!";
    if (onToast) onToast(errorMsg, "error");
    return { success: false, message: errorMsg };
  }

  const cleanNewEmail = newEmail.trim().toLowerCase();
  
  if (!cleanNewEmail) {
    const errorMsg = "Alamat email baru tidak boleh kosong!";
    if (onToast) onToast(errorMsg, "error");
    return { success: false, message: errorMsg };
  }

  if (cleanNewEmail === user.email?.toLowerCase()) {
    const errorMsg = "Email baru harus berbeda dari email Anda saat ini.";
    if (onToast) onToast(errorMsg, "info");
    return { success: false, message: errorMsg };
  }

  // Basic validation check
  if (!cleanNewEmail.includes("@") || !cleanNewEmail.includes(".")) {
    const errorMsg = "Silakan masukkan alamat email yang valid!";
    if (onToast) onToast(errorMsg, "error");
    return { success: false, message: errorMsg };
  }

  try {
    // Highly secure and recommended flow in Firebase 10+
    await verifyBeforeUpdateEmail(user, cleanNewEmail);
    
    const successMsg = "Link verifikasi telah dikirim ke email baru Anda! Email akan diperbarui secara otomatis setelah Anda mengklik tautan tersebut.";
    if (onToast) onToast(successMsg, "success");
    return { success: true, message: successMsg };
  } catch (error: any) {
    console.error("Gagal memperbarui email:", error);
    
    let userFriendlyError = "Gagal mengirim verifikasi. Silakan login kembali (re-authenticate) sebelum melakukan perubahan data sensitif.";
    if (error?.code === "auth/requires-recent-login") {
      userFriendlyError = "Tindakan ini memerlukan login terbaru. Silakan logout dan login kembali untuk melanjutkan.";
    } else if (error?.code === "auth/invalid-email") {
      userFriendlyError = "Format email baru tidak didukung atau tidak valid.";
    }

    if (onToast) onToast(userFriendlyError, "error");
    return { success: false, message: userFriendlyError };
  }
}
