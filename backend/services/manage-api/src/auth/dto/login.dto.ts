import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ivan.ivanov@company.ru' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecretPassword123' })
  @IsString()
  @MinLength(6)
  password!: string;
}