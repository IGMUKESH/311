export interface Category {
  id?: string;
  name: string;
  order?: number;
  imageUrl?: string;
  createdAt: string;
  createdBy?: string;
  startTime?: string; // HH:mm format
  endTime?: string; // HH:mm format
  parentCategoryId?: string; // ID of the parent category
  isMain?: boolean; // If true, clicking this shows sub-categories in a popup
}

export interface BrandingConfig {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-center' | 'top-center' | 'custom';
  imageX?: number; // 0-100
  imageY?: number; // 0-100
  textX?: number; // 0-100
  textY?: number; // 0-100
  layout: 'horizontal' | 'vertical';
  imageStyle: 'circle' | 'square' | 'rounded' | 'hexagon' | 'star' | 'diamond' | 'shield';
  imageSize: number; // 20-200
  textSize: number; // 10-60
  showName: boolean;
  showPhone: boolean;
  showBackground: boolean;
  backgroundColor: string;
  textColor: string;
  textOutlineColor?: string;
  animationType?: string;
  animationDuration?: number;
  opacity: number;
}

export interface Quote {
  id?: string;
  text?: string;
  author?: string;
  category: string;
  imageUrl?: string;
  likesCount?: number;
  viewsCount?: number;
  downloadsCount?: number;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  branding?: BrandingConfig;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  role: 'admin' | 'sub-admin' | 'user';
  blocked?: boolean;
  downloadsCount?: number;
  isSubscribed?: boolean;
  subscriptionExpiresAt?: string;
  freeSubscription?: boolean;
}

export interface PaymentSettings {
  subscriptionPrice: number;
  freeDownloadsLimit: number;
  razorpayKeyId: string;
}

export interface Subscription {
  id?: string;
  uid: string;
  email: string;
  amount: number;
  orderId: string;
  paymentId: string;
  status: 'success' | 'failed';
  createdAt: string;
}

export interface Comment {
  id?: string;
  uid: string;
  displayName: string;
  photoURL: string;
  text: string;
  createdAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
