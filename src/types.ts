export interface User {
  id: string; // Document ID
  name: string;
  username: string;
  school?: string;
  location?: string;
  bio?: string;
  photoURL?: string;
  interests?: string[];
  skills?: string[];
  createdAt: number;
  updatedAt: number;
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
