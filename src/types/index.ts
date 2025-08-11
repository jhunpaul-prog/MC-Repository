// User Types
export interface User {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  suffix?: string;
  department: string;
  employeeId: string;
  role: UserRole;
  status: UserStatus;
  startDate: string | number;
  endDate: string | number;
  photoURL?: string;
}

export type UserRole = 'Admin' | 'Resident Doctor' | 'Super Admin' | 'HR1' | '';
export type UserStatus = 'active' | 'Deactive';

// Research Paper Types
export interface ResearchPaper {
  id: string;
  title: string;
  authors: string[];
  abstract?: string;
  description?: string;
  keywords?: string[];
  indexed?: string[];
  fileName: string;
  fileUrl: string;
  pages: number;
  publicationType: string;
  publicationdate: string;
  timestamp: number;
  uploadType: 'Private' | 'Public only' | 'Private & Public';
  uploadedBy: string;
  journalname?: string;
  volume?: string;
  doi?: string;
  conferenceTitle?: string;
}

// Format Types
export interface ResearchFormat {
  id: string;
  formatName: string;
  description: string;
  fields: string[];
  requiredFields?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Bookmark Types
export interface Bookmark {
  paperId: string;
  title: string;
  collections: string[];
  savedAt: number;
  _collections?: Record<string, boolean>;
}

export interface UserBookmarks {
  [paperId: string]: Bookmark;
}

// Department Types
export interface Department {
  id: string;
  name: string;
  description: string;
  dateCreated: string;
}

// Role Types
export interface Role {
  id: string;
  Name: string;
  Access: string[];
  Type?: string;
}

// Privacy Policy Types
export interface PrivacyPolicy {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  sections: PolicySection[];
  createdAt: number;
  lastModified: number;
}

export interface PolicySection {
  sectionTitle: string;
  content: string;
}

// History Types
export interface HistoryEntry {
  id: string;
  action: string;
  by: string;
  date: string;
  title?: string;
}

export interface HistoryData {
  [key: string]: {
    [id: string]: HistoryEntry;
  };
}

// Component Props Types
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

// Search Types
export interface SearchFilters {
  year: string;
  type: string;
  author: string;
  saved: string;
}

export interface SearchOptions {
  years: string[];
  types: string[];
  authors: { uid: string; name: string }[];
  savedStatuses: string[];
}

// Upload Types
export interface UploadMetadata {
  title: string;
  authors: string[];
  abstract?: string;
  description?: string;
  keywords?: string[];
  publicationDate: string;
  journalName?: string;
  volume?: string;
  doi?: string;
  uploadType: 'Private' | 'Public only' | 'Private & Public';
}

// Form Types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'file';
  required: boolean;
  options?: string[];
  placeholder?: string;
}
