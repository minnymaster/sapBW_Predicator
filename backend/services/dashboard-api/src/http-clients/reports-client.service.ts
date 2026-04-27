import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
import { AxiosError } from 'axios';

// ---------------------------------------------------------------------------
// Локальные типы, повторяющие DTO reports-api
// ---------------------------------------------------------------------------

export interface GradeDistributionRow {
  competency_id: string;
  competency_name: string;
  k1_count: number;
  k2_count: number;
  k3_count: number;
  k4_count: number;
  k5_count: number;
  total_count: number;
}

export interface CompetencyCoverageResponse {
  data: GradeDistributionRow[];
  total: number;
  period_from: string | null;
  period_to: string | null;
  department_id: string | null;
}

export interface KpiProgressItem {
  kpi_id: string;
  competency_id: string;
  competency_name: string;
  target_grade: string;
  target_percent: number;
  period_start: string;
  period_end: string | null;
  total_employees: number;
  met_count: number;
  actual_percent: number;
  is_on_track: boolean;
}

export interface KpiProgressResponse {
  data: KpiProgressItem[];
  total: number;
  department_id: string | null;
}

export interface ReportsQuery {
  department_id?: string;
  period_from?: string;
  period_to?: string;
}

@Injectable()
export class ReportsClientService {
  private readonly logger = new Logger(ReportsClientService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('REPORTS_API_URL', 'http://reports-api:3004');
  }

  async getCompetencyCoverage(
    query: ReportsQuery,
    jwtToken: string,
  ): Promise<CompetencyCoverageResponse> {
    return this.get<CompetencyCoverageResponse>(
      '/v1/reports/competency-coverage',
      query,
      jwtToken,
    );
  }

  async getKpiProgress(
    query: ReportsQuery,
    jwtToken: string,
  ): Promise<KpiProgressResponse> {
    return this.get<KpiProgressResponse>(
      '/v1/reports/kpi-progress',
      query,
      jwtToken,
    );
  }

  private async get<T>(
    path: string,
    params: Record<string, string | undefined>,
    jwtToken: string,
  ): Promise<T> {
    // Убираем undefined-значения — axios включает их в query string как 'undefined'
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined),
    );

    try {
      const { data } = await firstValueFrom(
        this.http
          .get<T>(`${this.baseUrl}${path}`, {
            params: cleanParams,
            headers: { Authorization: `Bearer ${jwtToken}` },
          })
          .pipe(timeout(this.config.get<number>('HTTP_TIMEOUT_MS', 10_000))),
      );
      return data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      this.logger.error(
        `reports-api ${path} failed: ${axiosErr.message}`,
        axiosErr.response?.data,
      );
      throw new ServiceUnavailableException(
        `reports-api unavailable: ${axiosErr.message}`,
      );
    }
  }
}
