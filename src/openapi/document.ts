// Tài liệu OpenAPI 3.1 sinh từ chính các schema zod server dùng để kiểm tra dữ liệu,
// nên tài liệu không lệch với code. App sinh kiểu TypeScript từ file openapi.json (pnpm openapi).
import { z } from 'zod';
import { AuditQuery } from '../routes/admin.ts';
import { CreateJobRequest } from '../routes/jobs.ts';
import {
  DevLoginRequest,
  LogoutRequest,
  MonthString,
  RefreshRequest,
  RuleSetInput,
  SocialLoginRequest,
  SyncRequest,
  UserSettingsInput,
  WorkDayInput,
} from '../schemas/index.ts';
import * as R from './responses.ts';

type Schema = z.ZodType;
type Auth = 'none' | 'user' | 'admin';

interface Operation {
  method: 'get' | 'post' | 'put' | 'delete';
  /** Đường dẫn kiểu OpenAPI: /v1/work-days/{id} */
  path: string;
  operationId: string;
  tag: string;
  summary: string;
  description?: string;
  auth: Auth;
  pathParams?: Record<string, { description: string; schema: Schema }>;
  query?: z.ZodObject;
  body?: Schema;
  /** Mã thành công → schema (undefined là không có body) */
  ok: Record<number, { description: string; schema?: Schema }>;
  /** Các lỗi riêng của route, ngoài lỗi chung theo auth/body */
  errors?: Record<number, string>;
}

/** Schema có tên trong components.schemas; schema không có trong đây thì viết thẳng vào chỗ dùng. */
const NAMED: [string, Schema, 'input' | 'output'][] = [
  ['ErrorResponse', R.ErrorResponse, 'output'],
  ['HealthResponse', R.HealthResponse, 'output'],
  ['AppConfigResponse', R.AppConfigResponse, 'output'],
  ['RulesResponse', R.RulesResponse, 'output'],
  ['AdminRulesResponse', R.AdminRulesResponse, 'output'],
  ['AdminRulesList', R.AdminRulesList, 'output'],
  ['AuditLogList', R.AuditLogList, 'output'],
  ['TokenPairResponse', R.TokenPairResponse, 'output'],
  ['AuthResponse', R.AuthResponse, 'output'],
  ['JobResponse', R.JobResponse, 'output'],
  ['JobList', R.JobList, 'output'],
  ['WorkDayResponse', R.WorkDayResponse, 'output'],
  ['WorkDaysMonthResponse', R.WorkDaysMonthResponse, 'output'],
  ['SyncResponse', R.SyncResponse, 'output'],
  ['MeResponse', R.MeResponse, 'output'],
  ['UserSettingsResponse', R.UserSettingsResponse, 'output'],
  ['RefreshRequest', RefreshRequest, 'input'],
  ['LogoutRequest', LogoutRequest, 'input'],
  ['DevLoginRequest', DevLoginRequest, 'input'],
  ['SocialLoginRequest', SocialLoginRequest, 'input'],
  ['CreateJobRequest', CreateJobRequest, 'input'],
  ['WorkDayInput', WorkDayInput, 'input'],
  ['SyncRequest', SyncRequest, 'input'],
  ['UserSettingsInput', UserSettingsInput, 'input'],
  ['RuleSetInput', RuleSetInput, 'input'],
];

const UUID = z.uuid();
const YEAR = z.string().regex(/^\d{4}$/);

