import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Material, MaterialVersion, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { MaterialResponseDto, MaterialVersionDto } from './dto/material-response.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

// SHA-256 от идентификатора контента (fileKey или URL).
// При изменении fileKey/url хэш меняется → гарантирует NFR-18.
const PROMPT_CONTENT_HASH = 'sha256(fileKey ?? url ?? "")';
function computeContentHash(fileKey?: string | null, url?: string | null): string {
  const raw = fileKey ?? url ?? '';
  return createHash('sha256').update(raw).digest('hex');
}

type MaterialWithVersion = Material & {
  versions: MaterialVersion[];
};

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // GET /v1/materials/:id
  // ---------------------------------------------------------------------------

  async findOne(id: string): Promise<MaterialResponseDto> {
    const material = await this.prisma.material.findUnique({
      where: { materialId: id },
      include: {
        versions: {
          where: { isCurrent: true },
          take: 1,
        },
      },
    });

    if (!material) throw new NotFoundException(`Material ${id} not found`);
    return this.mapToDto(material as MaterialWithVersion);
  }

  // ---------------------------------------------------------------------------
  // POST /v1/materials — создать материал + MaterialVersion v1 с contentHash
  // ---------------------------------------------------------------------------

  async create(dto: CreateMaterialDto, userId: string): Promise<MaterialResponseDto> {
    this.validateContentSource(dto.fileKey, dto.url, dto.type);

    // Проверяем, что модуль существует
    const moduleExists = await this.prisma.module.findUnique({
      where: { moduleId: dto.moduleId },
      select: { moduleId: true },
    });
    if (!moduleExists) {
      throw new NotFoundException(`Module ${dto.moduleId} not found`);
    }

    // contentHash = sha256(fileKey ?? url ?? "")  [PROMPT_CONTENT_HASH]
    const contentHash = computeContentHash(dto.fileKey, dto.url);

    const material = await this.prisma.material.create({
      data: {
        moduleId: dto.moduleId,
        title: dto.title,
        type: dto.type,
        orderNumber: dto.orderNumber ?? 0,
        fileKey: dto.fileKey,
        url: dto.url,
        durationMin: dto.durationMin,
        isActive: true,
        createdBy: userId,
        versions: {
          create: {
            versionNumber: 1,
            contentHash,
            fileKey: dto.fileKey,
            url: dto.url,
            changeNote: dto.changeNote ?? 'Initial version',
            isCurrent: true,
            createdBy: userId,
          },
        },
      },
      include: {
        versions: { where: { isCurrent: true }, take: 1 },
      },
    });

    this.logger.log(
      `Material created: materialId=${material.materialId} hash=${contentHash.slice(0, 8)}… by=${userId}`,
    );
    return this.mapToDto(material as MaterialWithVersion);
  }

  // ---------------------------------------------------------------------------
  // PUT /v1/materials/:id — обновить материал, создать новую MaterialVersion (NFR-18)
  //
  // Транзакция:
  //   1. Найти текущую версию (isCurrent=true)
  //   2. contentHash = sha256(newFileKey ?? newUrl ?? "")
  //   3. Деактивировать текущую версию (isCurrent=false)
  //   4. Создать новую запись MaterialVersion с version+1 и isCurrent=true
  //   5. Обновить поля Material
  // ---------------------------------------------------------------------------

  async update(
    id: string,
    dto: UpdateMaterialDto,
    userId: string,
  ): Promise<MaterialResponseDto> {
    const existing = await this.prisma.material.findUnique({
      where: { materialId: id },
      include: {
        versions: {
          where: { isCurrent: true },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!existing) throw new NotFoundException(`Material ${id} not found`);

    const resolvedFileKey =
      dto.fileKey !== undefined ? dto.fileKey : existing.fileKey;
    const resolvedUrl =
      dto.url !== undefined ? dto.url : existing.url;

    const contentHash = computeContentHash(resolvedFileKey, resolvedUrl);

    const currentVersion = existing.versions[0];
    const newVersionNumber = currentVersion
      ? currentVersion.versionNumber + 1
      : 1;

    const result = await this.prisma.$transaction(async (tx) => {
      if (currentVersion) {
        await tx.materialVersion.update({
          where: { versionId: currentVersion.versionId },
          data: { isCurrent: false },
        });
      }

      const newVersion = await tx.materialVersion.create({
        data: {
          materialId: id,
          versionNumber: newVersionNumber,
          contentHash,
          fileKey: resolvedFileKey,
          url: resolvedUrl,
          changeNote: dto.changeNote,
          isCurrent: true,
          createdBy: userId,
        },
      });

      const updated = await tx.material.update({
        where: { materialId: id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.orderNumber !== undefined && { orderNumber: dto.orderNumber }),
          ...(dto.fileKey !== undefined && { fileKey: dto.fileKey }),
          ...(dto.url !== undefined && { url: dto.url }),
          ...(dto.durationMin !== undefined && { durationMin: dto.durationMin }),
        },
      });

      return { material: updated, version: newVersion };
    });

    this.logger.log(
      `Material versioned: materialId=${id} v${newVersionNumber} hash=${contentHash.slice(0, 8)}… by=${userId}`,
    );

    return this.mapToDto({
      ...result.material,
      versions: [result.version],
    });
  }

  // ---------------------------------------------------------------------------
  // DELETE /v1/materials/:id — мягкое удаление (isActive=false)
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.material.findUnique({
      where: { materialId: id },
      select: { materialId: true },
    });
    if (!existing) throw new NotFoundException(`Material ${id} not found`);

    await this.prisma.material.update({
      where: { materialId: id },
      data: { isActive: false },
    });

    this.logger.log(`Material soft-deleted: materialId=${id}`);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private validateContentSource(
    fileKey?: string,
    url?: string,
    type?: string,
  ): void {
    if (!fileKey && !url) {
      throw new BadRequestException('Either fileKey or url must be provided');
    }
  }

  private mapToDto(m: MaterialWithVersion): MaterialResponseDto {
    const version = m.versions[0];

    const currentVersion: MaterialVersionDto = version
      ? {
          versionId: version.versionId,
          versionNumber: version.versionNumber,
          contentHash: version.contentHash,
          fileKey: version.fileKey,
          url: version.url,
          changeNote: version.changeNote,
          isCurrent: version.isCurrent,
          createdBy: version.createdBy,
          createdAt: version.createdAt,
        }
      : {
          versionId: '',
          versionNumber: 0,
          contentHash: '',
          fileKey: null,
          url: null,
          changeNote: null,
          isCurrent: false,
          createdBy: null,
          createdAt: new Date(0),
        };

    return {
      materialId: m.materialId,
      moduleId: m.moduleId,
      title: m.title,
      type: m.type,
      orderNumber: m.orderNumber,
      fileKey: m.fileKey,
      url: m.url,
      durationMin: m.durationMin,
      isActive: m.isActive,
      createdBy: m.createdBy,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      currentVersion,
    };
  }
}
