import React, { useEffect, useRef } from "react";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  onSnapshot 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { 
  User, 
  Location, 
  LocationSubmission, 
  Review, 
  Itinerary, 
  TourPackage, 
  ModerationLog, 
  AdminNotification,
  AiConfig
} from "../types";
import { AiService } from "./aiService";
import { 
  INITIAL_LOCATIONS, 
  INITIAL_SUBMISSIONS, 
  INITIAL_REVIEWS, 
  INITIAL_ITINERARIES, 
  INITIAL_TOUR_PACKAGES, 
  INITIAL_LOGS, 
  INITIAL_NOTIFICATIONS, 
  MOCK_USERS, 
  LocalDB,
  enforceDefaultAccount
} from "../data";

// Helper function to recursively remove undefined properties from any object to prevent Firestore errors
export function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanObject).filter(v => v !== undefined);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanObject(val);
      }
    }
    return cleaned;
  }
  return obj;
}

// Generic function to sync state updates to Firestore (diffing and writing individual doc additions, updates, or deletions)
export async function syncStateToFirestore<T extends { id: string }>(
  collectionName: string,
  currentList: T[],
  lastListRef: React.MutableRefObject<T[] | null>
) {
  if (!db) return;
  
  // If we haven't even loaded the initial list from Firestore yet, don't write anything back to avoid overwriting database contents
  if (lastListRef.current === null) {
    return;
  }

  const previousList = lastListRef.current;
  
  // Find added or updated items
  const addedOrUpdated = currentList.filter(item => {
    const prevItem = previousList.find(p => p.id === item.id);
    if (!prevItem) return true; // Added
    return JSON.stringify(prevItem) !== JSON.stringify(item); // Updated
  });

  // Find deleted items
  const deleted = previousList.filter(prevItem => {
    return !currentList.some(item => item.id === prevItem.id);
  });

  // Write changes to Firestore
  if (addedOrUpdated.length > 0) {
    for (const item of addedOrUpdated) {
      try {
        const cleanedItem = cleanObject(item);
        await setDoc(doc(db, collectionName, item.id), cleanedItem);
      } catch (err) {
        console.error(`Error saving ${collectionName} item to Firestore:`, err);
        handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${item.id}`);
      }
    }
  }

  if (deleted.length > 0) {
    for (const item of deleted) {
      try {
        await deleteDoc(doc(db, collectionName, item.id));
      } catch (err) {
        console.error(`Error deleting ${collectionName} item from Firestore:`, err);
        handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${item.id}`);
      }
    }
  }

  // Update the reference to align with the state
  lastListRef.current = currentList;
}

// Helper to seed a Firestore collection with default data when it is empty
async function seedFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  initialData: T[]
) {
  if (!db) return;
  console.log(`FirestoreSync: Seeding collection "${collectionName}" with ${initialData.length} default items...`);
  try {
    const batch = writeBatch(db);
    initialData.forEach(item => {
      const dRef = doc(db!, collectionName, item.id);
      const cleanedItem = cleanObject(item);
      batch.set(dRef, cleanedItem);
    });
    await batch.commit();
    console.log(`FirestoreSync: Successfully seeded collection "${collectionName}".`);
  } catch (err) {
    console.error(`FirestoreSync: Failed to seed collection "${collectionName}":`, err);
  }
}

