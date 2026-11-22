import { MongoClient, MongoServerError, type ClientSession, type Collection, type Db } from 'mongodb';
import type { Hours, WeeklyHolidayRule } from '../payroll/index.ts';
import type { AdConfig } from '../schemas/ads.ts';

export interface UserDoc {
  _id: string;
  name: string;
  provider: 'dev' | 'apple' | 'google' | 'kakao';
  providerId: string;
  /** Thiếu trường này nghĩa là "user". Quyền admin luôn đọc từ đây, không tin vào token. */
  role?: 'user' | 'admin';
  /** Lần mở app sớm nhất trên mọi máy của người dùng, dùng để tính cấp quảng cáo */
  firstSeenAt?: Date;
  /** Cài đặt đồng bộ giữa các máy; chưa có nghĩa là người dùng chưa đổi lần nào */
  settings?: UserSettingsDoc;
  createdAt: Date;
}

export interface UserSettingsDoc {
  /** Tỉ lệ khấu trừ ước tính lương thực nhận, phần trăm */
  deductRate: number;
  /** Thời điểm sửa trên máy người dùng, dùng để giải quyết xung đột */
  updatedAt: Date;
}

export interface JobDoc {
  _id: string;
  userId: string;
  name: string;
  hourlyWage: number;
  companySize: 'under5' | '5plus';
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  serverUpdatedAt: Date;
}

export interface WorkDayDoc {
  /** UUID do app tạo, để tạo ngày công khi offline rồi đồng bộ sau */
  _id: string;
  userId: string;
  jobId: string;
  /** "YYYY-MM-DD" theo giờ Hàn Quốc, cố ý không dùng kiểu Date */
  date: string;
  hours: Hours;
  allowance: number;
  wageSnapshot: number;
  /** Thời điểm sửa trên máy người dùng, dùng để giải quyết xung đột */
  updatedAt: Date;
  deletedAt: Date | null;
  /** Thời điểm server ghi nhận, dùng làm mốc kéo dữ liệu khi đồng bộ */
  serverUpdatedAt: Date;
}

export interface WeeklyHolidayPayDoc {
  _id: string;
  userId: string;
  jobId: string;
  /** Thứ Hai đầu tuần, "YYYY-MM-DD" */
  weekStart: string;
  amount: number;
  updatedAt: Date;
  deletedAt: Date | null;
  serverUpdatedAt: Date;
}

export interface RuleSetDoc {
  /** Năm dạng chuỗi, ví dụ "2026" */
  _id: string;
  year: number;
  minimumWage: number;
  holidays: { date: string; name: string }[];
  weeklyHoliday: WeeklyHolidayRule;
  updatedAt: Date;
  /** userId của admin sửa gần nhất; không trả ra API công khai */
  updatedBy?: string;
}

export interface AppConfigDoc {
  _id: 'current';
  ads: AdConfig;
  minAppVersion: string;
  updatedAt: Date;
}

export interface AuditLogDoc {
  _id: string;
  actorId: string;
  action: string;
  /** Ví dụ "ruleSets/2026" */
  target: string;
  before: unknown;
  after: unknown;
  at: Date;
}

/** Một phiên đăng nhập, gắn với một refresh token. MongoDB tự xóa khi qua expiresAt (index TTL). */
export interface SessionDoc {
  /** jti của refresh token */
  _id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  /** Thời điểm token này đã được đổi lấy token mới; gửi lại sau đó là dấu hiệu token bị lộ */
  rotatedAt: Date | null;
}

export interface Collections {
  users: Collection<UserDoc>;
  jobs: Collection<JobDoc>;
  workDays: Collection<WorkDayDoc>;
  weeklyHolidayPays: Collection<WeeklyHolidayPayDoc>;
  ruleSets: Collection<RuleSetDoc>;
  appConfig: Collection<AppConfigDoc>;
  auditLogs: Collection<AuditLogDoc>;
  sessions: Collection<SessionDoc>;
}

export function getCollections(db: Db): Collections {
  return {
    users: db.collection<UserDoc>('users'),
    jobs: db.collection<JobDoc>('jobs'),
    workDays: db.collection<WorkDayDoc>('workDays'),
    weeklyHolidayPays: db.collection<WeeklyHolidayPayDoc>('weeklyHolidayPays'),
    ruleSets: db.collection<RuleSetDoc>('ruleSets'),
    appConfig: db.collection<AppConfigDoc>('appConfig'),
    auditLogs: db.collection<AuditLogDoc>('auditLogs'),
    sessions: db.collection<SessionDoc>('sessions'),
  };
}

const activeOnly = { deletedAt: { $type: 'null' } };

export async function ensureIndexes(c: Collections): Promise<void> {
  await Promise.all([
    c.users.createIndex({ provider: 1, providerId: 1 }, { unique: true, name: 'uniq_provider' }),
    c.jobs.createIndex({ userId: 1, deletedAt: 1 }, { name: 'user_jobs' }),
    c.jobs.createIndex({ userId: 1, serverUpdatedAt: 1 }, { name: 'user_sync' }),
    c.auditLogs.createIndex({ target: 1, at: -1 }, { name: 'target_at' }),
    // Mỗi người, mỗi nơi làm, mỗi ngày chỉ có một ngày công đang hoạt động
    c.workDays.createIndex(
      { userId: 1, jobId: 1, date: 1 },
      { unique: true, partialFilterExpression: activeOnly, name: 'uniq_active_day' },
    ),
    c.workDays.createIndex({ userId: 1, date: 1 }, { name: 'user_date' }),
    c.workDays.createIndex({ userId: 1, serverUpdatedAt: 1 }, { name: 'user_sync' }),
    c.weeklyHolidayPays.createIndex(
      { userId: 1, jobId: 1, weekStart: 1 },
      { unique: true, partialFilterExpression: activeOnly, name: 'uniq_active_week' },
    ),
    c.weeklyHolidayPays.createIndex({ userId: 1, serverUpdatedAt: 1 }, { name: 'user_sync' }),
    c.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expires' }),
    c.sessions.createIndex({ userId: 1 }, { name: 'user_sessions' }),
  ]);
}

/** Chạy fn trong một transaction; session undefined nghĩa là không có transaction (bản giả trong test). */
export type WithTransaction = <T>(fn: (session: ClientSession | undefined) => Promise<T>) => Promise<T>;

/** Transaction cần MongoDB chạy replica set (docker-compose.yml, Atlas đều đã là replica set). */
export function transactionRunner(client: MongoClient): WithTransaction {
  return (fn) => client.withSession((session) => session.withTransaction(() => fn(session)));
}

export async function connectMongo(uri: string, dbName: string) {
  const client = new MongoClient(uri, {
    appName: 'llhq-api',
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5_000,
  });
  await client.connect();
  return { client, db: client.db(dbName) };
}

export const isDuplicateKey = (err: unknown): boolean => err instanceof MongoServerError && err.code === 11000;
