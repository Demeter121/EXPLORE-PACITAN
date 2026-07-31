/**
 * Types definition for Explore Pacitan (explorepacitan.com)
 */

export type UserRole = "user" | "pengelola" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  password?: string;
  managedLocations?: string[]; // For 'pengelola' to manage specific approved locations
  language?: "id" | "en";
  lastUsernameChange?: string; // ISO timestamp of the last username change
}

export type LocationCategory = "wisata" | "penginapan" | "makan" | "coffeeshop" | "belanja" | "lainnya";

export interface Location {
  id: string;
  name: string;
  category: LocationCategory;
  description: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  address: string;
  photos: string[];
  status: "approved" | "inactive";
  createdBy: string; // userId
  createdAt: string;
  updatedAt: string;
  ratingAverage: number;
  reviewCount: number;
  openingHours?: string;
  priceRange?: string; // e.g. "Rp 5.000 - Rp 15.000"
  contact?: string; // e.g. "+62812345678"
}

export type SubmissionStatus = "pending" | "approved" | "rejected" | "revision_requested";
export type SubmissionType = "create" | "update";

export interface LocationSubmission {
  id: string;
  targetLocationId: string | null; // null for create, locationId for edit updates
  submissionType: SubmissionType;
  // Submited payload representing partial or full location details
  payload: {
    name: string;
    category: LocationCategory;
    description: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    address: string;
    photos: string[];
    openingHours?: string;
    priceRange?: string;
    contact?: string;
  };
  submittedBy: string; // userId
  submittedByName: string;
  submitterRole: UserRole;
  status: SubmissionStatus;
  reviewedBy: string | null; // admin userId
  reviewedByName: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItineraryItem {
  locationId: string;
  timeSlot?: string; // e.g. "08:00 - 10:00" or just free text "Pagi"
  note?: string;
}

export interface ItineraryDay {
  dayNumber: number;
  items: ItineraryItem[];
}

export interface Itinerary {
  id: string;
  title: string;
  description: string;
  days: ItineraryDay[];
  isPublic: boolean;
  createdBy: string; // userId
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  locationId: string;
  userEmail: string;
  userName: string;
  userId: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

export interface ModerationLog {
  id: string;
  action: "approve" | "reject" | "request_revision";
  submissionId: string;
  targetName: string;
  adminId: string;
  adminEmail: string;
  timestamp: string;
  reason: string;
}

export interface TourPackage {
  id: string;
  title: string;
  provider: string;
  duration: string;
  price: string;
  category: "adventure" | "family" | "couple" | "cultural";
  description: string;
  destinations: string[];
  includes: string[];
  contactWhatsApp: string;
  photo: string;
  rating: number;
  reviewsCount: number;
  createdBy?: string;
}

export interface AdminNotification {
  id: string;
  senderId: string;
  senderName: string;
  targetRole: "all" | "user" | "pengelola" | "specific";
  targetUserId?: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "alert";
  createdAt: string;
  readBy: string[]; // array of userIds who have marked this notification as read
}

export type AiProviderPreset = "openrouter" | "openai" | "groq" | "gemini_openai" | "ollama" | "custom";

export interface AiConfig {
  provider: AiProviderPreset;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  isValidated: boolean;
  enabled: boolean;
  lastTestedAt?: string;
  validationMessage?: string;
}

export interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: string;
}