export const OPERATIONS: Operation[] = [
  {
    method: 'get', path: '/health', operationId: 'getHealth', tag: 'Hệ thống', auth: 'none',
    summary: 'Trạng thái server và kết nối MongoDB',
    ok: { 200: { description: 'Server và MongoDB đều ổn', schema: R.HealthResponse } },
    errors: { 503: 'MongoDB mất kết nối (body vẫn là HealthResponse với status = degraded)' },
  },
  {
    method: 'get', path: '/v1/config', operationId: 'getAppConfig', tag: 'Hệ thống', auth: 'none',
    summary: 'Cấu hình app: quảng cáo, phiên bản app tối thiểu',
    description: 'App lưu đệm 12 giờ.',
    ok: { 200: { description: 'Cấu hình hiện tại', schema: R.AppConfigResponse } },
  },
  {
    method: 'post', path: '/v1/auth/dev-login', operationId: 'devLogin', tag: 'Đăng nhập', auth: 'none',
    summary: 'Đăng nhập bằng tên (chỉ có ngoài production)',
    body: DevLoginRequest,
    ok: { 200: { description: 'Cặp token và người dùng', schema: R.AuthResponse } },
  },
  {
    method: 'post', path: '/v1/auth/apple', operationId: 'appleLogin', tag: 'Đăng nhập', auth: 'none',
    summary: 'Đổi id token Apple lấy cặp token',
    body: SocialLoginRequest,
    ok: { 200: { description: 'Cặp token và người dùng', schema: R.AuthResponse } },
    errors: { 401: 'invalid_token: id token sai hoặc hết hạn', 503: 'provider_not_configured' },
  },
  {
    method: 'post', path: '/v1/auth/google', operationId: 'googleLogin', tag: 'Đăng nhập', auth: 'none',
    summary: 'Đổi id token Google lấy cặp token',
    body: SocialLoginRequest,
    ok: { 200: { description: 'Cặp token và người dùng', schema: R.AuthResponse } },
    errors: { 401: 'invalid_token: id token sai hoặc hết hạn', 503: 'provider_not_configured' },
  },
  {
    method: 'post', path: '/v1/auth/refresh', operationId: 'refreshToken', tag: 'Đăng nhập', auth: 'none',
    summary: 'Đổi refresh token lấy cặp token mới (xoay vòng)',
    description: 'Gửi lại token đã dùng thì mọi phiên của người dùng bị thu hồi.',
    body: RefreshRequest,
    ok: { 200: { description: 'Cặp token mới', schema: R.TokenPairResponse } },
    errors: { 401: 'invalid_token' },
  },
  {
    method: 'post', path: '/v1/auth/logout', operationId: 'logout', tag: 'Đăng nhập', auth: 'none',
    summary: 'Thu hồi phiên của refresh token',
    description: 'Luôn 204 khi body hợp lệ, kể cả token hỏng.',
    body: LogoutRequest,
    ok: { 204: { description: 'Đã đăng xuất' } },
  },
  {
    method: 'get', path: '/v1/rules/{year}', operationId: 'getRules', tag: 'Quy định', auth: 'none',
    summary: 'Quy định của năm: lương tối thiểu, ngày lễ, điều kiện 주휴수당',
    pathParams: { year: { description: 'Năm 4 chữ số', schema: YEAR } },
    ok: { 200: { description: 'Quy định của năm', schema: R.RulesResponse } },
    errors: { 400: 'bad_year', 404: 'not_found: chưa có quy định cho năm này' },
  },
  {
    method: 'get', path: '/v1/jobs', operationId: 'listJobs', tag: 'Nơi làm việc', auth: 'user',
    summary: 'Nơi làm việc chưa xóa',
    ok: { 200: { description: 'Danh sách nơi làm', schema: R.JobList } },
  },
  {
    method: 'post', path: '/v1/jobs', operationId: 'createJob', tag: 'Nơi làm việc', auth: 'user',
    summary: 'Thêm nơi làm việc (id do app tạo, không bắt buộc)',
    body: CreateJobRequest,
    ok: { 201: { description: 'Nơi làm vừa tạo', schema: R.JobResponse } },
    errors: { 409: 'job_exists' },
  },
  {
    method: 'get', path: '/v1/work-days', operationId: 'listWorkDays', tag: 'Ngày công', auth: 'user',
    summary: 'Ngày công trong tháng kèm tổng lương',
    query: z.object({ month: MonthString, jobId: z.string().optional() }),
    ok: { 200: { description: 'Ngày công và tổng tháng', schema: R.WorkDaysMonthResponse } },
  },
  {
    method: 'put', path: '/v1/work-days/{id}', operationId: 'putWorkDay', tag: 'Ngày công', auth: 'user',
    summary: 'Tạo hoặc sửa một ngày công (bản sửa mới nhất thắng)',
    pathParams: { id: { description: 'UUID do app tạo', schema: UUID } },
    body: WorkDayInput,
    ok: { 200: { description: 'Ngày công đã ghi', schema: R.WorkDayResponse } },
    errors: { 409: 'stale_update (details là bản server) hoặc duplicate_day' },
  },
  {
    method: 'delete', path: '/v1/work-days/{id}', operationId: 'deleteWorkDay', tag: 'Ngày công', auth: 'user',
    summary: 'Xóa mềm một ngày công',
    pathParams: { id: { description: 'UUID ngày công', schema: UUID } },
    ok: { 204: { description: 'Đã xóa' } },
    errors: { 404: 'not_found' },
  },
  {
    method: 'post', path: '/v1/sync', operationId: 'sync', tag: 'Đồng bộ', auth: 'user',
    summary: 'Đồng bộ hai chiều nơi làm, ngày công, 주휴수당, cài đặt, firstOpenAt',
    description:
      'Đẩy các bản thay đổi (tối đa 500 mỗi loại), nhận về mọi bản có serverUpdatedAt sau since. ' +
      'Nếu hasMore = true thì gọi lại ngay với since = serverTime.',
    body: SyncRequest,
    ok: { 200: { description: 'Kết quả từng bản gửi lên và dữ liệu kéo về', schema: R.SyncResponse } },
  },
  {
    method: 'get', path: '/v1/me', operationId: 'getMe', tag: 'Tài khoản', auth: 'user',
    summary: 'Thông tin tài khoản và cài đặt đã đồng bộ',
    ok: { 200: { description: 'Tài khoản', schema: R.MeResponse } },
  },
  {
    method: 'put', path: '/v1/me/settings', operationId: 'putSettings', tag: 'Tài khoản', auth: 'user',
    summary: 'Sửa cài đặt (bản sửa mới nhất thắng)',
    body: UserSettingsInput,
    ok: { 200: { description: 'Cài đặt đã ghi', schema: R.UserSettingsResponse } },
    errors: { 409: 'stale_update (details là bản server)' },
  },
  {
    method: 'delete', path: '/v1/me', operationId: 'deleteMe', tag: 'Tài khoản', auth: 'user',
    summary: 'Xóa tài khoản và toàn bộ dữ liệu trên server',
    ok: { 204: { description: 'Đã xóa' } },
  },
  {
    method: 'get', path: '/v1/admin/rules', operationId: 'adminListRules', tag: 'Quản trị', auth: 'admin',
    summary: 'Quy định các năm',
    ok: { 200: { description: 'Danh sách quy định', schema: R.AdminRulesList } },
  },
  {
    method: 'put', path: '/v1/admin/rules/{year}', operationId: 'adminPutRules', tag: 'Quản trị', auth: 'admin',
    summary: 'Tạo hoặc thay quy định một năm, ghi nhật ký',
    pathParams: { year: { description: 'Năm 4 chữ số', schema: YEAR } },
    body: RuleSetInput,
    ok: { 200: { description: 'Quy định đã ghi', schema: R.AdminRulesResponse } },
    errors: { 400: 'bad_year' },
  },
  {
    method: 'get', path: '/v1/admin/audit-logs', operationId: 'adminAuditLogs', tag: 'Quản trị', auth: 'admin',
    summary: 'Nhật ký thay đổi, mới nhất trước',
    query: AuditQuery,
    ok: { 200: { description: 'Nhật ký', schema: R.AuditLogList } },
  },
];

