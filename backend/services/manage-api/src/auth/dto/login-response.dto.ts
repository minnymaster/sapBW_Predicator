import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT RS256 access token (TTL 15 min)' })
  accessToken!: string;

  @ApiProperty({ example: 'bearer' })
  tokenType!: string;

  @ApiProperty({ description: 'TTL in seconds', example: 900 })
  expiresIn!: number;
}