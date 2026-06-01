export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  rut: string;
  cargo: string;
  role: "user" | "admin";
  approved: boolean; // Must be approved by manager before submitting report
  createdAt: any;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  createdAt: any;
}

export interface Expense {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  category: string;
  rut: string; // OCR Extracted
  vendorName: string; // OCR Extracted
  date: string; // OCR Extracted, YYYY-MM-DD
  totalAmount: number; // OCR Extracted
  description: string;
  receiptBase64?: string; // Stored in document (compressed image/pdf base64)
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: any;
  approvedAt?: any;
  approvedBy?: any;
  approvedByName?: string;
  approvedByRut?: string;
}
