import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateMaterialDto } from './create-material.dto';

// moduleId нельзя менять через PUT (материал принадлежит конкретному модулю)
export class UpdateMaterialDto extends PartialType(
  OmitType(CreateMaterialDto, ['moduleId'] as const),
) {}
