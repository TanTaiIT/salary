// Schema zod của dữ liệu server TRẢ VỀ, chỉ dùng để sinh tài liệu OpenAPI và kiểm tra trong test.
// Dữ liệu gửi lên đã có schema trong src/schemas (dùng chung với app); file này chỉ ở server.
import { z } from 'zod';
import { AdConfig, HoursSchema } from '../schemas/index.ts';

const IsoDateTime = z.iso.datetime();
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('"YYYY-MM-DD" theo giờ Hàn Quốc');
const Won = z.number().int().describe('Số nguyên won');

export const ErrorResponse = z.object({
  error: z.object({
    code: z.string().describe('Mã lỗi để app xử lý, ví dụ validation_failed, stale_update'),
    message: z.string().describe('Thông báo tiếng Việt'),
    details: z.unknown().optional(),
  }),
  requestId: z.string(),
});

export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.boolean(),
  uptime: z.number().int(),
});

export const AppConfigResponse = z.object({
  ads: AdConfig,
  minAppVersion: z.string(),
  updatedAt: IsoDateTime.nullable(),
});

export const RulesResponse = z.object({
  year: z.number().int(),
  minimumWage: Won,
  holidays: z.array(z.object({ date: DateOnly, name: z.string() })),
  weeklyHoliday: z.object({ minHours: z.number(), maxHours: z.number(), paidHours: z.number() }),
  updatedAt: IsoDateTime,
});

export const AdminRulesResponse = RulesResponse.extend({ updatedBy: z.string().nullable() });
export const AdminRulesList = z.object({ items: z.array(AdminRulesResponse) });

export const AuditLogResponse = z.object({
  id: z.string(),
  actorId: z.string(),
  action: z.string(),
  target: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  at: IsoDateTime,
});
export const AuditLogList = z.object({ items: z.array(AuditLogResponse) });

export const TokenPairResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string().describe('Xoay vòng: lưu bản mới sau mỗi lần refresh, không gọi refresh song song'),
  expiresIn: z.number().int().describe('Số giây access token còn hiệu lực'),
});

export const AuthResponse = TokenPairResponse.extend({
  user: z.object({ id: z.string(), name: z.string() }),
});

export const JobResponse = z.object({
  id: z.string(),
  name: z.string(),
  hourlyWage: Won,
  companySize: z.enum(['under5', '5plus']),
  updatedAt: IsoDateTime,
});
export const JobList = z.object({ items: z.array(JobResponse) });
export const SyncJob = JobResponse.extend({ deletedAt: IsoDateTime.nullable() });

export const DayPayResponse = z.object({ work: Won, allowance: Won, total: Won });

export const WorkDayResponse = z.object({
  id: z.string(),
  jobId: z.string(),
  date: DateOnly,
  hours: HoursSchema,
  allowance: Won,
  wageSnapshot: Won,
  updatedAt: IsoDateTime,
  deletedAt: IsoDateTime.nullable(),
  pay: DayPayResponse,
});

const HourAmounts = z.object({ x1: z.number(), x1_5: z.number(), x2: z.number(), x2_5: z.number(), x3: z.number() });

export const MonthSummaryResponse = z.object({
  total: Won,
  workPay: Won,
  allowance: Won,
  weeklyHolidayPay: Won,
  baseHours: z.number(),
  overtimeHours: z.number(),
  hoursByType: HourAmounts,
  payByType: HourAmounts.describe('Tiền công theo loại giờ, mỗi loại bỏ phần lẻ một lần'),
  workDays: z.number().int(),
});

export const WorkDaysMonthResponse = z.object({
  month: z.string(),
  items: z.array(WorkDayResponse),
  summary: MonthSummaryResponse,
});

export const WeeklyHolidayPayResponse = z.object({
  id: z.string(),
  jobId: z.string(),
  weekStart: DateOnly,
  amount: Won,
  updatedAt: IsoDateTime,
  deletedAt: IsoDateTime.nullable(),
});

export const ChangeResult = z.object({
  id: z.string(),
  status: z.enum(['applied', 'stale', 'rejected']),
  code: z.string().optional().describe('Mã lỗi khi rejected: duplicate_day, duplicate_week, unknown_job, not_found…'),
});

export const UserSettingsResponse = z.object({ deductRate: z.number(), updatedAt: IsoDateTime });

export const SyncResponse = z.object({
  serverTime: IsoDateTime.describe('Gửi lại làm "since" ở lần đồng bộ sau'),
  jobResults: z.array(ChangeResult),
  results: z.array(ChangeResult).describe('Kết quả từng ngày công đã gửi'),
  weeklyHolidayPayResults: z.array(ChangeResult),
  jobs: z.array(SyncJob),
  workDays: z.array(WorkDayResponse),
  weeklyHolidayPays: z.array(WeeklyHolidayPayResponse),
  firstOpenAt: IsoDateTime.nullable(),
  settingsResult: z.enum(['applied', 'stale']).nullable(),
  settings: UserSettingsResponse.nullable(),
  hasMore: z.boolean().describe('true thì gọi lại ngay với since = serverTime'),
});

export const MeResponse = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(['dev', 'apple', 'google', 'kakao']),
  firstOpenAt: IsoDateTime,
  settings: UserSettingsResponse.nullable(),
});
