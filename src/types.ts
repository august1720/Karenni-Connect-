export interface User {
  id: string; // Document ID
  name: string;
  username: string;
  educationLevel?: string;
  school?: string;
  studentId?: string;
  educationDescription?: string;
  location?: string;
  bio?: string;
  photoURL?: string;
  majorEthnicity?: string;
  subEthnicity?: string;
  customEthnicity?: string;
  gender?: 'Male' | 'Female' | 'Non-binary' | string;
  interests?: string[];
  skills?: string[];
  isVerified?: boolean;
  isMentor?: boolean;
  mentorBio?: string;
  mentorSubjects?: string[];
  mentorAvailability?: string;
  visibility?: Record<string, 'public' | 'private'>;
  createdAt: number;
  updatedAt: number;
  lastSeen?: number;
  settings?: {
    theme?: string;
    language?: string;
    isPrivate?: boolean;
    notifications?: {
      push?: boolean;
      messages?: boolean;
      events?: boolean;
    };
    media?: {
      compress?: boolean;
    };
    accessibility?: {
      largerText?: boolean;
    };
  };
}

export interface School {
  id: string; // Document ID
  name: string;
  description?: string;
  clubs?: string[];
  photoURL?: string;
  studentCount?: number;
  ownerId: string;
  createdAt: number;
}

export interface Event {
  id: string; // Document ID
  title: string;
  description: string;
  date: number;
  joinLink?: string;
  schoolId?: string;
  creatorId: string;
  createdAt: number;
  type?: string;
  time?: string;
  category?: string;
  attendees?: string[];
}

export interface Post {
  id: string; // Document ID
  authorId: string;
  content: string;
  title?: string;
  postType: 'simple' | 'showcase';
  mediaURL?: string;
  audioURL?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: number;
  isFlagged?: boolean;
  flaggedCategory?: string;
  flaggedReason?: string;
  moderationStatus?: string;
  sharedPostId?: string;
  sharedPostAuthorId?: string;
  sharedPostAuthorName?: string;
  sharedPostContent?: string;
  sharedPostMediaURL?: string;
  sharedPostAudioURL?: string;
  attachmentURL?: string;
  attachmentName?: string;
  attachmentType?: 'pdf' | 'word' | 'powerpoint' | 'youtube' | 'website' | string;
  attachmentLink?: string;
}

export interface Comment {
  id: string;
  authorId: string;
  content: string;
  audioURL?: string;
  createdAt: number;
  isFlagged?: boolean;
  flaggedCategory?: string;
  flaggedReason?: string;
  moderationStatus?: string;
}

export interface Like {
  id: string;
  userId: string;
  createdAt: number;
}

export interface Follow {
  id: string;
  createdAt: number;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'event';
  fromUserId: string;
  postId?: string;
  eventId?: string;
  read: boolean;
  createdAt: number;
}