interface FirestoreSyncProps {
  locations: Location[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  submissions: LocationSubmission[];
  setSubmissions: React.Dispatch<React.SetStateAction<LocationSubmission[]>>;
  reviews: Review[];
  setReviews: React.Dispatch<React.SetStateAction<Review[]>>;
  itineraries: Itinerary[];
  setItineraries: React.Dispatch<React.SetStateAction<Itinerary[]>>;
  tourPackages: TourPackage[];
  setTourPackages: React.Dispatch<React.SetStateAction<TourPackage[]>>;
  logs: ModerationLog[];
  setLogs: React.Dispatch<React.SetStateAction<ModerationLog[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  notifications: AdminNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<AdminNotification[]>>;
}

export function useFirestoreSync({
  locations,
  setLocations,
  submissions,
  setSubmissions,
  reviews,
  setReviews,
  itineraries,
  setItineraries,
  tourPackages,
  setTourPackages,
  logs,
  setLogs,
  users,
  setUsers,
  notifications,
  setNotifications
}: FirestoreSyncProps) {
  
  // Refs to track last known Firestore lists to prevent feedback loops/redundant writes
  const locationsRef = useRef<Location[] | null>(null);
  const submissionsRef = useRef<LocationSubmission[] | null>(null);
  const reviewsRef = useRef<Review[] | null>(null);
  const itinerariesRef = useRef<Itinerary[] | null>(null);
  const tourPackagesRef = useRef<TourPackage[] | null>(null);
  const logsRef = useRef<ModerationLog[] | null>(null);
  const usersRef = useRef<User[] | null>(null);
  const notificationsRef = useRef<AdminNotification[] | null>(null);

  // Set up listeners on component mount
  useEffect(() => {
    if (!db) {
      console.warn("FirestoreSync: Database instance not available. Offline/LocalDB fallback is active.");
      return;
    }

    console.log("FirestoreSync: Initializing real-time synchronization with main Firestore database...");

    // Helper to subscribe to a collection
    const subscribeToCollection = <T extends { id: string }>(
      collectionName: string,
      defaultData: T[],
      ref: React.MutableRefObject<T[] | null>,
      setState: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      return onSnapshot(
        collection(db!, collectionName),
        async (snapshot) => {
          if (snapshot.empty) {
            // Seed Firestore with default data if empty
            await seedFirestoreCollection(collectionName, defaultData);
            return;
          }

          let list: T[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as T);
          });

          if (collectionName === "users") {
            list = LocalDB.cleanAndDeduplicateUsers(list as unknown as User[]) as unknown as T[];
          } else {
            const seen = new Set<string>();
            const deduped: T[] = [];
            for (const item of list) {
              if (item && item.id && !seen.has(item.id)) {
                seen.add(item.id);
                deduped.push(item);
              }
            }
            list = deduped;
          }

          // Update ref FIRST, then state to prevent the writeback useEffect from triggering redundant writes
          ref.current = list;
          setState(list);
          console.log(`FirestoreSync: Synced ${list.length} items for collection "${collectionName}".`);
        },
        (error) => {
          console.error(`FirestoreSync: Subscription error for "${collectionName}":`, error);
          handleFirestoreError(error, OperationType.LIST, collectionName);
        }
      );
    };

    const unsubLocations = subscribeToCollection("locations", INITIAL_LOCATIONS, locationsRef, setLocations);
    const unsubSubmissions = subscribeToCollection("submissions", INITIAL_SUBMISSIONS, submissionsRef, setSubmissions);
    const unsubReviews = subscribeToCollection("reviews", INITIAL_REVIEWS, reviewsRef, setReviews);
    const unsubItineraries = subscribeToCollection("itineraries", INITIAL_ITINERARIES, itinerariesRef, setItineraries);
    const unsubTourPackages = subscribeToCollection("tour_packages", INITIAL_TOUR_PACKAGES, tourPackagesRef, setTourPackages);
    const unsubLogs = subscribeToCollection("logs", INITIAL_LOGS, logsRef, setLogs);
    const unsubUsers = subscribeToCollection("users", MOCK_USERS, usersRef, setUsers);
    const unsubNotifications = subscribeToCollection("notifications", INITIAL_NOTIFICATIONS, notificationsRef, setNotifications);
    
    // Real-time listener for AI configuration settings
    const unsubAiConfig = onSnapshot(
      doc(db!, "ai_settings", "config"),
      (snapshot) => {
        if (snapshot.exists()) {
          const cloudConfig = snapshot.data() as AiConfig;
          const localConfig = AiService.getConfig();
          if (JSON.stringify(localConfig) !== JSON.stringify(cloudConfig)) {
            localStorage.setItem("sipp_ai_config", JSON.stringify(cloudConfig));
            window.dispatchEvent(new CustomEvent("sipp_ai_config_updated", { detail: cloudConfig }));
          }
        } else {
          // Seed the current validated local config if Firestore has none
          const localConfig = AiService.getConfig();
          if (localConfig && localConfig.isValidated && localConfig.apiKey) {
            setDoc(doc(db!, "ai_settings", "config"), localConfig).catch((e) => {
              console.error("Gagal menaruh data awal ai_config ke Firestore:", e);
            });
          }
        }
      },
      (error) => {
        console.error("FirestoreSync: Error loading ai_config:", error);
      }
    );

    return () => {
      unsubLocations();
      unsubSubmissions();
      unsubReviews();
      unsubItineraries();
      unsubTourPackages();
      unsubLogs();
      unsubUsers();
      unsubNotifications();
      unsubAiConfig();
      console.log("FirestoreSync: Unsubscribed from Firestore listeners.");
    };
  }, [
    setLocations,
    setSubmissions,
    setReviews,
    setItineraries,
    setTourPackages,
    setLogs,
    setUsers,
    setNotifications
  ]);

  // Synchronize changes back to Firestore when React state changes
  useEffect(() => {
    syncStateToFirestore("locations", locations, locationsRef);
  }, [locations]);

  useEffect(() => {
    syncStateToFirestore("submissions", submissions, submissionsRef);
  }, [submissions]);

  useEffect(() => {
    syncStateToFirestore("reviews", reviews, reviewsRef);
  }, [reviews]);

  useEffect(() => {
    syncStateToFirestore("itineraries", itineraries, itinerariesRef);
  }, [itineraries]);

  useEffect(() => {
    syncStateToFirestore("tour_packages", tourPackages, tourPackagesRef);
  }, [tourPackages]);

  useEffect(() => {
    syncStateToFirestore("logs", logs, logsRef);
  }, [logs]);

  useEffect(() => {
    syncStateToFirestore("users", users, usersRef);
  }, [users]);

  useEffect(() => {
    syncStateToFirestore("notifications", notifications, notificationsRef);
  }, [notifications]);
}
