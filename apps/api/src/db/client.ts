import { MongoClient, MongoServerError, type Collection, type Db } from 'mongodb';
import type { Hours, WeeklyHolidayRule } from '@llhq/payroll-core';

export interface UserDoc {
  _id: string;
  name: string;
  provider: 'dev' | 'apple' | 'google' | 'kakao';
  providerId: string;
  createdAt: Date;
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
}

export interface Collections {
  users: Collection<UserDoc>;
  jobs: Collection<JobDoc>;
  workDays: Collection<WorkDayDoc>;
  weeklyHolidayPays: Collection<WeeklyHolidayPayDoc>;
  ruleSets: Collection<RuleSetDoc>;
}

export function getCollections(db: Db): Collections {
  return {
    users: db.collection<UserDoc>('users'),
    jobs: db.collection<JobDoc>('jobs'),
    workDays: db.collection<WorkDayDoc>('workDays'),
    weeklyHolidayPays: db.collection<WeeklyHolidayPayDoc>('weeklyHolidayPays'),
    ruleSets: db.collection<RuleSetDoc>('ruleSets'),
  };
}

const activeOnly = { deletedAt: { $type: 'null' } };

export async function ensureIndexes(c: Collections): Promise<void> {
  await Promise.all([
    c.users.createIndex({ provider: 1, providerId: 1 }, { unique: true, name: 'uniq_provider' }),
    c.jobs.createIndex({ userId: 1, deletedAt: 1 }, { name: 'user_jobs' }),
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
  ]);
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
