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
  interests?: string[];
  skills?: string[];
  visibility?: Record<string, 'public' | 'private'>;
  createdAt: number;
  updatedAt: number;
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
}

export interface Post {
  id: string; // Document ID
  authorId: string;
  content: string;
  title?: string;
  postType: 'simple' | 'showcase';
  mediaURL?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: number;
}

export interface Comment {
  id: string;
  authorId: string;
  content: string;
  createdAt: number;
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