function jsonSchema(schema: Schema, io: 'input' | 'output'): Record<string, unknown> {
  const out = z.toJSONSchema(schema, { io, unrepresentable: 'any', target: 'draft-2020-12' }) as Record<string, unknown>;
  delete out.$schema;
  return out;
}

const ERROR_REF = { $ref: '#/components/schemas/ErrorResponse' };

export function buildOpenApiDocument() {
  const names = new Map<Schema, string>(NAMED.map(([name, s]) => [s, name]));
  const schemaRef = (s: Schema, io: 'input' | 'output') => {
    const name = names.get(s);
    return name ? { $ref: `#/components/schemas/${name}` } : jsonSchema(s, io);
  };

  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of OPERATIONS) {
    const parameters: unknown[] = [];
    for (const [name, p] of Object.entries(op.pathParams ?? {})) {
      parameters.push({ name, in: 'path', required: true, description: p.description, schema: jsonSchema(p.schema, 'input') });
    }
    if (op.query) {
      const q = jsonSchema(op.query, 'input') as { properties?: Record<string, unknown>; required?: string[] };
      for (const [name, schema] of Object.entries(q.properties ?? {})) {
        parameters.push({ name, in: 'query', required: q.required?.includes(name) ?? false, schema });
      }
    }

    const responses: Record<string, unknown> = {};
    for (const [status, r] of Object.entries(op.ok)) {
      responses[status] = r.schema
        ? { description: r.description, content: { 'application/json': { schema: schemaRef(r.schema, 'output') } } }
        : { description: r.description };
    }
    const errors: Record<number, string> = {};
    if (op.auth !== 'none') errors[401] = 'unauthorized (thiếu token) hoặc invalid_token';
    if (op.auth === 'admin') errors[403] = 'forbidden: không phải admin';
    if (op.body || op.query || op.pathParams) errors[422] = 'validation_failed: details là danh sách { path, message }';
    if (op.body) errors[415] = 'unsupported_media_type';
    errors[429] = 'rate_limited';
    Object.assign(errors, op.errors);
    for (const [status, description] of Object.entries(errors)) {
      responses[status] =
        op.path === '/health' && status === '503'
          ? { description, content: { 'application/json': { schema: schemaRef(R.HealthResponse, 'output') } } }
          : { description, content: { 'application/json': { schema: ERROR_REF } } };
    }

    paths[op.path] ??= {};
    paths[op.path]![op.method] = {
      operationId: op.operationId,
      tags: [op.tag],
      summary: op.summary,
      ...(op.description ? { description: op.description } : {}),
      ...(op.auth === 'none' ? { security: [] } : {}),
      ...(parameters.length ? { parameters } : {}),
      ...(op.body
        ? { requestBody: { required: true, content: { 'application/json': { schema: schemaRef(op.body, 'input') } } } }
        : {}),
      responses,
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Lịch Lương Hàn Quốc API',
      version: '1.0.0',
      description:
        'API của app Lịch Lương Hàn Quốc. Tiền là số nguyên won; ngày là chuỗi "YYYY-MM-DD" theo giờ Hàn Quốc. ' +
        'Lỗi luôn có dạng ErrorResponse.',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Dev' }],
    security: [{ bearerAuth: [] }],
    tags: [...new Set(OPERATIONS.map((o) => o.tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: Object.fromEntries(NAMED.map(([name, s, io]) => [name, jsonSchema(s, io)])),
    },
  };
}

/** Đường dẫn OpenAPI → đường dẫn của router: /v1/work-days/{id} → /v1/work-days/:id */
export const toRouterPath = (p: string) => p.replace(/\{(\w+)\}/g, ':$1');
