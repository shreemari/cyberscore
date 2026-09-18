import type {
  AcceptInviteRequest,
  AcceptInviteResponse,
  AiCompareRequest,
  AiCompareResponse,
  ChatMessageListResponse,
  ChatThread,
  ChatThreadListResponse,
  CreateChatThreadRequest,
  CreateInviteRequest,
  CreateInviteResponse,
  CreateShareRequest,
  CreateShareResponse,
  EvidenceConfirmRequest,
  EvidencePresignRequest,
  EvidencePresignResponse,
  HistoryResponse,
  InvitePreview,
  KpiListResponse,
  LoginRequest,
  LoginResponse,
  MarkNaRequest,
  MeResponse,
  PasswordResetConfirmRequest,
  PasswordResetRequestRequest,
  ProblemDetails,
  ProgressResponse,
  PushTokenRequest,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
  RevokeInviteResponse,
  RevokeMemberResponse,
  SaveProgressRequest,
  ScorecardResponse,
  SubmitKpiRequest,
  SubmitKpiResponse,
  TeamListResponse,
  TeamScorecardResponse,
  TokenPair,
  TotpSetupResponse,
  TotpVerifyRequest,
  UpdateMemberLevelsRequest,
  UpdateMemberLevelsResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '@cymetric/types';
import { ApiError, NetworkError } from './errors';

export interface TokenStorage {
  getTokens(): Promise<TokenPair | null>;
  setTokens(tokens: TokenPair): Promise<void>;
  clearTokens(): Promise<void>;
}

export interface CyMetricClientConfig {
  baseUrl: string;
  storage: TokenStorage;
  fetchImpl?: typeof fetch;
  // Called when refresh fails — mobile should route user to login.
  onAuthFailure?: () => void | Promise<void>;
  userAgent?: string;
  timeoutMs?: number;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  auth?: boolean; // default true
  headers?: Record<string, string>;
}

export class CyMetricClient {
  private readonly baseUrl: string;
  private readonly storage: TokenStorage;
  private readonly fetchImpl: typeof fetch;
  private readonly onAuthFailure?: () => void | Promise<void>;
  private readonly userAgent?: string;
  private readonly timeoutMs: number;

  // In-flight refresh promise — dedupe concurrent 401s.
  private refreshPromise: Promise<TokenPair> | null = null;

  constructor(config: CyMetricClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.storage = config.storage;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.onAuthFailure = config.onAuthFailure;
    this.userAgent = config.userAgent;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  // ------------------------------------------------------------
  // Core request logic with automatic refresh on 401
  // ------------------------------------------------------------
  private async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, query, auth = true, headers = {} } = opts;

    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const doFetch = async (accessToken: string | null): Promise<Response> => {
      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      };
      if (this.userAgent) reqHeaders['User-Agent'] = this.userAgent;
      if (auth && accessToken) reqHeaders.Authorization = `Bearer ${accessToken}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        return await this.fetchImpl(url.toString(), {
          method,
          headers: reqHeaders,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        throw new NetworkError(err);
      } finally {
        clearTimeout(timer);
      }
    };

    const tokens = auth ? await this.storage.getTokens() : null;
    let response = await doFetch(tokens?.accessToken ?? null);

    // Transparent refresh on 401 if we have a refresh token.
    if (response.status === 401 && auth && tokens?.refreshToken) {
      try {
        const fresh = await this.refreshTokens();
        response = await doFetch(fresh.accessToken);
      } catch {
        await this.storage.clearTokens();
        await this.onAuthFailure?.();
        throw await this.toApiError(response);
      }
    }

    if (!response.ok) throw await this.toApiError(response);

    // 204 No Content
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async toApiError(response: Response): Promise<ApiError> {
    let problem: ProblemDetails;
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      problem = {
        type: 'about:blank',
        title: response.statusText || 'Request failed',
        status: response.status,
      };
    }
    return new ApiError(problem);
  }

  private async refreshTokens(): Promise<TokenPair> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      const current = await this.storage.getTokens();
      if (!current?.refreshToken) throw new Error('No refresh token');

      const response = await this.fetchImpl(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });

      if (!response.ok) throw await this.toApiError(response);
      const payload = (await response.json()) as RefreshResponse;
      await this.storage.setTokens(payload.tokens);
      return payload.tokens;
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  // ------------------------------------------------------------
  // Auth
  // ------------------------------------------------------------
  auth = {
    register: (body: RegisterRequest) =>
      this.request<RegisterResponse>('/api/v1/auth/register', {
        method: 'POST',
        body,
        auth: false,
      }),

    verifyOtp: (body: VerifyOtpRequest) =>
      this.request<VerifyOtpResponse>('/api/v1/auth/verify-otp', {
        method: 'POST',
        body,
        auth: false,
      }),

    login: async (body: LoginRequest): Promise<LoginResponse> => {
      const result = await this.request<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body,
        auth: false,
      });
      await this.storage.setTokens(result.tokens);
      return result;
    },

    logout: async (): Promise<void> => {
      const current = await this.storage.getTokens();
      if (current?.refreshToken) {
        try {
          await this.request('/api/v1/auth/logout', {
            method: 'POST',
            body: { refreshToken: current.refreshToken },
          });
        } catch {
          // best-effort — clear locally regardless
        }
      }
      await this.storage.clearTokens();
    },

    me: () => this.request<MeResponse>('/api/v1/auth/me'),

    totpSetup: () =>
      this.request<TotpSetupResponse>('/api/v1/auth/totp/setup', { method: 'POST' }),

    totpVerify: (body: TotpVerifyRequest) =>
      this.request<{ enabled: boolean }>('/api/v1/auth/totp/verify', {
        method: 'POST',
        body,
      }),

    pushToken: (body: PushTokenRequest) =>
      this.request<{ ok: true }>('/api/v1/auth/push-token', {
        method: 'POST',
        body,
      }),

    // Accept-invite drops the user straight into an authenticated session,
    // so we mirror login() and persist the returned tokens before returning.
    acceptInvite: async (body: AcceptInviteRequest): Promise<AcceptInviteResponse> => {
      const result = await this.request<AcceptInviteResponse>(
        '/api/v1/auth/accept-invite',
        { method: 'POST', body, auth: false },
      );
      await this.storage.setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        refreshTokenExpiresAt: result.refreshTokenExpiresAt,
      });
      return result;
    },

    // Public: fetch invite metadata for the accept-invite landing screen.
    // Lets the mobile app show "Join Acme Corp as Employee" before the user
    // commits a password.
    invitePreview: (token: string) =>
      this.request<InvitePreview>(`/api/v1/auth/invite/${encodeURIComponent(token)}`, {
        auth: false,
      }),

    // Password reset — two-step. Step 1 enqueues an OTP email (and returns
    // `devOtp` inline when NODE_ENV=development so the mobile UI can show
    // it during development without SMTP wired up). Step 2 verifies the OTP
    // and sets the new password.
    passwordResetRequest: (body: PasswordResetRequestRequest) =>
      this.request<{ ok: true; otpSent: boolean; devOtp?: string }>(
        '/api/v1/auth/password-reset/request',
        { method: 'POST', body, auth: false },
      ),

    passwordResetConfirm: (body: PasswordResetConfirmRequest) =>
      this.request<{ ok: true }>('/api/v1/auth/password-reset/confirm', {
        method: 'POST',
        body,
        auth: false,
      }),
  };

  // ------------------------------------------------------------
  // Team admin (ENTERPRISE org admins only — server enforces role)
  // ------------------------------------------------------------
  team = {
    list: () => this.request<TeamListResponse>('/api/v1/admin/team'),

    invite: (body: CreateInviteRequest) =>
      this.request<CreateInviteResponse>('/api/v1/admin/team/invite', {
        method: 'POST',
        body,
      }),

    revokeMember: (userId: string) =>
      this.request<RevokeMemberResponse>(
        `/api/v1/admin/team/${encodeURIComponent(userId)}`,
        { method: 'DELETE' },
      ),

    updateLevels: (userId: string, body: UpdateMemberLevelsRequest) =>
      this.request<UpdateMemberLevelsResponse>(
        `/api/v1/admin/team/${encodeURIComponent(userId)}/levels`,
        { method: 'PATCH', body },
      ),

    revokeInvite: (inviteId: string) =>
      this.request<RevokeInviteResponse>(
        `/api/v1/admin/team/invite/${encodeURIComponent(inviteId)}`,
        { method: 'DELETE' },
      ),

    scorecard: () => this.request<TeamScorecardResponse>('/api/v1/admin/scorecard'),
  };

  // ------------------------------------------------------------
  // KPIs
  // ------------------------------------------------------------
  kpis = {
    list: (params?: { level?: string; framework?: string; cursor?: string }) =>
      this.request<KpiListResponse>('/api/v1/kpis', { query: params }),

    submit: (body: SubmitKpiRequest) =>
      this.request<SubmitKpiResponse>('/api/v1/kpis/submit', {
        method: 'POST',
        body,
      }),

    // kpiId is carried in the presign body — the API route is flat under /evidence.
    evidencePresign: (_kpiId: string, body: EvidencePresignRequest) =>
      this.request<EvidencePresignResponse>('/api/v1/evidence/presign', {
        method: 'POST',
        body,
      }),

    evidenceConfirm: (_kpiId: string, body: EvidenceConfirmRequest) =>
      this.request<{ ok: true; attachmentId: string }>('/api/v1/evidence/confirm', {
        method: 'POST',
        body,
      }),

    markNa: (body: MarkNaRequest) =>
      this.request<{ ok: true }>('/api/v1/kpis/na', {
        method: 'POST',
        body,
      }),
  };

  // ------------------------------------------------------------
  // Scorecard & progress
  // ------------------------------------------------------------
  scorecard = {
    current: () => this.request<ScorecardResponse>('/api/v1/scorecard'),
    history: () => this.request<HistoryResponse>('/api/v1/scorecard/history'),
    createShare: (body: CreateShareRequest) =>
      this.request<CreateShareResponse>('/api/v1/share', {
        method: 'POST',
        body,
      }),
    share: (token: string) =>
      this.request<ScorecardResponse>(
        `/api/v1/share/public/${encodeURIComponent(token)}`,
        { auth: false },
      ),
  };

  progress = {
    get: () => this.request<ProgressResponse>('/api/v1/progress'),
    save: (body: SaveProgressRequest) =>
      this.request<{ ok: true }>('/api/v1/progress', { method: 'POST', body }),
  };

  // ------------------------------------------------------------
  // AI
  // ------------------------------------------------------------
  ai = {
    compare: (body: AiCompareRequest = { includeRiskFlags: true }) =>
      this.request<AiCompareResponse>('/api/v1/ai/compare', {
        method: 'POST',
        body,
      }),
  };

  // ------------------------------------------------------------
  // Chat (conversational AI advisor)
  // ------------------------------------------------------------
  chat = {
    listThreads: () =>
      this.request<ChatThreadListResponse>('/api/v1/ai/chat/threads'),

    createThread: (body: CreateChatThreadRequest = {}) =>
      this.request<ChatThread>('/api/v1/ai/chat/threads', {
        method: 'POST',
        body,
      }),

    renameThread: (threadId: string, title: string) =>
      this.request<{ ok: true }>(
        `/api/v1/ai/chat/threads/${encodeURIComponent(threadId)}`,
        { method: 'PATCH', body: { title } },
      ),

    deleteThread: (threadId: string) =>
      this.request<{ ok: true }>(
        `/api/v1/ai/chat/threads/${encodeURIComponent(threadId)}`,
        { method: 'DELETE' },
      ),

    getMessages: (threadId: string) =>
      this.request<ChatMessageListResponse>(
        `/api/v1/ai/chat/threads/${encodeURIComponent(threadId)}/messages`,
      ),

    // Streaming send lives in the mobile app — see
    // apps/mobile/src/lib/chatStream.ts. React Native's old-arch fetch can't
    // expose a streaming response body, so we use react-native-sse there
    // rather than baking an RN dependency into the SDK.
  };
}

export function createCyMetricClient(config: CyMetricClientConfig): CyMetricClient {
  return new CyMetricClient(config);
}
